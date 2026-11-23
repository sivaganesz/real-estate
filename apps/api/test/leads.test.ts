import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
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

describe('customers and leads', () => {
  it('an executive’s new lead is theirs and starts as New', async () => {
    const res = await priya.post('/api/leads').send({ name: 'Ganesh P', phone: '98765 43210', source: 'walk_in', note: 'Walked in asking about plots' });
    expect(res.status).toBe(201);
    expect(res.body.lead).toMatchObject({ stage: 'new', phone: '+919876543210', ownerName: null });
    const me = (await priya.get('/api/auth/me')).body.user;
    expect(res.body.lead.ownerId).toBe(me.id);
  });

  it('recognises an existing customer by phone, however it is typed', async () => {
    const look = await arun.get('/api/leads/lookup?phone=' + encodeURIComponent('+91 98400 11001'));
    expect(look.body.existing).toMatchObject({ name: 'Ramesh Krishnan', owner: 'Priya Sundar', mine: false });
    const dup = await arun.post('/api/leads').send({ name: 'Ramesh K', phone: '9840011001' });
    expect(dup.status).toBe(409);
    expect(dup.body.details.existing.name).toBe('Ramesh Krishnan');
  });

  it('keeps executives to their own customers', async () => {
    const ramesh = (await manager.get('/api/leads?q=Ramesh')).body.items[0];
    expect((await arun.get(`/api/leads/${ramesh.id}`)).status).toBe(404);
    const mine = (await arun.get('/api/leads')).body.items;
    expect(mine.every((l: { ownerName: string }) => l.ownerName === 'Arun Kumar')).toBe(true);
  });

  it('moves New → Contacted on a conversation and → Qualified once budget, place and type are known', async () => {
    const created = (await priya.post('/api/leads').send({ name: 'Meera K', phone: '9000000001' })).body.lead;
    let lead = (await priya.post(`/api/leads/${created.id}/log`).send({ type: 'call', outcome: 'Not reachable' })).body.lead;
    expect(lead.stage).toBe('new');
    lead = (await priya.post(`/api/leads/${created.id}/log`).send({ type: 'call', outcome: 'Interested', notes: 'Wants 2 BHK' })).body.lead;
    expect(lead.stage).toBe('contacted');
    lead = (await priya.patch(`/api/leads/${created.id}`).send({ requirement: { types: ['apartment'], bedrooms: 2, budgetMax: 7000000, localities: ['Porur'] } })).body.lead;
    expect(lead.stage).toBe('qualified');
    const tl = (await priya.get(`/api/leads/${created.id}/timeline`)).body.items;
    expect(tl.some((t: { title: string }) => /Contacted → Qualified/.test(t.title))).toBe(true);
  });

  it('reads a requirement from a salesperson’s note', async () => {
    const r = await priya.post('/api/leads/parse-requirement').send({ text: '2-3 BHK near Porur or Valasaravakkam, 70-80 lakhs, home loan, wants to move in 3 months, east facing, gated' });
    expect(r.body.requirement).toMatchObject({ bedrooms: 2, budgetMin: 7_000_000, budgetMax: 8_000_000, financing: 'loan', timeline: '3_months', types: ['apartment'] });
    expect(r.body.requirement.localities).toContain('Porur');
    expect(r.body.requirement.mustHaves).toEqual(expect.arrayContaining(['East Facing', 'Gated community']));
  });

  it('managers assign and can spread unassigned leads evenly', async () => {
    const unassigned = (await manager.get('/api/leads?ownerId=none&open=true')).body;
    expect(unassigned.total).toBeGreaterThanOrEqual(4);
    expect((await priya.post('/api/leads/assign-evenly')).status).toBe(403);
    const r = await manager.post('/api/leads/assign-evenly');
    expect(r.body.assigned.length).toBe(unassigned.total);
    const owners = new Set(r.body.assigned.map((a: { owner: string }) => a.owner));
    expect(owners.size).toBeGreaterThan(1);
    expect((await manager.get('/api/leads?ownerId=none&open=true')).body.total).toBe(0);
  });

  it('a lost customer who calls again comes back as New, with history kept', async () => {
    const deepa = (await manager.get('/api/leads?q=Deepa')).body.items[0];
    expect(deepa.stage).toBe('lost');
    const r = await manager.post(`/api/leads/${deepa.id}/enquiries`).send({ source: 'phone', message: 'Budget is now 70 L' });
    expect(r.body.lead.stage).toBe('new');
    const tl = (await manager.get(`/api/leads/${deepa.id}/timeline`)).body.items;
    expect(tl.some((t: { title: string }) => /Bought a resale|Not interested/.test(t.title + (t as { body?: string }).body))).toBe(true);
  });

  it('assistant (offline) lists unassigned leads and summarises a customer', async () => {
    const ramesh = (await priya.get('/api/leads?q=Ramesh')).body.items[0];
    const s = await priya.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Summarise this customer' }], context: { page: 'Lead', entity: 'lead', entityId: ramesh.id } });
    expect(s.body.reply).toMatch(/Ramesh Krishnan/);
    expect(s.body.reply).toMatch(/Porur/);
    const other = await arun.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Summarise this customer' }], context: { page: 'Lead', entity: 'lead', entityId: ramesh.id } });
    expect(other.body.reply).toMatch(/not found/i);
  });
});
