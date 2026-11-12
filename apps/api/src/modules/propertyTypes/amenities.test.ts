import type { PropertyTypes } from '@real-estate/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password';
import { buildTestApp, startTestDatabase } from '../../test/helpers';
import { ChangeLogModel } from '../changeLogs/changeLog.model';
import { UserModel } from '../users/user.model';
import { ensureStartingAmenities, ensureStartingPropertyTypes } from './propertyTypes.defaults';
import {
  AmenityModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
} from './propertyTypes.model';
import { PropertyTypesService } from './propertyTypes.service';
import type { PropertyUsage } from './propertyUsage';

const PASSWORD = 'correct-horse-9';
const BASE = '/api/v1/admin/property-types';
const MODELS = [
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
  AmenityModel,
];

const residential = (data: PropertyTypes) => data.categories.find((c) => c.key === 'residential')!;
const amenity = (data: PropertyTypes, name: string) =>
  residential(data).amenities.find((a) => a.name === name)!;
const subId = (data: PropertyTypes, name: string) =>
  residential(data).subcategories.find((s) => s.name === name)!.id;

describe('settings → property types → amenities', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  const tokens: Record<string, string> = {};

  const as = (role: string, req: request.Test) =>
    req.set('authorization', `Bearer ${tokens[role]}`);
  const read = async (): Promise<PropertyTypes> =>
    (await as('admin', request(ctx.app).get(BASE))).body.data;

  beforeAll(async () => {
    db = await startTestDatabase();
    await Promise.all([UserModel, ...MODELS].map((m) => m.syncIndexes()));
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
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it('starts with Residential amenities, each for all subcategories or some', async () => {
    const data = await read();
    const list = residential(data).amenities;
    expect(list).toHaveLength(14);
    expect(list.slice(0, 3).map((a) => a.name)).toEqual([
      'Gated community',
      '24×7 security',
      'CCTV surveillance',
    ]);
    expect(amenity(data, 'Gated community')).toMatchObject({
      icon: 'fence',
      appliesToAll: true,
      subcategoryIds: [],
      isActive: true,
      propertyCount: 0,
    });
    expect(amenity(data, 'Lift').subcategoryIds).toEqual([subId(data, 'Apartment / Flat')]);
    expect(amenity(data, 'Street lights').subcategoryIds).toEqual([
      subId(data, 'Residential Plot'),
    ]);
    expect(data.categories.find((c) => c.key === 'commercial')!.amenities).toEqual([]);
  });

  it('adds the starting amenities only once, even to a database set up before amenities', async () => {
    await AmenityModel.deleteMany({});
    await PropertyCategoryModel.updateOne(
      { key: 'residential' },
      { $set: { amenitiesSeededAt: null } },
    );
    expect(await ensureStartingAmenities()).toBe('created');
    const gym = amenity(await read(), 'Gym');
    await as('admin', request(ctx.app).delete(`${BASE}/amenities/${gym.id}`));
    expect(await ensureStartingAmenities()).toBe('exists');
    expect(await ensureStartingPropertyTypes()).toBe('exists');
    expect(residential(await read()).amenities.map((a) => a.name)).not.toContain('Gym');
  });

  it('only settings:edit can change amenities', async () => {
    const gym = amenity(await read(), 'Gym');
    const attempts = [
      request(ctx.app).post(`${BASE}/categories/residential/amenities`).send({ name: 'Spa' }),
      request(ctx.app).patch(`${BASE}/amenities/${gym.id}`).send({ isActive: false }),
      request(ctx.app).delete(`${BASE}/amenities/${gym.id}`),
      request(ctx.app)
        .put(`${BASE}/categories/residential/amenities/order`)
        .send({ ids: [gym.id] }),
    ];
    for (const attempt of attempts) expect((await as('sales_agent', attempt)).status).toBe(403);
  });

  it('adds an amenity for some subcategories and checks names and choices', async () => {
    const data = await read();
    const villa = subId(data, 'Villa / House');
    const post = (body: object) =>
      as('admin', request(ctx.app).post(`${BASE}/categories/residential/amenities`)).send(body);

    const res = await post({
      name: 'Home theatre',
      icon: 'sparkles',
      appliesToAll: false,
      subcategoryIds: [villa, villa],
    });
    expect(res.status).toBe(201);
    expect(residential(res.body.data).amenities.at(-1)).toMatchObject({
      name: 'Home theatre',
      icon: 'sparkles',
      appliesToAll: false,
      subcategoryIds: [villa],
    });
    const log = await ChangeLogModel.findOne({ action: 'amenity_created' }).lean();
    expect(log!.changes).toEqual({ name: [null, 'Home theatre'] });

    expect((await post({ name: '  home   THEATRE ' })).body.error.code).toBe('DUPLICATE_NAME');
    const none = await post({ name: 'Spa', appliesToAll: false, subcategoryIds: [] });
    expect(none.status).toBe(400);
    expect(none.body.error.details[0]).toMatchObject({ path: 'body.subcategoryIds' });
    const badIcon = await post({ name: 'Spa', icon: 'rocket' });
    expect(badIcon.body.error.details[0]).toMatchObject({ path: 'body.icon' });
    const unknownSub = await post({
      name: 'Spa',
      appliesToAll: false,
      subcategoryIds: ['0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60'],
    });
    expect(unknownSub.status).toBe(400);
  });

  it('edits an amenity: switching to "all" clears the list; deactivating keeps it', async () => {
    const data = await read();
    const lift = amenity(data, 'Lift');
    const patch = (body: object) =>
      as('admin', request(ctx.app).patch(`${BASE}/amenities/${lift.id}`)).send(body);

    const res = await patch({ name: 'Lift / Elevator', appliesToAll: true, isActive: false });
    expect(res.status).toBe(200);
    expect(amenity(res.body.data, 'Lift / Elevator')).toMatchObject({
      appliesToAll: true,
      subcategoryIds: [],
      isActive: false,
    });
    const log = await ChangeLogModel.findOne({ action: 'amenity_updated' }).lean();
    expect(log!.changes).toMatchObject({
      name: ['Lift', 'Lift / Elevator'],
      isActive: [true, false],
    });

    const back = await patch({ appliesToAll: false });
    expect(back.status).toBe(400); // "some" needs at least one subcategory
    expect((await patch({ name: 'Gym' })).body.error.code).toBe('DUPLICATE_NAME');
  });

  it('reorders the checklist and rejects an incomplete or outdated list', async () => {
    const ids = residential(await read()).amenities.map((a) => a.id);
    const put = (list: string[]) =>
      as('admin', request(ctx.app).put(`${BASE}/categories/residential/amenities/order`)).send({
        ids: list,
      });
    const reversed = [...ids].reverse();
    const res = await put(reversed);
    expect(res.status).toBe(200);
    expect(residential(res.body.data).amenities.map((a) => a.id)).toEqual(reversed);
    expect((await put(ids.slice(1))).body.error.code).toBe('STALE_ORDER');
    expect((await put([...ids.slice(1), ids[1]!])).body.error.code).toBe('STALE_ORDER');
  });

  it('deleting a subcategory takes it off amenities; "set up later" categories are blocked', async () => {
    const created = await as('admin', request(ctx.app).post(`${BASE}/subcategories`)).send({
      categoryKey: 'residential',
      name: 'Farm house',
      codePrefix: 'FRM',
      purposes: ['sale'],
    });
    const farm = subId(created.body.data, 'Farm house');
    const pool = amenity(created.body.data, 'Swimming pool');
    await as('admin', request(ctx.app).patch(`${BASE}/amenities/${pool.id}`)).send({
      subcategoryIds: [...pool.subcategoryIds, farm],
    });
    const after = await as('admin', request(ctx.app).delete(`${BASE}/subcategories/${farm}`));
    expect(amenity(after.body.data, 'Swimming pool').subcategoryIds).toEqual(pool.subcategoryIds);

    const commercial = await as(
      'admin',
      request(ctx.app).post(`${BASE}/categories/commercial/amenities`),
    ).send({ name: 'Loading bay' });
    expect(commercial.status).toBe(422);
  });
});

describe('amenity rules that depend on existing properties', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  const ticked: PropertyUsage = {
    countBySubcategory: async () => new Map(),
    isAttributeUsed: async () => false,
    countByAmenity: async (ids) => new Map(ids.map((id) => [id, 5])),
  };
  const service = new PropertyTypesService({ usage: ticked });
  const ACTOR = '0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60';

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
  });

  it("shows how many properties use an amenity, and won't delete a used one", async () => {
    const gym = amenity(await service.getAll(), 'Gym');
    expect(gym.propertyCount).toBe(5);
    await expect(service.deleteAmenity(ACTOR, gym.id)).rejects.toMatchObject({
      status: 422,
      message: expect.stringMatching(/Deactivate it instead/),
    });
    const after = await service.updateAmenity(ACTOR, gym.id, { isActive: false });
    expect(amenity(after, 'Gym').isActive).toBe(false);
  });
});
