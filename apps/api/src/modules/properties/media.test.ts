import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Property, PropertyTypes } from '@real-estate/shared';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password';
import { buildTestApp, startTestDatabase } from '../../test/helpers';
import { ChangeLogModel } from '../changeLogs/changeLog.model';
import { ensureStartingPropertyTypes } from '../propertyTypes/propertyTypes.defaults';
import {
  AmenityModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
} from '../propertyTypes/propertyTypes.model';
import { UserModel } from '../users/user.model';
import { CounterModel, PropertyModel } from './property.model';

const PASSWORD = 'correct-horse-9';
const BASE = '/api/v1/admin/properties';
const MODELS = [
  UserModel,
  PropertyModel,
  CounterModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
  AmenityModel,
];

/** A real 3000×2000 JPG (with a camera-style rotation tag) and a small PNG. */
const photo = (color: string, width = 3000, height = 2000) =>
  sharp({ create: { width, height, channels: 3, background: color } })
    .jpeg()
    .withMetadata({ orientation: 1 })
    .toBuffer();
const PDF = Buffer.concat([
  Buffer.from('%PDF-1.4\n'),
  Buffer.alloc(200, 32),
  Buffer.from('\n%%EOF'),
]);
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypmp42'),
  Buffer.alloc(200, 1),
]);

const COMPLETE = {
  price: { amount: 12_500_000 },
  area: { value: 2100, unit: 'sqft' },
  location: { city: 'Chennai', locality: 'Tambaram', pincode: '600045' },
};

