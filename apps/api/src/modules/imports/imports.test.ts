import type { ImportBatchDetail, PropertyTypes } from '@real-estate/shared';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../lib/logger';
import { hashPassword } from '../../lib/password';
import { buildTestApp, startTestDatabase } from '../../test/helpers';
import { PropertyMediaService } from '../properties/media.service';
import { PropertiesService } from '../properties/properties.service';
import { CounterModel, PropertyModel } from '../properties/property.model';
import { propertyUsage } from '../properties/propertyUsage';
import { ensureStartingPropertyTypes } from '../propertyTypes/propertyTypes.defaults';
import {
  AmenityModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
} from '../propertyTypes/propertyTypes.model';
import { PropertyTypesService } from '../propertyTypes/propertyTypes.service';
import { UserModel } from '../users/user.model';
import { ImportBatchModel } from './importBatch.model';
import { ImportsService } from './imports.service';

const PASSWORD = 'correct-horse-9';
const BASE = '/api/v1/admin/imports';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MODELS = [
  UserModel,
  PropertyModel,
  CounterModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
  AmenityModel,
  ImportBatchModel,
];

type Row = Record<string, string | number>;

const VALID: Row = {
  'Property name': '3 BHK villa with garden',
  Purpose: 'Sale',
  'Price (₹)': 12500000,
  Area: 5,
  'Area unit': 'cent',
  City: 'Chennai',
  'Area / locality': 'Tambaram',
  Pincode: '600045',
  BHK: '3 bhk',
  Bathrooms: 3,
  Amenities: 'Gated community, power backup',
};

