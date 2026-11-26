import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { plannedUnits, ProjectLayout } from '@estate/shared';
import { EMAIL, login, setup, teardown, type Agent } from './helpers';

let app: Express;
let manager: Agent;
let priya: Agent;
let arun: Agent;
beforeAll(async () => {
  app = await setup();
  manager = await login(app, EMAIL.manager);
  priya = await login(app, EMAIL.priya);
  arun = await login(app, EMAIL.arun);
});
afterAll(teardown);

const towers = {
  flatTypes: [{ type: '2 BHK', area: 1000 }, { type: '3 BHK', area: 1400 }],
  towers: [{ name: 'Tower A', code: 'A', floors: 3, plan: ['3 BHK', '2 BHK', '3 BHK'] }],
  pricing: { rate: 6000, floorRise: 100 },
};

describe('project layouts', () => {
  it('plans every unit from the layout: type per position, facing, floor rise, corner premium', () => {
    const u = plannedUnits('apartment', ProjectLayout.parse(towers));
    expect(u).toHaveLength(9);
    const a301 = u.find((x) => x.unitNumber === 'A301')!;
    expect(a301).toMatchObject({ kindLabel: '3 BHK', area: 1400, facing: 'East', bedrooms: 3, price: 1400 * 6200 });
    expect(u.find((x) => x.unitNumber === 'A102')).toMatchObject({ kindLabel: '2 BHK', facing: 'North', price: 6_000_000 });
    const plots = plannedUnits('plot', ProjectLayout.parse({ plotBlocks: [{ name: 'Block A', code: 'A', plots: [{ w: 30, l: 40 }, { w: 30, l: 40 }, { w: 30, l: 40 }] }], pricing: { rate: 3000, cornerPct: 5 } }));
    expect(plots.map((p) => [p.unitNumber, p.corner, p.price])).toEqual([['A-01', true, 3_780_000], ['A-02', false, 3_600_000], ['A-03', true, 3_780_000]]);
  });

  it('a draft project stays with managers; publishing puts complete units on sale', async () => {
    const p = (await manager.post('/api/projects').send({ name: 'Lotus Heights', type: 'apartment', city: 'Chennai', locality: 'Ashok Nagar', approvals: ['RERA'] })).body.project;
    const id = p._id;
    expect((await manager.post(`/api/projects/${id}/publish`).send({ published: true })).body.error).toMatch(/towers & floors/);
    const r = (await manager.put(`/api/projects/${id}/layout`).send(towers)).body;
    expect(r).toMatchObject({ created: 9, total: 9 });
    expect((await priya.get('/api/projects')).body.items.map((x: { name: string }) => x.name)).not.toContain('Lotus Heights');
    const pub = (await manager.post(`/api/projects/${id}/publish`).send({ published: true })).body;
    expect(pub).toMatchObject({ published: true, live: 9 });
    const view = (await priya.get(`/api/projects/${id}`)).body;
    expect(view.units).toHaveLength(9);
    expect(view.units[0].approvals).toEqual([{ name: 'RERA' }]);
    expect(view.project.completion.missing).toEqual([]);
  });

  it('writes a description for each new unit, fills empty ones, and keeps ones people wrote', async () => {
    const id = (await manager.get('/api/projects')).body.items.find((x: { name: string }) => x.name === 'Lotus Heights').id;
    const units = (await manager.get(`/api/projects/${id}`)).body.units as { id: string; unitNumber: string }[];
    const get = async (n: string) => (await manager.get(`/api/properties/${units.find((u) => u.unitNumber === n)!.id}`)).body.property;
    expect((await get('A301')).description).toMatch(/^3 BHK flat A301 on the 3rd floor in Tower A \(3 floors\) at Lotus Heights, Ashok Nagar\. 1,400 sq\.ft, east facing\./);

    const a102 = await get('A102');
    const a201 = await get('A201');
    await manager.patch(`/api/properties/${a102.id}`).send({ description: 'Owner-written note for buyers.' });
    await manager.patch(`/api/properties/${a201.id}`).send({ description: null });
    await manager.put(`/api/projects/${id}/layout`).send(towers);
    expect((await get('A102')).description).toBe('Owner-written note for buyers.');
    expect((await get('A201')).description).toMatch(/^3 BHK flat A201 on the 2nd floor/);
  });

  it('re-prices unsold units, keeps sold prices, and refuses to drop units with a buyer', async () => {
    const id = (await manager.get('/api/projects')).body.items.find((x: { name: string }) => x.name === 'Lotus Heights').id;
    const units = (await manager.get(`/api/projects/${id}`)).body.units;
    const a101 = units.find((u: { unitNumber: string }) => u.unitNumber === 'A101');
    await manager.post(`/api/properties/${a101.id}/availability`).send({ to: 'sold', reason: 'Sold before launch' });
    const r = (await manager.put(`/api/projects/${id}/layout`).send({ ...towers, pricing: { rate: 6500, floorRise: 100 } })).body;
    expect(r.updated).toBeGreaterThan(0);
    const after = (await manager.get(`/api/projects/${id}`)).body.units;
    expect(after.find((u: { unitNumber: string }) => u.unitNumber === 'A101').price).toBe(1400 * 6000);
    expect(after.find((u: { unitNumber: string }) => u.unitNumber === 'A102').price).toBe(1000 * 6500);

    // One floor fewer: A3xx units are all available, so they go. Removing the first floor would drop a sold unit.
    const shorter = await manager.put(`/api/projects/${id}/layout`).send({ ...towers, towers: [{ ...towers.towers[0], floors: 2 }] });
    expect(shorter.body).toMatchObject({ removed: 3, total: 6 });
    // Renaming the tower would remove every A unit, including the sold A101: refused, nothing changes.
    const renamed = await manager.put(`/api/projects/${id}/layout`).send({ ...towers, towers: [{ ...towers.towers[0], code: 'B', floors: 2 }] });
    expect(renamed.status).toBe(409);
    expect(renamed.body.details.lost).toEqual(['A101']);
    expect((await manager.get(`/api/projects/${id}`)).body.units).toHaveLength(6);
  });

  it('approval documents uploaded on the project reach every unit', async () => {
    const id = (await manager.get('/api/projects')).body.items.find((x: { name: string }) => x.name === 'Lotus Heights').id;
    const up = await manager.post(`/api/projects/${id}/approvals/RERA/document`).attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'rera.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(200);
    const units = (await manager.get(`/api/projects/${id}`)).body.units;
    expect(units.every((u: { approvals: { documentUrl?: string }[] }) => u.approvals[0].documentUrl?.startsWith('/uploads/documents/'))).toBe(true);
  });

  it('shows who each unit is with, but only names your own customers', async () => {
    const gm = (await manager.get('/api/projects')).body.items.find((x: { name: string }) => x.name === 'Green Meadows');
    const mgr = (await manager.get(`/api/projects/${gm.id}`)).body.deals;
    const names = Object.values(mgr).map((d) => (d as { customer: string }).customer);
    expect(names).toEqual(expect.arrayContaining(['Ramesh Krishnan', 'Kavya Prakash']));
    const arunView = (await arun.get(`/api/projects/${gm.id}`)).body.deals;
    expect(Object.values(arunView).every((d) => (d as { customer: string }).customer === 'Another customer')).toBe(true);
  });

  it('reading a layout drawing needs the AI key', async () => {
    const r = await manager.post('/api/projects/layout-from-map').attach('file', Buffer.from('%PDF-1.4'), { filename: 'layout.pdf', contentType: 'application/pdf' });
    expect(r.status).toBe(422);
    expect(r.body.error).toMatch(/Gemini key/);
  });
});
