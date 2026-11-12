import type { PropertyTypes } from '@real-estate/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password';
import { buildTestApp, startTestDatabase } from '../../test/helpers';
import { ChangeLogModel } from '../changeLogs/changeLog.model';
import { UserModel } from '../users/user.model';
import { ensureStartingPropertyTypes } from './propertyTypes.defaults';
import {
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
} from './propertyTypes.model';
import { PropertyTypesService } from './propertyTypes.service';
import type { PropertyUsage } from './propertyUsage';

const PASSWORD = 'correct-horse-9';
const BASE = '/api/v1/admin/property-types';

const residential = (data: PropertyTypes) => data.categories.find((c) => c.key === 'residential')!;
const sub = (data: PropertyTypes, name: string) =>
  residential(data).subcategories.find((s) => s.name === name)!;
const labels = (list: { label: string }[]) => list.map((a) => a.label);

describe('settings → property types (categories & attributes)', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  const tokens: Record<string, string> = {};
  let adminId: string;

  const as = (role: string, req: request.Test) =>
    req.set('authorization', `Bearer ${tokens[role]}`);
  const read = async (): Promise<PropertyTypes> =>
    (await as('admin', request(ctx.app).get(BASE))).body.data;

  beforeAll(async () => {
    db = await startTestDatabase();
    await Promise.all(
      [UserModel, PropertyAttributeModel, PropertyCategoryModel, PropertySubcategoryModel].map(
        (m) => m.syncIndexes(),
      ),
    );
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
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it('starts with Residential: 3 subcategories, their attributes and the common ones', async () => {
    const data = await read();
    expect(data.coreAttributes.map((a) => a.label)).toEqual([
      'Property name',
      'Purpose',
      'Price',
      'Area',
      'Location',
    ]);
    expect(data.categories.map((c) => [c.key, c.isActive])).toEqual([
      ['residential', true],
      ['commercial', false],
      ['other', false],
    ]);
    const res = residential(data);
    expect(labels(res.commonAttributes)).toEqual(['Facing', 'Ownership type', 'Description']);
    expect(
      res.subcategories.map((s) => [s.name, s.codePrefix, s.purposes, s.attributes.length]),
    ).toEqual([
      ['Residential Plot', 'PLT', ['sale', 'lease'], 7],
      ['Villa / House', 'VIL', ['sale', 'rent', 'lease'], 8],
      ['Apartment / Flat', 'APT', ['sale', 'rent', 'lease'], 11],
    ]);
    // Everything starts optional; shared attributes say where else they are used.
    const villa = sub(data, 'Villa / House');
    expect(villa.attributes.every((a) => !a.required)).toBe(true);
    expect(villa.attributes.find((a) => a.key === 'bhk')).toMatchObject({
      type: 'dropdown',
      options: ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK'],
      usedIn: ['Apartment / Flat'],
    });
    expect(villa.prefixLocked).toBe(false);
  });

  it('the starting setup is created once and never re-adds what an admin removed', async () => {
    const villa = sub(await read(), 'Villa / House');
    const floors = villa.attributes.find((a) => a.key === 'floors')!;
    await as(
      'admin',
      request(ctx.app).delete(`${BASE}/subcategories/${villa.id}/attributes/${floors.id}`),
    );
    expect(await ensureStartingPropertyTypes()).toBe('exists');
    expect(labels(sub(await read(), 'Villa / House').attributes)).not.toContain('Floors');
  });

  it('every role that views properties can read it; only settings:edit can change it', async () => {
    expect((await as('sales_agent', request(ctx.app).get(BASE))).status).toBe(200);
    expect((await request(ctx.app).get(BASE)).status).toBe(401);

    const villa = sub(await read(), 'Villa / House');
    const attempts = [
      request(ctx.app).post(`${BASE}/subcategories`).send({}),
      request(ctx.app).patch(`${BASE}/subcategories/${villa.id}`).send({ name: 'Villa' }),
      request(ctx.app).post(`${BASE}/categories/residential/attributes`).send({}),
      request(ctx.app).get(`${BASE}/attributes?q=bhk`),
    ];
    for (const attempt of attempts) expect((await as('sales_agent', attempt)).status).toBe(403);
  });

  it('adds a new attribute to a subcategory, with a key made from its name', async () => {
    const plot = sub(await read(), 'Residential Plot');
    const res = await as(
      'admin',
      request(ctx.app).post(`${BASE}/subcategories/${plot.id}/attributes`),
    ).send({
      source: 'new',
      label: 'Distance to highway',
      type: 'number',
      unit: 'km',
      options: ['ignored for numbers'],
      required: true,
    });
    expect(res.status).toBe(201);
    const added = sub(res.body.data, 'Residential Plot').attributes.at(-1);
    expect(added).toMatchObject({
      key: 'distance_to_highway',
      label: 'Distance to highway',
      type: 'number',
      unit: 'km',
      options: [],
      required: true,
      searchFilter: false,
      usedIn: [],
    });

    const log = await ChangeLogModel.findOne({
      entity: 'propertyType',
      action: 'attribute_added',
    }).lean();
    expect(log).toMatchObject({ actorId: adminId, entityId: plot.id });
  });

  it('stops duplicates: same name, same place, or both common and in a subcategory', async () => {
    const data = await read();
    const plot = sub(data, 'Residential Plot');
    const villa = sub(data, 'Villa / House');
    const post = (path: string, body: object) =>
      as('admin', request(ctx.app).post(path)).send(body);

    const sameName = await post(`${BASE}/subcategories/${plot.id}/attributes`, {
      source: 'new',
      label: '  corner   PLOT ',
      type: 'yes_no',
    });
    expect(sameName.status).toBe(409);
    expect(sameName.body.error.code).toBe('ATTRIBUTE_EXISTS');

    const bhk = villa.attributes.find((a) => a.key === 'bhk')!;
    const twice = await post(`${BASE}/subcategories/${villa.id}/attributes`, {
      source: 'existing',
      attributeId: bhk.id,
    });
    expect(twice.body.error.code).toBe('ALREADY_ADDED');

    const facing = residential(data).commonAttributes.find((a) => a.key === 'facing')!;
    const commonInSub = await post(`${BASE}/subcategories/${plot.id}/attributes`, {
      source: 'existing',
      attributeId: facing.id,
    });
    expect(commonInSub.status).toBe(409);
    expect(commonInSub.body.error.message).toMatch(/already a common attribute/);

    const subInCommon = await post(`${BASE}/categories/residential/attributes`, {
      source: 'existing',
      attributeId: bhk.id,
    });
    expect(subInCommon.status).toBe(409);
    expect(subInCommon.body.error.message).toContain('Villa / House and Apartment / Flat');
  });

  it('reuses an existing attribute in another subcategory and finds it by name', async () => {
    const data = await read();
    const villa = sub(data, 'Villa / House');
    const lift = sub(data, 'Apartment / Flat').attributes.find((a) => a.key === 'lift')!;

    const search = await as('admin', request(ctx.app).get(`${BASE}/attributes?q=LIF`));
    expect(search.body.data).toEqual([
      { id: lift.id, label: 'Lift', type: 'yes_no', usedIn: ['Apartment / Flat'] },
    ]);

    const res = await as(
      'admin',
      request(ctx.app).post(`${BASE}/subcategories/${villa.id}/attributes`),
    ).send({
      source: 'existing',
      attributeId: lift.id,
    });
    expect(res.status).toBe(201);
    expect(sub(res.body.data, 'Villa / House').attributes.at(-1)).toMatchObject({
      key: 'lift',
      usedIn: ['Apartment / Flat'],
    });
    expect(
      sub(res.body.data, 'Apartment / Flat').attributes.find((a) => a.key === 'lift')!.usedIn,
    ).toEqual(['Villa / House']);
  });

  it('editing the name or options changes it everywhere; "required" is per subcategory', async () => {
    const data = await read();
    const villa = sub(data, 'Villa / House');
    const bhk = villa.attributes.find((a) => a.key === 'bhk')!;
    const res = await as(
      'admin',
      request(ctx.app).patch(`${BASE}/subcategories/${villa.id}/attributes/${bhk.id}`),
    ).send({
      label: 'Bedrooms (BHK)',
      options: ['1 BHK', '2 BHK', '3 BHK', '4+ BHK'],
      required: true,
    });
    expect(res.status).toBe(200);

    const inVilla = sub(res.body.data, 'Villa / House').attributes.find((a) => a.id === bhk.id)!;
    const inApartment = sub(res.body.data, 'Apartment / Flat').attributes.find(
      (a) => a.id === bhk.id,
    )!;
    expect(inVilla).toMatchObject({ label: 'Bedrooms (BHK)', key: 'bhk', required: true });
    expect(inApartment).toMatchObject({
      label: 'Bedrooms (BHK)',
      options: ['1 BHK', '2 BHK', '3 BHK', '4+ BHK'],
    });
    expect(inApartment.required).toBe(false);

    const log = await ChangeLogModel.findOne({ action: 'attribute_updated' }).lean();
    expect(log!.changes).toMatchObject({
      'bhk.label': ['BHK', 'Bedrooms (BHK)'],
      'bhk.required': [false, true],
    });
  });

  it('checks edits: options for dropdowns, unique names, and only attributes used here', async () => {
    const data = await read();
    const plot = sub(data, 'Residential Plot');
    const road = plot.attributes.find((a) => a.key === 'road_width')!;
    const patch = (path: string, body: object) =>
      as('admin', request(ctx.app).patch(path)).send(body);

    const noOptions = await patch(`${BASE}/subcategories/${plot.id}/attributes/${road.id}`, {
      type: 'dropdown',
    });
    expect(noOptions.status).toBe(400);
    expect(noOptions.body.error.details[0]).toMatchObject({ path: 'body.options' });

    const repeated = await patch(`${BASE}/subcategories/${plot.id}/attributes/${road.id}`, {
      type: 'dropdown',
      options: ['30 ft', '30 FT'],
    });
    expect(repeated.body.error.details[0].message).toBe('"30 FT" is listed twice');

    const clash = await patch(`${BASE}/subcategories/${plot.id}/attributes/${road.id}`, {
      label: 'Layout name',
    });
    expect(clash.status).toBe(409);

    const villa = sub(data, 'Villa / House');
    const notHere = await patch(`${BASE}/subcategories/${villa.id}/attributes/${road.id}`, {
      required: true,
    });
    expect(notHere.status).toBe(404);
  });

  it('removing an attribute keeps it where else it is used, and deletes it once unused', async () => {
    const data = await read();
    const villa = sub(data, 'Villa / House');
    const bhk = villa.attributes.find((a) => a.key === 'bhk')!;
    const floors = villa.attributes.find((a) => a.key === 'floors')!;
    const del = (attributeId: string) =>
      as(
        'admin',
        request(ctx.app).delete(`${BASE}/subcategories/${villa.id}/attributes/${attributeId}`),
      );

    const res = await del(bhk.id);
    expect(res.status).toBe(200);
    expect(labels(sub(res.body.data, 'Villa / House').attributes)).not.toContain('BHK');
    expect(
      sub(res.body.data, 'Apartment / Flat').attributes.find((a) => a.id === bhk.id)!.usedIn,
    ).toEqual([]);
    expect(await PropertyAttributeModel.exists({ _id: bhk.id })).toBeTruthy();

    await del(floors.id); // only Villa used it
    expect(await PropertyAttributeModel.exists({ _id: floors.id })).toBeNull();
    expect(await ChangeLogModel.countDocuments({ action: 'attribute_removed' })).toBe(2);
  });

  it('manages common attributes: add, edit and remove for the whole category', async () => {
    const add = await as(
      'admin',
      request(ctx.app).post(`${BASE}/categories/residential/attributes`),
    ).send({
      source: 'new',
      label: 'Vastu compliant',
      type: 'yes_no',
      searchFilter: true,
    });
    expect(add.status).toBe(201);
    const vastu = residential(add.body.data).commonAttributes.at(-1)!;
    expect(vastu).toMatchObject({ key: 'vastu_compliant', searchFilter: true, usedIn: [] });

    const edit = await as(
      'admin',
      request(ctx.app).patch(`${BASE}/categories/residential/attributes/${vastu.id}`),
    ).send({ required: true });
    expect(residential(edit.body.data).commonAttributes.at(-1)!.required).toBe(true);

    const del = await as(
      'admin',
      request(ctx.app).delete(`${BASE}/categories/residential/attributes/${vastu.id}`),
    );
    expect(labels(residential(del.body.data).commonAttributes)).toEqual([
      'Facing',
      'Ownership type',
      'Description',
    ]);
  });

  it('adds and edits subcategories with unique names and 3-letter code prefixes', async () => {
    const create = (body: object) =>
      as('admin', request(ctx.app).post(`${BASE}/subcategories`)).send(body);

    const res = await create({
      categoryKey: 'residential',
      name: 'Farm house',
      codePrefix: 'frm',
      purposes: ['lease', 'sale'],
    });
    expect(res.status).toBe(201);
    const farm = sub(res.body.data, 'Farm house');
    expect(farm).toMatchObject({
      codePrefix: 'FRM',
      purposes: ['sale', 'lease'],
      isActive: true,
      attributes: [],
    });
    expect(residential(res.body.data).subcategories.at(-1)!.name).toBe('Farm house');

    expect(
      (
        await create({
          categoryKey: 'residential',
          name: 'villa / HOUSE',
          codePrefix: 'VLA',
          purposes: ['sale'],
        })
      ).body.error.code,
    ).toBe('DUPLICATE_NAME');
    expect(
      (
        await create({
          categoryKey: 'residential',
          name: 'Row house',
          codePrefix: 'VIL',
          purposes: ['sale'],
        })
      ).body.error.code,
    ).toBe('DUPLICATE_PREFIX');
    const invalid = await create({
      categoryKey: 'residential',
      name: 'R',
      codePrefix: 'AB1',
      purposes: [],
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['body.name', 'body.codePrefix', 'body.purposes']),
    );

    const edit = await as('admin', request(ctx.app).patch(`${BASE}/subcategories/${farm.id}`)).send(
      {
        name: 'Farm house / Estate',
        isActive: false,
      },
    );
    expect(sub(edit.body.data, 'Farm house / Estate')).toMatchObject({
      isActive: false,
      codePrefix: 'FRM',
    });
    const log = await ChangeLogModel.findOne({ action: 'subcategory_updated' }).lean();
    expect(log!.changes).toEqual({
      name: ['Farm house', 'Farm house / Estate'],
      isActive: [true, false],
    });

    const del = await as('admin', request(ctx.app).delete(`${BASE}/subcategories/${farm.id}`));
    expect(del.status).toBe(200);
    expect(residential(del.body.data).subcategories).toHaveLength(3);
  });

  it("Commercial and Other are 'set up later': they can't be changed yet", async () => {
    const sub1 = await as('admin', request(ctx.app).post(`${BASE}/subcategories`)).send({
      categoryKey: 'commercial',
      name: 'Shop',
      codePrefix: 'SHP',
      purposes: ['rent'],
    });
    expect(sub1.status).toBe(422);
    expect(sub1.body.error.message).toMatch(/Commercial is set up later/);
    const attr = await as(
      'admin',
      request(ctx.app).post(`${BASE}/categories/other/attributes`),
    ).send({
      source: 'new',
      label: 'Soil type',
      type: 'text',
    });
    expect(attr.status).toBe(422);
  });
});

describe('property type rules that depend on existing properties', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  const villaHas12: PropertyUsage = {
    countBySubcategory: async (ids) => {
      const villa = await PropertySubcategoryModel.findOne({ codePrefix: 'VIL' }).lean();
      return new Map(ids.filter((id) => id === villa?._id).map((id) => [id, 12]));
    },
    isAttributeUsed: async (key) => key === 'bhk' || key === 'floors',
  };
  const service = new PropertyTypesService({ usage: villaHas12 });
  const ACTOR = '0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60';

  beforeAll(async () => {
    db = await startTestDatabase();
    await Promise.all(
      [PropertyAttributeModel, PropertyCategoryModel, PropertySubcategoryModel].map((m) =>
        m.syncIndexes(),
      ),
    );
  });
  afterAll(async () => {
    await db.stop();
  });
  beforeEach(async () => {
    await db.clear();
    await ensureStartingPropertyTypes();
  });

  it('locks the code prefix and blocks deleting a subcategory that has properties', async () => {
    const villa = sub(await service.getAll(), 'Villa / House');
    expect(villa).toMatchObject({ propertyCount: 12, prefixLocked: true });
    await expect(
      service.updateSubcategory(ACTOR, villa.id, { codePrefix: 'VLA' }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'PREFIX_LOCKED',
    });
    // Other edits still work.
    const after = await service.updateSubcategory(ACTOR, villa.id, { purposes: ['sale', 'rent'] });
    expect(sub(after, 'Villa / House').purposes).toEqual(['sale', 'rent']);
    await expect(service.deleteSubcategory(ACTOR, villa.id)).rejects.toMatchObject({ status: 422 });
  });

  it('locks the value type of an attribute with values, and keeps it when removed', async () => {
    const villa = sub(await service.getAll(), 'Villa / House');
    const bhk = villa.attributes.find((a) => a.key === 'bhk')!;
    const floors = villa.attributes.find((a) => a.key === 'floors')!;
    await expect(
      service.updateAttribute(ACTOR, { kind: 'subcategory', id: villa.id }, bhk.id, {
        type: 'text',
      }),
    ).rejects.toMatchObject({ code: 'TYPE_LOCKED' });

    await service.removeAttribute(ACTOR, { kind: 'subcategory', id: villa.id }, floors.id);
    expect(await PropertyAttributeModel.exists({ _id: floors.id })).toBeTruthy(); // values still use it
  });
});
