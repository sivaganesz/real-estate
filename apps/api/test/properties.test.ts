import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { EMAIL, login, setup, teardown, type Agent } from './helpers';
import { callTool, type AssistantReply } from '../src/ai/assistant';
import { toolsFor } from '../src/ai/tools';
import { User } from '../src/models/user';

let app: Express;
let manager: Agent;
let exec: Agent;
beforeAll(async () => {
  app = await setup();
  manager = await login(app, EMAIL.manager);
  exec = await login(app, EMAIL.priya);
});
afterAll(teardown);

describe('properties', () => {
  it('only managers and admins add properties', async () => {
    const res = await exec.post('/api/properties').send({ type: 'plot', city: 'Chennai' });
    expect(res.status).toBe(403);
  });

  it('executives see live properties only', async () => {
    const all = await manager.get('/api/properties?listing=draft');
    expect(all.body.total).toBeGreaterThan(0);
    const mine = await exec.get('/api/properties?listing=draft');
    expect(mine.body.items.every((p: { listing: string }) => p.listing === 'live')).toBe(true);
  });

  it('keeps a draft until the key facts are known, then publishes', async () => {
    const created = await manager.post('/api/properties').send({ type: 'apartment', city: 'Chennai', locality: 'Kodambakkam', price: 9500000, area: 1300, details: { bedrooms: 3 } });
    expect(created.status).toBe(201);
    const p = created.body.property;
    expect(p.listing).toBe('draft');
    expect(p.title).toBe('3 BHK Apartment in Kodambakkam');
    expect(p.readiness.missing.map((m: { label: string }) => m.label)).toEqual(['Floor']);

    const early = await manager.post(`/api/properties/${p.id}/listing`).send({ to: 'live' });
    expect(early.status).toBe(400);
    expect(early.body.error).toMatch(/Floor/);

    await manager.patch(`/api/properties/${p.id}`).send({ details: { floor: 5 } }).expect(200);
    const live = await manager.post(`/api/properties/${p.id}/listing`).send({ to: 'live' });
    expect(live.body.property.listing).toBe('live');

    const history = await manager.get(`/api/properties/${p.id}/history`);
    expect(history.body.items.map((h: { action: string }) => h.action)).toEqual(['listing', 'update', 'create']);
  });

  it('flags a likely duplicate instead of creating it', async () => {
    const res = await manager.post('/api/properties').send({ type: 'apartment', city: 'Chennai', locality: 'Velachery', price: 7200000, area: 1050, details: { bedrooms: 2, floor: 2 } });
    expect(res.status).toBe(409);
    expect(res.body.details.duplicates[0].title).toMatch(/Velachery/);
  });

  it('gives the list page counts per status and how many leads fit each listing', async () => {
    const r = (await manager.get('/api/properties?standalone=true&withCounts=true&withFit=true&limit=200')).body;
    expect(r.counts.all).toBe(r.counts.available + r.counts.held + r.counts.booked + r.counts.sold + r.counts.draft);
    expect(r.items.every((p: { projectId: string | null }) => !p.projectId)).toBe(true);
    expect(r.items.every((p: { fitCount: number }) => typeof p.fitCount === 'number')).toBe(true);
    expect(r.items.some((p: { fitCount: number }) => p.fitCount > 0)).toBe(true);
    // Executives see live listings only, so no drafts or archived in their counts.
    const e = (await exec.get('/api/properties?withCounts=true')).body;
    expect(e.counts.draft).toBe(0);
    expect(e.counts.archived).toBe(0);
    // Size, purpose and locality filters.
    const big = (await manager.get('/api/properties?areaMin=2000&smart=false')).body.items;
    expect(big.every((p: { areaSqft: number }) => p.areaSqft >= 2000)).toBe(true);
    const rent = (await manager.get('/api/properties?purpose=rent')).body.items;
    expect(rent.every((p: { purpose: string }) => p.purpose === 'rent')).toBe(true);
  });

  it('understands plain-language search', async () => {
    const res = await exec.get('/api/properties?q=' + encodeURIComponent('2 bhk under 70 lakhs in porur'));
    expect(res.body.understood).toEqual(['2 BHK', 'up to ₹70,00,000', 'Porur']);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const p of res.body.items) {
      expect(p.details.bedrooms).toBe(2);
      expect(p.price).toBeLessThanOrEqual(7_000_000);
      expect(p.locality).toBe('Porur');
    }
  });

  it('reads plurals and assumes buying when the budget is in lakhs', async () => {
    const res = await exec.get('/api/properties?q=' + encodeURIComponent('available plots under 40 lakhs'));
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const p of res.body.items) {
      expect(p.type).toBe('plot');
      expect(p.purpose).toBe('sale');
      expect(p.availability).toBe('available');
    }
  });

  it('needs a reason to mark booked by hand; holds expire', async () => {
    const list = await manager.get('/api/properties?q=Chromepet&smart=false');
    const id = list.body.items[0].id;
    const booked = await manager.post(`/api/properties/${id}/availability`).send({ to: 'booked' });
    expect(booked.status).toBe(400);
    const held = await manager.post(`/api/properties/${id}/availability`).send({ to: 'held', heldUntil: new Date(Date.now() - 1000).toISOString() });
    expect(held.body.property.availability).toBe('held');
    const after = await manager.get(`/api/properties/${id}`);
    expect(after.body.property.availability).toBe('available');
  });

  it('builds a project grid and reports inventory', async () => {
    const proj = await manager.post('/api/projects').send({ name: 'Test Towers', type: 'apartment', city: 'Chennai', locality: 'Ashok Nagar' });
    const id = proj.body.project._id;
    const gen = await manager.post(`/api/projects/${id}/units`).send({ block: 'C', floorFrom: 1, floorTo: 3, unitsPerFloor: 2, bedrooms: 2, area: 1000, price: 8000000, floorRise: 100000 });
    expect(gen.body.created).toBe(6);
    const again = await manager.post(`/api/projects/${id}/units`).send({ block: 'C', floorFrom: 1, floorTo: 3, unitsPerFloor: 2, bedrooms: 2, area: 1000, price: 8000000 });
    expect(again.body).toEqual({ created: 0, skipped: 6 });
    const pub = await manager.post(`/api/projects/${id}/publish-ready`);
    expect(pub.body.published).toBe(6);
    const detail = await manager.get(`/api/projects/${id}`);
    const top = detail.body.units.find((u: { unitNumber: string }) => u.unitNumber === 'C302');
    expect(top.price).toBe(8_200_000);
  });

  it('share page never shows internal notes', async () => {
    const list = await manager.get('/api/properties?q=Thiruporur&smart=false');
    const id = list.body.items[0].id;
    await manager.patch(`/api/properties/${id}`).send({ extras: [{ label: 'Coconut trees', value: '120' }, { label: 'Owner phone', value: '98400 12345', internal: true }] }).expect(200);
    const share = await exec.post(`/api/properties/${id}/share`);
    const pub = await request(app).get(`/api/public/properties/${share.body.token}`);
    expect(pub.status).toBe(200);
    expect(JSON.stringify(pub.body)).not.toMatch(/98400/);
    expect(pub.body.property.extras).toEqual([{ label: 'Coconut trees', value: '120' }]);
  });

  it('reads a description into fields with sources (offline reader)', async () => {
    const res = await manager.post('/api/properties/extract').send({ text: '2 BHK flat for sale in Porur, Chennai, 980 sq.ft, 3rd floor, east facing, price 62 lakhs, RERA registered, lift and car parking' });
    expect(res.body.mode).toBe('offline');
    const p = res.body.properties[0];
    expect(p).toMatchObject({ type: 'apartment', purpose: 'sale', price: 6_200_000, area: 980, areaUnit: 'sqft', locality: 'Porur', city: 'Chennai' });
    expect(p.details).toMatchObject({ bedrooms: 2, floor: 3, facing: 'East' });
    expect(p.approvals).toContain('RERA');
    expect(p.sources.price).toMatch(/62 lakhs/);
    expect(p.readiness.ready).toBe(true);
  });
});

