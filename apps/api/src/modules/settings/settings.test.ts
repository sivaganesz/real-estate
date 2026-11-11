import { existsSync } from 'node:fs';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password';
import { buildTestApp, startTestDatabase } from '../../test/helpers';
import { ChangeLogModel } from '../changeLogs/changeLog.model';
import { UserModel } from '../users/user.model';
import { getCompanyName } from './settings.service';

const PASSWORD = 'correct-horse-9';
const BASE = '/api/v1/admin/settings/company';

/** Smallest valid PNG / JPEG / WebP headers (enough for the content check). */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);

const VALID = {
  name: 'Skyline Realty',
  shortDescription: 'Homes and plots in Bengaluru',
  address: '12 MG Road, Bengaluru 560001',
  officeLocation: { lat: 12.9756, lng: 77.6066 },
  phone: '9876543210',
  email: 'Hello@Skyline.in',
};

describe('settings → company info', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  const tokens: Record<string, string> = {};
  let adminId: string;

  const as = (role: string, req: request.Test) =>
    req.set('authorization', `Bearer ${tokens[role]}`);

  beforeAll(async () => {
    db = await startTestDatabase();
    await UserModel.syncIndexes();
  });
  afterAll(async () => {
    await db.stop();
  });
  beforeEach(async () => {
    await db.clear();
    ctx = await buildTestApp();
    const passwordHash = await hashPassword(PASSWORD);
    for (const [role, name] of [
      ['admin', 'Asha Admin'],
      ['sales_agent', 'Ravi Agent'],
    ] as const) {
      const user = await UserModel.create({
        name,
        email: `${role}@company.com`,
        role,
        status: 'active',
        passwordHash,
      });
      if (role === 'admin') adminId = user._id;
      const login = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: `${role}@company.com`, password: PASSWORD });
      tokens[role] = login.body.data.accessToken;
    }
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it('any signed-in role can read it; before setup it shows the defaults', async () => {
    const res = await as('sales_agent', request(ctx.app).get(BASE));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Your Company Name',
      logoUrl: null,
      phone: null,
      email: null,
      isConfigured: false,
      updatedBy: null,
    });
    expect((await request(ctx.app).get(BASE)).status).toBe(401);
  });

  it('only roles with settings:edit can change it', async () => {
    expect((await as('sales_agent', request(ctx.app).put(BASE)).send(VALID)).status).toBe(403);
    const upload = await as('sales_agent', request(ctx.app).post(`${BASE}/logo`)).attach(
      'file',
      PNG,
      'logo.png',
    );
    expect(upload.status).toBe(403);
    expect((await as('sales_agent', request(ctx.app).delete(`${BASE}/logo`))).status).toBe(403);
  });

  it('saves the details, normalises the phone and email, and records who changed what', async () => {
    const res = await as('admin', request(ctx.app).put(BASE)).send(VALID);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Skyline Realty',
      officeLocation: { lat: 12.9756, lng: 77.6066 },
      phone: '+919876543210',
      email: 'hello@skyline.in',
      isConfigured: true,
      updatedBy: { id: adminId, name: 'Asha Admin' },
    });
    expect(res.body.data.updatedAt).toEqual(expect.any(String));
    expect(await getCompanyName()).toBe('Skyline Realty'); // used in emails

    // A second save logs only the fields that changed.
    await as('admin', request(ctx.app).put(BASE)).send({ ...VALID, name: 'Skyline Homes' });
    const logs = await ChangeLogModel.find({ entity: 'settings' }).sort({ at: 1 }).lean();
    expect(logs.map((l) => l.action)).toEqual(['created', 'updated']);
    expect(logs[1]!.changes).toEqual({ name: ['Skyline Realty', 'Skyline Homes'] });
    expect(logs[1]!.actorId).toBe(adminId);
  });

  it('rejects invalid details with field errors', async () => {
    const res = await as('admin', request(ctx.app).put(BASE)).send({
      ...VALID,
      phone: '98765abc',
      email: 'not-an-email',
      officeLocation: { lat: 120, lng: 77 },
    });
    expect(res.status).toBe(400);
    const paths = (res.body.error.details as { path: string }[]).map((d) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining(['body.phone', 'body.email', 'body.officeLocation.lat']),
    );
  });

  it('uploads a logo, serves it, and replaces the old file on the next upload', async () => {
    await as('admin', request(ctx.app).put(BASE)).send(VALID);
    const first = await as('admin', request(ctx.app).post(`${BASE}/logo`)).attach(
      'file',
      PNG,
      'logo.png',
    );
    expect(first.status).toBe(200);
    const firstUrl: string = first.body.data.logoUrl;
    expect(firstUrl).toMatch(/^\/uploads\/company\/logo\/[a-f0-9]+\.png$/);
    expect(first.body.data.name).toBe('Skyline Realty'); // other details untouched

    const served = await request(ctx.app).get(firstUrl);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    const firstFile = ctx.storage.absolutePath(firstUrl.replace('/uploads/', ''));
    expect(existsSync(firstFile)).toBe(true);

    const second = await as('admin', request(ctx.app).post(`${BASE}/logo`)).attach(
      'file',
      JPG,
      'new-logo.jpg',
    );
    expect(second.body.data.logoUrl).toMatch(/\.jpg$/);
    expect(existsSync(firstFile)).toBe(false);

    const actions = (await ChangeLogModel.find({ action: 'logo_updated' }).lean()).length;
    expect(actions).toBe(2);
  });

  it('a logo uploaded before the first save keeps the default details, and saving keeps the logo', async () => {
    const upload = await as('admin', request(ctx.app).post(`${BASE}/logo`)).attach(
      'file',
      PNG,
      'logo.png',
    );
    expect(upload.body.data).toMatchObject({ name: 'Your Company Name', isConfigured: false });
    const saved = await as('admin', request(ctx.app).put(BASE)).send(VALID);
    expect(saved.body.data.logoUrl).toBe(upload.body.data.logoUrl);
  });

  it('rejects files that are not real PNG/JPG/WebP images, too large, or missing', async () => {
    const fake = await as('admin', request(ctx.app).post(`${BASE}/logo`)).attach(
      'file',
      Buffer.from('<script>alert(1)</script>'),
      { filename: 'logo.png', contentType: 'image/png' },
    );
    expect(fake.status).toBe(400);
    expect(fake.body.error.code).toBe('INVALID_FILE_TYPE');

    const svg = await as('admin', request(ctx.app).post(`${BASE}/logo`)).attach(
      'file',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      { filename: 'logo.svg', contentType: 'image/svg+xml' },
    );
    expect(svg.status).toBe(400);
    expect(svg.body.error.code).toBe('INVALID_FILE_TYPE');

    const big = await as('admin', request(ctx.app).post(`${BASE}/logo`)).attach(
      'file',
      Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]),
      'big.png',
    );
    expect(big.status).toBe(400);
    expect(big.body.error).toMatchObject({
      code: 'FILE_TOO_LARGE',
      message: 'The logo must be 2 MB or smaller.',
    });

    const none = await as('admin', request(ctx.app).post(`${BASE}/logo`));
    expect(none.status).toBe(400);
    expect(none.body.error.code).toBe('FILE_REQUIRED');

    expect((await as('admin', request(ctx.app).get(BASE))).body.data.logoUrl).toBeNull();
  });

  it('removes the logo and its file', async () => {
    const upload = await as('admin', request(ctx.app).post(`${BASE}/logo`)).attach(
      'file',
      PNG,
      'logo.png',
    );
    const file = ctx.storage.absolutePath(upload.body.data.logoUrl.replace('/uploads/', ''));
    const res = await as('admin', request(ctx.app).delete(`${BASE}/logo`));
    expect(res.status).toBe(200);
    expect(res.body.data.logoUrl).toBeNull();
    expect(existsSync(file)).toBe(false);
    expect(await ChangeLogModel.countDocuments({ action: 'logo_removed' })).toBe(1);
  });
});
