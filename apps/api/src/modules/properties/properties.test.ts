import type { Property, PropertyTypes } from '@real-estate/shared';
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
const TYPES = '/api/v1/admin/property-types';
const MODELS = [
  UserModel,
  PropertyModel,
  CounterModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
  AmenityModel,
];

const COMPLETE = {
  price: { amount: 12_500_000, basis: 'total', negotiable: true, onRequest: false },
  area: { value: 2100, unit: 'sqft' },
  location: {
    state: 'Tamil Nadu',
    city: 'Chennai',
    locality: 'Tambaram',
    pincode: '600045',
    address: 'No. 14, Gandhi Street',
  },
};

describe('properties API', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  const tokens: Record<string, string> = {};
  let types: PropertyTypes;
  let adminId: string;

  const as = (role: string, req: request.Test) =>
    req.set('authorization', `Bearer ${tokens[role]}`);
  const sub = (name: string) => types.categories[0]!.subcategories.find((s) => s.name === name)!;
  const amenityId = (name: string) =>
    types.categories[0]!.amenities.find((a) => a.name === name)!.id;
  const create = (body: object) => as('admin', request(ctx.app).post(BASE)).send(body);
  const patch = (id: string, body: object) =>
    as('admin', request(ctx.app).patch(`${BASE}/${id}`)).send(body);
  const setStatus = (id: string, status: string) =>
    as('admin', request(ctx.app).post(`${BASE}/${id}/status`)).send({ status });
  const addPhoto = (id: string) =>
    PropertyModel.updateOne(
      { _id: id },
      { $push: { media: { kind: 'image', path: `properties/${id}/a.webp`, isCover: true } } },
    );
  const villa = (extra: object = {}) =>
    create({
      subcategoryId: sub('Villa / House').id,
      title: '3 BHK villa with garden',
      purpose: 'sale',
      ...extra,
    });

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
      const user = await UserModel.create({
        name: role === 'admin' ? 'Asha Admin' : 'Ravi Agent',
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
    types = (await as('admin', request(ctx.app).get(TYPES))).body.data;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it('creates a Draft with a code per subcategory and lists what is missing to publish', async () => {
    const first = await villa();
    expect(first.status).toBe(201);
    const p: Property = first.body.data;
    expect(p).toMatchObject({
      code: 'RE-VIL-000001',
      categoryKey: 'residential',
      subcategoryName: 'Villa / House',
      status: 'draft',
      price: { amount: null, basis: 'total', negotiable: false, onRequest: false },
      area: null,
      createdBy: { id: adminId, name: 'Asha Admin' },
    });
    expect(p.publishIssues.map((i) => i.path)).toEqual([
      'price',
      'area',
      'location.city',
      'location.locality',
      'location.pincode',
      'media',
    ]);
    expect((await villa()).body.data.code).toBe('RE-VIL-000002');
    const plot = await create({
      subcategoryId: sub('Residential Plot').id,
      title: 'Corner plot near bypass',
      purpose: 'sale',
    });
    expect(plot.body.data.code).toBe('RE-PLT-000001');
    expect(await ChangeLogModel.countDocuments({ entity: 'property', action: 'created' })).toBe(3);
  });

  it('checks values against the subcategory: purpose, attributes, extras and amenities', async () => {
    const plotRent = await create({
      subcategoryId: sub('Residential Plot').id,
      title: 'Plot for rent',
      purpose: 'rent',
    });
    expect(plotRent.status).toBe(400);
    expect(plotRent.body.error.details[0]).toMatchObject({
      path: 'body.purpose',
      message: 'Residential Plot can be listed for: Sale, Lease',
    });

    const bad = await villa({
      attributeValues: { bhk: '7 BHK', floors: 'two', lift: true, facing: 'east' },
      extraAttributes: [{ label: 'bhk', type: 'text', value: 'x' }],
      amenityIds: [amenityId('Lift')],
    });
    expect(bad.status).toBe(400);
    const paths = (bad.body.error.details as { path: string }[]).map((d) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'body.attributeValues.bhk',
        'body.attributeValues.floors',
        'body.attributeValues.lift', // Lift belongs to apartments, not villas
        'body.extraAttributes.0',
        'body.amenityIds',
      ]),
    );
    expect(paths).not.toContain('body.attributeValues.facing'); // common; matched case-insensitively

    // Format checks come first, with their own messages.
    const pin = await villa({ location: { pincode: '12345' }, price: { amount: -5 } });
    expect(pin.body.error.details).toEqual(
      expect.arrayContaining([
        { path: 'body.location.pincode', message: 'Enter a valid 6-digit pincode' },
        { path: 'body.price.amount', message: 'Price must be more than 0' },
      ]),
    );
  });

  it('saves clean values: matches option spelling, converts the area, drops empty values', async () => {
    const res = await villa({
      ...COMPLETE,
      area: { value: 5, unit: 'cent' },
      attributeValues: {
        bhk: '3 bhk',
        bathrooms: 3,
        facing: 'EAST',
        description: '   ',
        floors: '',
      },
      extraAttributes: [{ label: 'Servant room', type: 'yes_no', value: true }],
      amenityIds: [amenityId('Power backup'), amenityId('Gated community')],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      area: { value: 5, unit: 'cent', sqft: 2178 },
      attributeValues: { bhk: '3 BHK', bathrooms: 3, facing: 'East' },
      extraAttributes: [{ label: 'Servant room', type: 'yes_no', value: true }],
      // In checklist order, not the order sent
      amenityIds: [amenityId('Gated community'), amenityId('Power backup')],
    });
    expect(Object.keys(res.body.data.attributeValues)).not.toContain('description');
  });

  it('only roles with properties:write can create or change; agents can view', async () => {
    const id = (await villa()).body.data.id;
    expect((await as('sales_agent', request(ctx.app).get(BASE))).status).toBe(200);
    expect((await as('sales_agent', request(ctx.app).get(`${BASE}/${id}`))).status).toBe(200);
    expect((await as('sales_agent', request(ctx.app).get(`${BASE}/${id}/history`))).status).toBe(
      200,
    );
    for (const attempt of [
      request(ctx.app).post(BASE).send({}),
      request(ctx.app).patch(`${BASE}/${id}`).send({ title: 'Changed title' }),
      request(ctx.app).post(`${BASE}/${id}/status`).send({ status: 'archived' }),
      request(ctx.app).delete(`${BASE}/${id}`),
    ]) {
      expect((await as('sales_agent', attempt)).status).toBe(403);
    }
  });

  it('edits only what is sent, records each change, and keeps values hidden after a subcategory change', async () => {
    const id = (await villa({ attributeValues: { bhk: '3 BHK', built_up_area: 1850, floors: 2 } }))
      .body.data.id;
    const res = await patch(id, {
      title: '3 BHK villa near station',
      attributeValues: { floors: null, bathrooms: 3 },
    });
    expect(res.body.data.attributeValues).toEqual({
      bhk: '3 BHK',
      built_up_area: 1850,
      bathrooms: 3,
    });
    expect(res.body.data.updatedBy).toEqual({ id: adminId, name: 'Asha Admin' });

    const moved = await patch(id, { subcategoryId: sub('Apartment / Flat').id });
    expect(moved.body.data).toMatchObject({
      code: 'RE-VIL-000001',
      subcategoryName: 'Apartment / Flat',
    });
    expect(moved.body.data.hiddenAttributeKeys).toEqual(['built_up_area']);
    const back = await patch(id, { subcategoryId: sub('Villa / House').id });
    expect(back.body.data.hiddenAttributeKeys).toEqual([]);
    expect(back.body.data.attributeValues.built_up_area).toBe(1850);

    const history = (await as('admin', request(ctx.app).get(`${BASE}/${id}/history`))).body.data;
    expect(history.map((h: { action: string }) => h.action)).toEqual([
      'updated',
      'updated',
      'updated',
      'created',
    ]);
    expect(history[1].changes).toEqual({ subcategoryId: ['Villa / House', 'Apartment / Flat'] });
    expect(history[3].changes).toMatchObject({ code: [null, 'RE-VIL-000001'] });
    expect(history.at(-2).changes).toMatchObject({
      title: ['3 BHK villa with garden', '3 BHK villa near station'],
      'attributes.floors': [2, null],
      'attributes.bathrooms': [null, 3],
    });
    expect(history[0].by).toEqual({ id: adminId, name: 'Asha Admin' });
  });

  it('publishes only when complete, and a published property stays complete', async () => {
    const id = (await villa()).body.data.id;
    const blocked = await setStatus(id, 'published');
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('PUBLISH_BLOCKED');
    expect(blocked.body.error.details).toContainEqual({
      path: 'media',
      message: 'Add at least one photo',
    });

    // Make BHK required for villas: publishing now needs it too.
    const bhk = sub('Villa / House').attributes.find((a) => a.key === 'bhk')!;
    await as(
      'admin',
      request(ctx.app).patch(
        `${TYPES}/subcategories/${sub('Villa / House').id}/attributes/${bhk.id}`,
      ),
    ).send({ required: true });
    await patch(id, COMPLETE);
    await addPhoto(id);
    const stillBlocked = await setStatus(id, 'published');
    expect(stillBlocked.body.error.details).toEqual([
      { path: 'attributeValues.bhk', message: 'Fill in BHK' },
    ]);

    await patch(id, { attributeValues: { bhk: '3 BHK' } });
    const published = await setStatus(id, 'published');
    expect(published.status).toBe(200);
    expect(published.body.data).toMatchObject({ status: 'published', publishIssues: [] });
    expect(published.body.data.publishedAt).toEqual(expect.any(String));

    const clearPrice = await patch(id, { price: { amount: null } });
    expect(clearPrice.status).toBe(422);
    expect(clearPrice.body.error.code).toBe('PUBLISH_BLOCKED');
    expect((await patch(id, { price: { amount: null, onRequest: true } })).status).toBe(200);
  });

  it('follows the status rules: closing status matches the purpose; archive and restore', async () => {
    const id = (await villa(COMPLETE)).body.data.id;
    await addPhoto(id);
    expect((await setStatus(id, 'booked')).body.error.message).toBe(
      "A Draft property can't be marked Booked.",
    );
    await setStatus(id, 'published');
    expect((await setStatus(id, 'rented')).body.error.message).toBe(
      'A property for Sale is marked Sold, not Rented.',
    );
    expect((await setStatus(id, 'booked')).body.data.status).toBe('booked');
    expect((await setStatus(id, 'sold')).body.data.status).toBe('sold');

    const archived = await as('admin', request(ctx.app).delete(`${BASE}/${id}`));
    expect(archived.body.data.status).toBe('archived');
    expect((await patch(id, { title: 'Edit while archived' })).status).toBe(422);
    expect((await setStatus(id, 'draft')).body.data.status).toBe('draft');

    const statuses = await ChangeLogModel.find({
      entityId: id,
      changes: { $exists: true },
      action: { $in: ['status_changed', 'archived'] },
    })
      .sort({ at: 1 })
      .lean();
    expect(statuses.map((l) => (l.changes as { status: string[] }).status[1])).toEqual([
      'published',
      'booked',
      'sold',
      'archived',
      'draft',
    ]);
  });

  it('changes status in bulk and says why each failure failed', async () => {
    const ready = (await villa(COMPLETE)).body.data;
    await addPhoto(ready.id);
    const notReady = (await villa()).body.data;
    const res = await as('admin', request(ctx.app).post(`${BASE}/bulk-status`)).send({
      ids: [ready.id, notReady.id],
      status: 'published',
    });
    expect(res.body.data.updated).toEqual([{ id: ready.id, code: ready.code }]);
    expect(res.body.data.failed).toHaveLength(1);
    expect(res.body.data.failed[0]).toMatchObject({ id: notReady.id, code: notReady.code });
    expect(res.body.data.failed[0].reason).toContain('Enter the price');
  });

  it('lists with search, filters, sorting, status counts and pagination', async () => {
    const make = (title: string, extra: object) =>
      villa({ ...COMPLETE, title, ...extra }).then((r) => r.body.data as Property);
    const a = await make('Villa in Tambaram', { price: { amount: 9_000_000 } });
    const b = await make('Villa in Velachery', {
      price: { amount: 15_000_000 },
      location: { ...COMPLETE.location, locality: 'Velachery', pincode: '600042' },
    });
    const c = await make('Villa in Coimbatore', {
      purpose: 'rent',
      price: { amount: 30_000, basis: 'per_month' },
      location: {
        ...COMPLETE.location,
        city: 'Coimbatore',
        locality: 'RS Puram',
        pincode: '641002',
      },
    });
    await as('admin', request(ctx.app).delete(`${BASE}/${c.id}`)); // archived: hidden by default

    const list = (qs: string) => as('admin', request(ctx.app).get(`${BASE}?${qs}`));
    const codes = (res: request.Response) => res.body.data.map((p: { code: string }) => p.code);

    expect(codes(await list(''))).toEqual([b.code, a.code]);
    expect(codes(await list('q=velach'))).toEqual([b.code]);
    expect(codes(await list(`q=${a.code.toLowerCase()}`))).toEqual([a.code]);
    expect(codes(await list('city=CHENNAI&maxPrice=10000000'))).toEqual([a.code]);
    expect(codes(await list('status=archived'))).toEqual([c.code]);
    expect(codes(await list('sort=price.amount'))).toEqual([a.code, b.code]);
    const page = await list('limit=1&page=2&sort=-price.amount');
    expect(codes(page)).toEqual([a.code]);
    expect(page.body.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect(page.body.data[0]).toMatchObject({
      subcategoryName: 'Villa / House',
      location: { city: 'Chennai', locality: 'Tambaram', pincode: '600045' },
      area: { value: 2100, unit: 'sqft', sqft: 2100 },
    });

    const counts = (await as('admin', request(ctx.app).get(`${BASE}/status-counts`))).body.data;
    expect(counts).toMatchObject({ all: 2, draft: 2, archived: 1, published: 0 });
    expect((await list('sort=password')).status).toBe(400);
  });

  it('suggests existing city and locality spellings, most used first', async () => {
    await villa(COMPLETE);
    await villa(COMPLETE);
    await villa({
      ...COMPLETE,
      location: { ...COMPLETE.location, city: 'chennai', locality: 'Tambaram West' },
    });
    await villa({
      ...COMPLETE,
      location: { ...COMPLETE.location, city: 'Chengalpattu', locality: 'Tambaram East' },
    });

    const suggest = (qs: string) =>
      as('sales_agent', request(ctx.app).get(`${BASE}/location-suggestions?${qs}`)).then(
        (r) => r.body.data,
      );
    expect(await suggest('field=city&q=chen')).toEqual([
      { value: 'Chennai', count: 3 },
      { value: 'Chengalpattu', count: 1 },
    ]);
    expect(await suggest('field=locality&q=tamb&city=Chennai')).toEqual([
      { value: 'Tambaram', count: 2 },
      { value: 'Tambaram West', count: 1 },
    ]);
  });

  it('duplicates a property as a new Draft without photos', async () => {
    const source = (await villa({ ...COMPLETE, attributeValues: { bhk: '3 BHK' } })).body.data;
    await addPhoto(source.id);
    const res = await as('admin', request(ctx.app).post(`${BASE}/${source.id}/duplicate`));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      code: 'RE-VIL-000002',
      title: '3 BHK villa with garden (copy)',
      status: 'draft',
      attributeValues: { bhk: '3 BHK' },
      isFeatured: false,
    });
    expect(res.body.data.publishIssues).toEqual([
      { path: 'media', message: 'Add at least one photo' },
    ]);
  });

  it('turns on the property-type rules: prefix lock, delete blocks and type lock', async () => {
    const villaSub = sub('Villa / House');
    await villa({ attributeValues: { bhk: '3 BHK' }, amenityIds: [amenityId('Gym')] });
    const after: PropertyTypes = (await as('admin', request(ctx.app).get(TYPES))).body.data;
    const v = after.categories[0]!.subcategories.find((s) => s.id === villaSub.id)!;
    expect(v).toMatchObject({ propertyCount: 1, prefixLocked: true });
    expect(after.categories[0]!.amenities.find((a) => a.name === 'Gym')!.propertyCount).toBe(1);

    const rename = await as(
      'admin',
      request(ctx.app).patch(`${TYPES}/subcategories/${villaSub.id}`),
    ).send({ codePrefix: 'VLA' });
    expect(rename.body.error.code).toBe('PREFIX_LOCKED');
    expect(
      (await as('admin', request(ctx.app).delete(`${TYPES}/subcategories/${villaSub.id}`))).status,
    ).toBe(422);
    expect(
      (await as('admin', request(ctx.app).delete(`${TYPES}/amenities/${amenityId('Gym')}`))).status,
    ).toBe(422);
    const bhk = villaSub.attributes.find((a) => a.key === 'bhk')!;
    const typeChange = await as(
      'admin',
      request(ctx.app).patch(`${TYPES}/subcategories/${villaSub.id}/attributes/${bhk.id}`),
    ).send({ type: 'text' });
    expect(typeChange.body.error.code).toBe('TYPE_LOCKED');
  });

  it('removes optional attributes from one property only; required ones stay', async () => {
    const id = (await villa({ attributeValues: { floors: 2, bhk: '3 BHK' } })).body.data.id;
    const res = await patch(id, { removedAttributeKeys: ['floors', 'floors', 'not_a_key'] });
    expect(res.body.data.removedAttributeKeys).toEqual(['floors']);
    expect(res.body.data.attributeValues).toEqual({ bhk: '3 BHK' }); // value cleared

    const bhk = sub('Villa / House').attributes.find((a) => a.key === 'bhk')!;
    await as(
      'admin',
      request(ctx.app).patch(
        `${TYPES}/subcategories/${sub('Villa / House').id}/attributes/${bhk.id}`,
      ),
    ).send({ required: true });
    const required = await patch(id, { removedAttributeKeys: ['bhk'] });
    expect(required.body.error.details[0].message).toBe(
      "BHK is required for Villa / House, so it can't be removed",
    );
    // Restoring = leaving it out of the list.
    expect((await patch(id, { removedAttributeKeys: [] })).body.data.removedAttributeKeys).toEqual(
      [],
    );
  });

  it("can't add properties to an inactive subcategory", async () => {
    await as(
      'admin',
      request(ctx.app).patch(`${TYPES}/subcategories/${sub('Villa / House').id}`),
    ).send({ isActive: false });
    const res = await villa();
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe(
      'Villa / House is inactive. Activate it in Settings first.',
    );
  });
});