describe('property media', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  const tokens: Record<string, string> = {};
  let villaId: string;

  const as = (role: string, req: request.Test) =>
    req.set('authorization', `Bearer ${tokens[role]}`);
  const upload = (id: string, file: Buffer, name: string, kind = 'image', role = 'admin') =>
    as(role, request(ctx.app).post(`${BASE}/${id}/media?kind=${kind}`)).attach('file', file, name);
  const newVilla = async (extra: object = {}) =>
    (
      await as('admin', request(ctx.app).post(BASE)).send({
        subcategoryId: villaId,
        title: '3 BHK villa with garden',
        purpose: 'sale',
        ...extra,
      })
    ).body.data as Property;
  const onDisk = (url: string | null) =>
    existsSync(ctx.storage.absolutePath(url!.replace('/uploads/', '')));

  beforeAll(async () => {
    db = await startTestDatabase();
    await Promise.all(MODELS.map((m) => m.syncIndexes()));
  });
  afterAll(async () => {
    await db.stop();
  });
  beforeEach(async () => {
    await db.clear();
    await ensureStartingPropertyTypes();
    ctx = await buildTestApp();
    const passwordHash = await hashPassword(PASSWORD);
    for (const role of ['admin', 'sales_agent'] as const) {
      await UserModel.create({
        name: role,
        email: `${role}@company.com`,
        role,
        status: 'active',
        passwordHash,
      });
      const login = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: `${role}@company.com`, password: PASSWORD });
      tokens[role] = login.body.data.accessToken;
    }
    const types: PropertyTypes = (
      await as('admin', request(ctx.app).get('/api/v1/admin/property-types'))
    ).body.data;
    villaId = types.categories[0]!.subcategories.find((s) => s.name === 'Villa / House')!.id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it('saves a photo as WebP in three sizes, makes it the cover, and serves it', async () => {
    const p = await newVilla();
    const res = await upload(p.id, await photo('#c33'), 'Front view.JPG');
    expect(res.status).toBe(201);
    const [m] = res.body.data.media;
    expect(m).toMatchObject({
      kind: 'image',
      isCover: true,
      mime: 'image/webp',
      originalName: 'Front view.JPG',
    });
    for (const url of [m.url, m.mediumUrl, m.thumbUrl]) {
      expect(url).toMatch(/^\/uploads\/properties\/RE-VIL-000001\/images\/[a-f0-9]{24}\.webp$/);
      expect(onDisk(url)).toBe(true);
    }
    const sizes = await Promise.all(
      [m.url, m.mediumUrl, m.thumbUrl].map(async (u: string) =>
        sharp(await readFile(ctx.storage.absolutePath(u.replace('/uploads/', '')))).metadata(),
      ),
    );
    expect(sizes.map((s) => [s.format, s.width, s.height])).toEqual([
      ['webp', 2000, 1333],
      ['webp', 1200, 800],
      ['webp', 400, 267],
    ]);
    const served = await request(ctx.app).get(m.thumbUrl);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/webp');

    expect(res.body.data.publishIssues.map((i: { path: string }) => i.path)).not.toContain('media');
    const list = await as('admin', request(ctx.app).get(BASE));
    expect(list.body.data[0].coverUrl).toBe(m.thumbUrl);
  });

  it('accepts PDFs and videos where allowed and checks the real file type and size', async () => {
    const p = await newVilla();
    const brochure = await upload(p.id, PDF, 'Brochure.pdf', 'brochure');
    expect(brochure.body.data.media[0]).toMatchObject({
      kind: 'brochure',
      mime: 'application/pdf',
      thumbUrl: null,
    });
    expect(brochure.body.data.media[0].url).toMatch(/\/documents\/[a-f0-9]{24}\.pdf$/);
    const plan = await upload(p.id, PDF, 'Plan.pdf', 'floor_plan');
    expect(plan.status).toBe(201);
    const video = await upload(p.id, MP4, 'Walkthrough.mp4', 'video');
    expect(video.body.data.media[2]).toMatchObject({ kind: 'video', mime: 'video/mp4' });
    expect(video.body.data.media[2].url).toMatch(/\/videos\/[a-f0-9]{24}\.mp4$/);
    // No photo yet, so nothing is the cover.
    expect(video.body.data.media.every((m: { isCover: boolean }) => !m.isCover)).toBe(true);

    const renamed = await upload(p.id, PDF, 'photo.jpg');
    expect(renamed.body.error).toMatchObject({ code: 'INVALID_FILE_TYPE' });
    expect((await upload(p.id, await photo('#333', 50, 50), 'cover.jpg', 'brochure')).status).toBe(
      400,
    );
    expect((await upload(p.id, Buffer.from('MZ...'), 'setup.exe')).body.error.code).toBe(
      'INVALID_FILE_TYPE',
    );
    const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 7)]);
    expect((await upload(p.id, corrupt, 'broken.jpg')).body.error.message).toBe(
      "This image can't be read. Try another file.",
    );
    const huge = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(11 * 1024 * 1024),
    ]);
    expect((await upload(p.id, huge, 'huge.jpg')).body.error).toMatchObject({
      code: 'FILE_TOO_LARGE',
      message: 'A photo can be up to 10 MB.',
    });
    const none = await as('admin', request(ctx.app).post(`${BASE}/${p.id}/media`));
    expect(none.body.error.code).toBe('FILE_REQUIRED');
    expect((await upload(p.id, PDF, 'x.pdf', 'brochure', 'sales_agent')).status).toBe(403);
  });

  it('sets the cover, reorders, and records each change', async () => {
    const p = await newVilla();
    await upload(p.id, await photo('#c33'), 'a.jpg');
    await upload(p.id, await photo('#3c3'), 'b.jpg');
    const three = (await upload(p.id, PDF, 'c.pdf', 'document')).body.data.media;
    const [a, b, c] = three.map((m: { id: string }) => m.id);

    const cover = await as('admin', request(ctx.app).post(`${BASE}/${p.id}/media/${b}/cover`));
    expect(cover.body.data.media.map((m: { isCover: boolean }) => m.isCover)).toEqual([
      false,
      true,
      false,
    ]);
    expect(
      (await as('admin', request(ctx.app).post(`${BASE}/${p.id}/media/${c}/cover`))).status,
    ).toBe(422);

    const order = (ids: string[]) =>
      as('admin', request(ctx.app).put(`${BASE}/${p.id}/media/order`)).send({ ids });
    const reordered = await order([c, b, a]);
    expect(reordered.body.data.media.map((m: { id: string }) => m.id)).toEqual([c, b, a]);
    expect((await order([c, b])).body.error.code).toBe('STALE_ORDER');

    const actions = (await ChangeLogModel.find({ entityId: p.id }).sort({ at: 1 }).lean()).map(
      (l) => l.action,
    );
    expect(actions).toEqual([
      'created',
      'media_added',
      'media_added',
      'media_added',
      'cover_changed',
      'media_reordered',
    ]);
  });

  it('deleting removes the files; the next photo becomes the cover', async () => {
    const p = await newVilla();
    const first = (await upload(p.id, await photo('#c33'), 'a.jpg')).body.data.media[0];
    const second = (await upload(p.id, await photo('#3c3'), 'b.jpg')).body.data.media[1];
    const res = await as('admin', request(ctx.app).delete(`${BASE}/${p.id}/media/${first.id}`));
    expect(res.body.data.media).toEqual([
      expect.objectContaining({ id: second.id, isCover: true }),
    ]);
    for (const url of [first.url, first.mediumUrl, first.thumbUrl]) expect(onDisk(url)).toBe(false);
    expect(onDisk(second.url)).toBe(true);
    const log = await ChangeLogModel.findOne({ action: 'media_removed' }).lean();
    expect(log!.changes).toEqual({ media: ['Photo: a.jpg', null] });
  });

  it('a published property keeps at least one photo; archived ones are locked', async () => {
    const p = await newVilla(COMPLETE);
    const blocked = await as('admin', request(ctx.app).post(`${BASE}/${p.id}/status`)).send({
      status: 'published',
    });
    expect(blocked.body.error.details).toEqual([
      { path: 'media', message: 'Add at least one photo' },
    ]);

    const only = (await upload(p.id, await photo('#c33'), 'a.jpg')).body.data.media[0];
    const published = await as('admin', request(ctx.app).post(`${BASE}/${p.id}/status`)).send({
      status: 'published',
    });
    expect(published.body.data.status).toBe('published');
    const del = await as('admin', request(ctx.app).delete(`${BASE}/${p.id}/media/${only.id}`));
    expect(del.status).toBe(422);
    expect(del.body.error.message).toMatch(/needs at least one photo/);

    await as('admin', request(ctx.app).delete(`${BASE}/${p.id}`));
    expect((await upload(p.id, await photo('#33c'), 'b.jpg')).status).toBe(422);
  });
});
