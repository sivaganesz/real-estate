import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { Express } from 'express';
import { EMAIL, login, setup, teardown, type Agent } from './helpers';

let app: Express;
let manager: Agent;
beforeAll(async () => {
  app = await setup();
  manager = await login(app, EMAIL.manager);
});
afterAll(teardown);

/** The kind of sheet an owner or broker actually sends. */
async function messySheet() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Nov list');
  ws.addRow(['ABC Realty — Available plots, November 2026']);
  ws.addRow([]);
  ws.addRow(['S.No', 'Location', 'Plot Size', 'Rate', 'Dimension', 'Facing', 'Owner remarks']);
  ws.addRow([1, 'Pallikaranai', '1200 sqft', '48 L', '30x40', 'E', 'Owner abroad, POA holder']);
  ws.addRow([2, 'Pallikaranai', '2400 sqft', '92 lakhs', '40x60', 'north', '']);
  ws.addRow([3, 'Perumbakkam', '1,500 sq.ft', 'call', '30x50', 'W', 'Rate not fixed']);
  ws.addRow([4, 'Pallikaranai', '1200 sqft', '48 L', '30x40', 'E', 'same as row 1']);
  ws.addRow(['Total', '', '', '', '', '', '']);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('bulk import', () => {
  it('reads an owner sheet: finds the headings, maps columns by rules, flags problems', async () => {
    const res = await manager.post('/api/imports').field('sender', 'ABC Realty').field('defaultType', 'plot').field('defaultCity', 'Chennai').attach('file', await messySheet(), 'abc-plots.xlsx');
    expect(res.status).toBe(201);
    const b = res.body.batch;
    expect(b.sheetName).toMatch(/Skipped 2 lines above the headings; Skipped a totals row/);
    const field = (h: string) => b.mapping.find((m: { header: string }) => m.header === h).field;
    expect(field('Location')).toBe('locality');
    expect(field('Plot Size')).toBe('area');
    expect(field('Rate')).toBe('price');
    expect(field('Dimension')).toBe('dimensions');
    expect(field('S.No')).toBe('ignore');
    expect(field('Owner remarks')).toBe('extra');
    expect(b.summary).toMatchObject({ total: 4, ready: 2, error: 1, duplicate: 1 });
    const first = b.rows[0];
    expect(first.values).toMatchObject({ type: 'plot', price: 4_800_000, area: 1200, locality: 'Pallikaranai', details: { width: 30, length: 40, facing: 'East' } });
    expect(first.values.extras).toEqual([{ label: 'Owner remarks', value: 'Owner abroad, POA holder', internal: true }]);
    expect(b.rows[2].issues[0]).toMatch(/Price "call"/);
    expect(b.rows[3].issues[0]).toMatch(/earlier row/);
  });

  it('lets the person fix a row on the Check screen, then imports and remembers the format', async () => {
    let b = (await manager.post('/api/imports').field('sender', 'ABC Realty').field('defaultType', 'plot').field('defaultCity', 'Chennai').attach('file', await messySheet(), 'abc-plots.xlsx')).body.batch;
    b = (await manager.patch(`/api/imports/${b.id}/rows/2`).send({ price: '56 L' })).body.batch;
    expect(b.rows[2].status).toBe('ready');
    const done = (await manager.post(`/api/imports/${b.id}/commit`).send({ asLive: true, duplicates: 'skip' })).body.batch;
    expect(done.counts).toEqual({ imported: 3, updated: 0, skipped: 1, failed: 0 });
    const list = await manager.get('/api/properties?q=Pallikaranai&smart=false');
    expect(list.body.items.filter((p: { listing: string }) => p.listing === 'live').length).toBe(2);

    // Second file from the same sender: the saved format is used.
    const again = (await manager.post('/api/imports').field('sender', 'abc realty').field('defaultType', 'plot').attach('file', await messySheet(), 'abc-dec.xlsx')).body.batch;
    expect(again.sheetName).toMatch(/saved format recognised/);
    expect(again.mapping.every((m: { how: string }) => ['saved', 'rule', 'template'].includes(m.how))).toBe(true);
    // Everything already exists now, so those rows come back as duplicates.
    expect(again.summary.duplicate).toBeGreaterThanOrEqual(3);
    const csv = await manager.get(`/api/imports/${again.id}/errors.csv`);
    expect(csv.text).toMatch(/Problems/);
  });

  it("reads the previous system's template (several tabs, starred headings, units column)", async () => {
    const buf = fs.readFileSync(path.join(__dirname, 'fixtures/old-template-plots.xlsx'));
    const b = (await manager.post('/api/imports').attach('file', buf, 'old-template.xlsx')).body.batch;
    expect(b.sheetName).toMatch(/^Properties/);
    const field = (h: string) => b.mapping.find((m: { header: string }) => m.header === h)?.field;
    expect(field('Property name *')).toBe('title');
    expect(field('Area / locality')).toBe('locality');
    expect(field('Plot dimensions *')).toBe('dimensions');
    expect(field('Area unit')).toBe('areaUnit');
    const tambaram = b.rows.find((r: { values: { locality: string } }) => r.values.locality === 'Tambaram');
    expect(tambaram.values).toMatchObject({ type: 'plot', price: 2_450_000, area: 1200, areaUnit: 'sqft' });
    const lease = b.rows.find((r: { values: { purpose: string } }) => r.values.purpose === 'lease');
    expect(lease).toBeTruthy();
    expect(b.summary.total).toBeGreaterThan(5);
  });

  it('imports once even when Import is pressed twice at the same moment', async () => {
    const csv = 'Title,Type,For,Price,Area,City,Locality,BHK,Floor\n"3 BHK, double click test",Apartment,Sale,1.3 Cr,1500,Chennai,Adyar,3,5\n';
    const b = (await manager.post('/api/imports').attach('file', Buffer.from(csv), 'double.csv')).body.batch;
    const [one, two] = await Promise.all([manager.post(`/api/imports/${b.id}/commit`).send({ asLive: false, duplicates: 'skip' }), manager.post(`/api/imports/${b.id}/commit`).send({ asLive: false, duplicates: 'skip' })]);
    expect([one.status, two.status].sort()).toEqual([200, 409]);
    const found = (await manager.get('/api/properties?q=double%20click%20test&smart=false&listing=draft')).body;
    expect(found.items.filter((p: { title: string }) => /double click test/.test(p.title))).toHaveLength(1);
    // A late change to the mapping is refused once the import has run.
    expect((await manager.patch(`/api/imports/${b.id}/mapping`).send({ mapping: [] })).status).toBe(404);
  });

  it('accepts a CSV in our template and lets a column be remapped', async () => {
    const csv = 'Title,Type,For,Price,Area,City,Locality,BHK,Floor,My notes\n"2 BHK, sea view",Apartment,Sale,1.1 Cr,1200,Chennai,Besant Nagar,2,3,Key with watchman\n';
    let b = (await manager.post('/api/imports').attach('file', Buffer.from(csv), 'list.csv')).body.batch;
    expect(b.mapping.slice(0, 9).every((m: { how: string }) => m.how === 'template')).toBe(true);
    expect(b.rows[0].status).toBe('ready');
    expect(b.rows[0].values.price).toBe(11_000_000);
    b = (await manager.patch(`/api/imports/${b.id}/mapping`).send({ mapping: [{ column: 9, field: 'description' }] })).body.batch;
    expect(b.rows[0].values.description).toBe('Key with watchman');
  });

  it('serves a template and refuses executives', async () => {
    const t = await manager.get('/api/imports/template.xlsx');
    expect(t.status).toBe(200);
    const exec = await login(app, EMAIL.priya);
    expect((await exec.get('/api/imports')).status).toBe(403);
  });
});