/** Fills the downloaded template: header names → values (extra headers are added at the end). */
async function fill(template: Buffer, rows: Row[], extraHeader?: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template as unknown as ArrayBuffer);
  const sheet = wb.getWorksheet('Properties')!;
  const headers = new Map<string, number>();
  sheet
    .getRow(1)
    .eachCell((cell, col) => headers.set(String(cell.value).replace(/\s*\*$/, ''), col));
  if (extraHeader) {
    const col = sheet.getRow(1).cellCount + 1;
    sheet.getRow(1).getCell(col).value = extraHeader;
    headers.set(extraHeader, col);
  }
  rows.forEach((row, i) => {
    for (const [name, value] of Object.entries(row)) {
      const col = headers.get(name);
      if (!col) throw new Error(`No column "${name}"`);
      sheet.getRow(i + 2).getCell(col).value = value;
    }
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('bulk import', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  const tokens: Record<string, string> = {};
  let villaId: string;
  let adminId: string;

  const as = (role: string, req: request.Test) =>
    req.set('authorization', `Bearer ${tokens[role]}`);
  const template = async () => {
    const res = await as('admin', request(ctx.app).get(`${BASE}/template?subcategoryId=${villaId}`))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    return res;
  };
  const upload = (file: Buffer, role = 'admin') =>
    as(role, request(ctx.app).post(`${BASE}?subcategoryId=${villaId}`)).attach('file', file, {
      filename: 'villas.xlsx',
      contentType: XLSX,
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
    const types: PropertyTypes = (
      await as('admin', request(ctx.app).get('/api/v1/admin/property-types'))
    ).body.data;
    villaId = types.categories[0]!.subcategories.find((s) => s.name === 'Villa / House')!.id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it('gives an Excel template with the subcategory columns, dropdowns and instructions', async () => {
    const res = await template();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(XLSX);
    expect(res.headers['content-disposition']).toContain('villa-house-import-template.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Properties', 'Lists', 'Instructions']);
    const headers = (wb.getWorksheet('Properties')!.getRow(1).values as string[]).slice(1);
    expect(headers.slice(0, 2)).toEqual(['Property name *', 'Purpose *']);
    expect(headers).toEqual(
      expect.arrayContaining(['Facing', 'BHK', 'Built-up area (sq.ft)', 'Amenities', 'Image URLs']),
    );
    const purposeCol = headers.indexOf('Purpose *') + 1;
    expect(
      wb.getWorksheet('Properties')!.getRow(2).getCell(purposeCol).dataValidation,
    ).toMatchObject({ type: 'list' });
    expect(wb.getWorksheet('Lists')!.state).toBe('veryHidden');
  });

  it('checks every row: valid, invalid (with column names) and duplicates; nothing is saved yet', async () => {
    // An existing property that one row repeats
    await as('admin', request(ctx.app).post('/api/v1/admin/properties')).send({
      subcategoryId: villaId,
      title: 'Corner villa near temple',
      purpose: 'sale',
      location: { city: 'Chennai', locality: 'Tambaram', pincode: '600045' },
    });
    const file = await fill(
      (await template()).body,
      [
        VALID,
        {
          ...VALID,
          'Property name': 'Bad villa',
          Pincode: '12345',
          BHK: '7 BHK',
          'Price (₹)': 'lots',
          Negotiable: 'maybe',
        },
        { ...VALID }, // same as row 2
        { ...VALID, 'Property name': 'corner VILLA near temple' }, // same as the existing one
        { 'Property name': 'Plot', Purpose: 'Rent' },
      ],
      'Agent notes',
    );
    const res = await upload(file);
    expect(res.status).toBe(201);
    const batch: ImportBatchDetail = res.body.data;
    expect(batch).toMatchObject({
      fileName: 'villas.xlsx',
      subcategoryName: 'Villa / House',
      status: 'checked',
      rowCount: 5,
      validCount: 1,
      invalidCount: 2,
      duplicateCount: 2,
      unknownColumns: ['Agent notes'],
      createdBy: { id: adminId, name: 'Asha Admin' },
    });
    const [ok, bad, dupInFile, dupExisting, short] = batch.rows;
    expect(ok).toMatchObject({
      row: 2,
      status: 'valid',
      title: '3 BHK villa with garden',
      price: 12500000,
      errors: [],
    });
    expect(bad!.errors).toEqual(
      expect.arrayContaining([
        'Price (₹): "lots" isn\'t a number',
        'Negotiable: use Yes or No',
        'Pincode: Enter a valid 6-digit pincode',
      ]),
    );
    expect(dupInFile).toMatchObject({ status: 'duplicate', duplicateOf: { row: 2, id: null } });
    expect(dupExisting!.duplicateOf).toMatchObject({ code: 'RE-VIL-000001', row: null });
    expect(short!.errors).toContain('Property name: Property name must be at least 5 characters');
    expect(await PropertyModel.countDocuments()).toBe(1); // only the existing one
  });

  it('imports valid rows as Draft, skips duplicates, keeps each row outcome, and only once', async () => {
    const file = await fill((await template()).body, [
      VALID,
      VALID,
      { ...VALID, 'Property name': 'Second villa', Pincode: 'x' },
    ]);
    const batch: ImportBatchDetail = (await upload(file)).body.data;
    const res = await as('admin', request(ctx.app).post(`${BASE}/${batch.id}/commit`)).send({
      importAs: 'draft',
      duplicates: 'skip',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.result).toEqual({
      created: 1,
      updated: 0,
      skipped: 2,
      failed: 0,
      savedAsDraft: 0,
      imagesAdded: 0,
      imagesFailed: 0,
    });
    expect(res.body.data.rows.map((r: { outcome: string }) => r.outcome)).toEqual([
      'Created RE-VIL-000001',
      'Skipped: same as row 2',
      'Not imported: fix the errors and upload again',
    ]);
    const created = await PropertyModel.findOne({ code: 'RE-VIL-000001' }).lean();
    expect(created).toMatchObject({
      status: 'draft',
      area: { value: 5, unit: 'cent', sqft: 2178 },
      attributeValues: { bhk: '3 BHK', bathrooms: 3 },
      createdBy: adminId,
    });
    expect(created!.amenityIds).toHaveLength(2);

    const again = await as('admin', request(ctx.app).post(`${BASE}/${batch.id}/commit`)).send({
      importAs: 'draft',
      duplicates: 'skip',
    });
    expect(again.body.error.code).toBe('ALREADY_IMPORTED');

    const history = await as('admin', request(ctx.app).get(BASE));
    expect(history.body.data[0]).toMatchObject({
      id: batch.id,
      status: 'imported',
      rowCount: 3,
      importAs: 'draft',
    });
    expect(history.body.meta.total).toBe(1);
  });

  it('updates duplicates when asked; Published without a photo is saved as Draft with a reason', async () => {
    const first = await fill((await template()).body, [VALID]);
    const b1: ImportBatchDetail = (await upload(first)).body.data;
    await as('admin', request(ctx.app).post(`${BASE}/${b1.id}/commit`)).send({
      importAs: 'draft',
      duplicates: 'skip',
    });

    const second = await fill((await template()).body, [{ ...VALID, 'Price (₹)': 11000000 }]);
    const b2: ImportBatchDetail = (await upload(second)).body.data;
    expect(b2.rows[0]!.status).toBe('duplicate');
    const res = await as('admin', request(ctx.app).post(`${BASE}/${b2.id}/commit`)).send({
      importAs: 'published',
      duplicates: 'update',
    });
    expect(res.body.data.result).toMatchObject({ updated: 1, created: 0, savedAsDraft: 1 });
    expect(res.body.data.rows[0].outcome).toBe(
      'Updated RE-VIL-000001 (saved as Draft: Add at least one photo)',
    );
    expect((await PropertyModel.findOne({ code: 'RE-VIL-000001' }).lean())!.price!.amount).toBe(
      11000000,
    );
  });

  it('updating a duplicate changes only the filled cells; empty cells keep the existing details', async () => {
    const types: PropertyTypes = (
      await as('admin', request(ctx.app).get('/api/v1/admin/property-types'))
    ).body.data;
    const amenity = types.categories[0]!.amenities.find((a) => a.name === 'Gated community')!.id;
    const created = await as('admin', request(ctx.app).post('/api/v1/admin/properties')).send({
      subcategoryId: villaId,
      title: '3 BHK villa with garden',
      purpose: 'sale',
      price: { amount: 12_500_000, negotiable: true },
      area: { value: 2100, unit: 'sqft' },
      location: {
        city: 'Chennai',
        locality: 'Tambaram',
        pincode: '600045',
        address: 'No. 14, Gandhi Street',
        landmark: 'Temple',
        mapPin: { lat: 12.92, lng: 80.1 },
      },
      attributeValues: { bhk: '3 BHK', bathrooms: 3, facing: 'East', floors: 2 },
      amenityIds: [amenity],
    });
    expect(created.status).toBe(201);

    // The sheet row fills only the matching columns and a new price.
    const file = await fill((await template()).body, [
      {
        'Property name': '3 BHK villa with garden',
        Purpose: 'Sale',
        'Price (₹)': 11_000_000,
        City: 'Chennai',
        'Area / locality': 'Tambaram',
        Pincode: '600045',
        Bathrooms: 4,
      },
    ]);
    const batch: ImportBatchDetail = (await upload(file)).body.data;
    expect(batch.rows[0]!.status).toBe('duplicate');
    await as('admin', request(ctx.app).post(`${BASE}/${batch.id}/commit`)).send({
      importAs: 'draft',
      duplicates: 'update',
    });

    const after = (await PropertyModel.findOne({ code: 'RE-VIL-000001' }).lean())!;
    expect(after.price).toMatchObject({ amount: 11_000_000, negotiable: true }); // changed / kept
    expect(after.area).toMatchObject({ value: 2100, unit: 'sqft' });
    expect(after.location).toMatchObject({
      address: 'No. 14, Gandhi Street',
      landmark: 'Temple',
      mapPin: { lat: 12.92, lng: 80.1 },
    });
    expect(after.attributeValues).toEqual({
      bhk: '3 BHK',
      bathrooms: 4,
      facing: 'East',
      floors: 2,
    });
    expect(after.amenityIds).toEqual([amenity]);
  });

  it('an updated Sold property stays Sold, even when importing as Published', async () => {
    const created = await as('admin', request(ctx.app).post('/api/v1/admin/properties')).send({
      subcategoryId: villaId,
      title: 'Sold villa',
      purpose: 'sale',
      price: { amount: 9_000_000 },
      area: { value: 1800, unit: 'sqft' },
      location: { city: 'Chennai', locality: 'Velachery', pincode: '600042' },
      attributeValues: { bhk: '3 BHK' },
    });
    expect(created.status).toBe(201);
    await PropertyModel.updateOne({ _id: created.body.data.id }, { $set: { status: 'sold' } });

    const file = await fill((await template()).body, [
      {
        'Property name': 'Sold villa',
        Purpose: 'Sale',
        'Price (₹)': 9_500_000,
        City: 'Chennai',
        'Area / locality': 'Velachery',
        Pincode: '600042',
      },
    ]);
    const batch: ImportBatchDetail = (await upload(file)).body.data;
    expect(batch.rows[0]!.status).toBe('duplicate');
    const done: ImportBatchDetail = (
      await as('admin', request(ctx.app).post(`${BASE}/${batch.id}/commit`)).send({
        importAs: 'published',
        duplicates: 'update',
      })
    ).body.data;
    expect(done.result).toMatchObject({ updated: 1, savedAsDraft: 0 });

    const after = (await PropertyModel.findById(created.body.data.id).lean())!;
    expect(after.status).toBe('sold');
    expect(after.price?.amount).toBe(9_500_000);
  });

  it('gives an error report with the rows to fix and an Errors column', async () => {
    const file = await fill((await template()).body, [
      VALID,
      { ...VALID, 'Property name': 'Bad villa', Pincode: '1' },
    ]);
    const batch: ImportBatchDetail = (await upload(file)).body.data;
    const res = await as('admin', request(ctx.app).get(`${BASE}/${batch.id}/error-report`))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as ArrayBuffer);
    const sheet = wb.getWorksheet('Properties')!;
    expect(sheet.rowCount).toBe(2);
    expect(sheet.getRow(1).getCell(1).value).toBe('Errors');
    expect(String(sheet.getRow(2).getCell(1).value)).toContain(
      'Pincode: Enter a valid 6-digit pincode',
    );
    expect(sheet.getRow(2).getCell(2).value).toBe(3); // spreadsheet row
    expect(sheet.getRow(2).getCell(3).value).toBe('Bad villa');
  });

  it('rejects wrong files, and only roles with imports:run can import', async () => {
    const notExcel = await as(
      'admin',
      request(ctx.app).post(`${BASE}?subcategoryId=${villaId}`),
    ).attach('file', Buffer.from('a,b'), { filename: 'data.csv', contentType: 'text/csv' });
    expect(notExcel.body.error.code).toBe('INVALID_FILE_TYPE');
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Sheet1').addRow(['Name', 'Price']);
    const wrong = await upload(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(wrong.body.error.code).toBe('WRONG_TEMPLATE');
    const empty = await upload((await template()).body);
    expect(empty.body.error.code).toBe('EMPTY_FILE');
    expect(
      (await as('sales_agent', request(ctx.app).get(`${BASE}/template?subcategoryId=${villaId}`)))
        .status,
    ).toBe(403);
    expect((await upload((await template()).body, 'sales_agent')).status).toBe(403);
  });
});

describe('bulk import photos', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;

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
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it('downloads photo links, publishes complete rows, and reports links that failed', async () => {
    const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' });
    const propertyTypes = new PropertyTypesService({ usage: propertyUsage });
    const properties = new PropertiesService({ propertyTypes, storage: ctx.storage });
    const media = new PropertyMediaService({ properties, storage: ctx.storage, logger });
    const jpg = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#4a7c59' },
    })
      .jpeg()
      .toBuffer();
    const fetchImpl = vi.fn<typeof fetch>(async (url) =>
      String(url).includes('missing') ? new Response('gone', { status: 404 }) : new Response(jpg),
    );
    const imports = new ImportsService({
      propertyTypes,
      properties,
      media,
      storage: ctx.storage,
      logger,
      fetchImpl,
      resolveHost: async () => ['93.184.216.34'],
    });
    const villa = (await PropertySubcategoryModel.findOne({ codePrefix: 'VIL' }).lean())!;
    const actor = '0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60';

    const file = await fill((await imports.template(villa._id)).data, [
      {
        ...VALID,
        'Image URLs': 'https://cdn.example.com/front.jpg, https://cdn.example.com/missing.jpg',
      },
    ]);
    const batch = await imports.check(actor, villa._id, {
      buffer: file,
      originalname: 'villas.xlsx',
    });
    const done = await imports.commit(actor, batch.id, {
      importAs: 'published',
      duplicates: 'skip',
    });

    expect(done.result).toMatchObject({
      created: 1,
      imagesAdded: 1,
      imagesFailed: 1,
      savedAsDraft: 0,
    });
    expect(done.rows[0]!.outcome).toBe(
      'Created RE-VIL-000001 (photo 2 skipped: the link answered 404)',
    );
    const p = (await PropertyModel.findOne({ code: 'RE-VIL-000001' }).lean())!;
    expect(p.status).toBe('published');
    expect(p.media).toHaveLength(1);
    expect(p.media[0]).toMatchObject({ kind: 'image', isCover: true, originalName: 'front.jpg' });
  });
});