describe('assistant and properties', () => {
  it('gives each role only its tools', async () => {
    const exec = await User.findOne({ email: EMAIL.priya }).lean();
    const names = toolsFor({ id: String(exec!._id), name: exec!.name, role: 'executive' }).map((t) => t.name);
    expect(names).toContain('search_properties');
    expect(names).not.toContain('create_draft_property');
    expect(names).not.toContain('publish_property');
  });

  it('answers a property search in offline mode with record links', async () => {
    const res = await exec.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Find 2 BHK apartments under 70 lakhs in Porur' }] });
    expect(res.body.reply).toMatch(/Found \d+/);
    expect(res.body.records.length).toBeGreaterThan(0);
    expect(res.body.records[0].kind).toBe('property');
  });

  it('proposes publishing and only acts after confirmation', async () => {
    const m = await User.findOne({ email: EMAIL.manager }).lean();
    const actor = { id: String(m!._id), name: m!.name, role: 'manager' as const };
    const draft = await manager.post('/api/properties').send({ type: 'plot', city: 'Chennai', locality: 'Pallavaram', price: 4000000, area: 1200, details: { length: 40, width: 30 } });
    const id = draft.body.property.id;
    const out: AssistantReply = { mode: 'gemini', reply: '', records: [], proposals: [], done: [] };
    const r = await callTool('publish_property', { propertyId: id }, { actor: { ...actor, viaAI: true } }, out);
    expect(JSON.parse(r.content).status).toBe('waiting_for_user_confirmation');
    expect((await manager.get(`/api/properties/${id}`)).body.property.listing).toBe('draft');

    const confirmed = await manager.post(`/api/ai/proposals/${out.proposals[0].id}/confirm`);
    expect(confirmed.status).toBe(200);
    expect((await manager.get(`/api/properties/${id}`)).body.property.listing).toBe('live');
    const again = await manager.post(`/api/ai/proposals/${out.proposals[0].id}/confirm`);
    expect(again.status).toBe(409);
    const history = await manager.get(`/api/properties/${id}/history`);
    expect(history.body.items[0].viaAI).toBe(true);
  });
});
