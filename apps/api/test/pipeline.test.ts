import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { EMAIL, login, setup, teardown, type Agent } from './helpers';
import { Activity } from '../src/models/lead';

let app: Express;
let manager: Agent;
let priya: Agent;
beforeAll(async () => {
  app = await setup();
  manager = await login(app, EMAIL.manager);
  priya = await login(app, EMAIL.priya);
});
afterAll(teardown);

const find = async (agent: Agent, name: string) => (await agent.get('/api/leads?q=' + encodeURIComponent(name))).body.items[0];

describe('sales pipeline', () => {
  it('refuses forward moves without the evidence, and says what is missing', async () => {
    const vignesh = await find(priya, 'Vignesh');
    const r1 = await priya.post(`/api/pipeline/move/${vignesh.id}`).send({ to: 'qualified' });
    expect(r1.status).toBe(422);
    expect(r1.body.details.need).toBe('conversation');

    const sangeetha = await find(priya, 'Sangeetha');
    const r2 = await priya.post(`/api/pipeline/move/${sangeetha.id}`).send({ to: 'visit' });
    expect(r2.status).toBe(422);
    expect(r2.body.details.need).toBe('visit');
  });

  it('needs a property to start negotiating, and puts it on the shortlist', async () => {
    const lakshmi = await find(priya, 'Lakshmi');
    const r1 = await priya.post(`/api/pipeline/move/${lakshmi.id}`).send({ to: 'negotiation' });
    expect(r1.body.details.need).toBe('property');
    const villa = (await priya.get('/api/properties?q=Palm Grove&smart=false&availability=available')).body.items[0];
    const r2 = await priya.post(`/api/pipeline/move/${lakshmi.id}`).send({ to: 'negotiation', propertyId: villa.id });
    expect(r2.body.lead.stage).toBe('negotiation');
    expect(r2.body.lead.shortlist.find((s: { propertyId: string }) => s.propertyId === villa.id)).toMatchObject({ status: 'liked' });
  });

  it('never drags into Booked; only a booking does that', async () => {
    const ramesh = await find(priya, 'Ramesh');
    const r = await priya.post(`/api/pipeline/move/${ramesh.id}`).send({ to: 'booked' });
    expect(r.body.details.need).toBe('booking');
  });

  it('closes as lost only with a reason, cancels what was planned, and can reopen', async () => {
    const irfan = await find(priya, 'Irfan');
    await Activity.create({ leadId: irfan.id, type: 'call', status: 'planned', scheduledAt: new Date(Date.now() + 86_400_000) });
    expect((await priya.post(`/api/pipeline/move/${irfan.id}`).send({ to: 'lost' })).body.details.need).toBe('reason');
    const lost = await priya.post(`/api/pipeline/move/${irfan.id}`).send({ to: 'lost', reason: 'Bought elsewhere', note: 'Took a flat in Vadapalani' });
    expect(lost.body.lead).toMatchObject({ stage: 'lost', lostReason: 'Bought elsewhere' });
    expect(await Activity.countDocuments({ leadId: irfan.id, status: 'planned' })).toBe(0);
    const back = await priya.post(`/api/pipeline/move/${irfan.id}`).send({ to: 'contacted' });
    expect(back.body.lead.stage).toBe('contacted');
    expect(back.body.lead.lostReason).toBeUndefined();
  });

  it('shows a board scoped to the person, with recent bookings and losses', async () => {
    const cols = (await priya.get('/api/pipeline/board')).body.columns;
    expect(cols.map((c: { stage: string }) => c.stage)).toEqual(['new', 'contacted', 'qualified', 'visit', 'negotiation', 'booked', 'lost']);
    const all = cols.flatMap((c: { leads: { ownerName: string }[] }) => c.leads);
    expect(all.every((l: { ownerName: string }) => l.ownerName === 'Priya Sundar')).toBe(true);
    const mgr = (await manager.get('/api/pipeline/board')).body.columns.flatMap((c: { leads: unknown[] }) => c.leads);
    expect(mgr.length).toBeGreaterThan(all.length);
  });

  it('explains where the pipeline leaks', async () => {
    const r = (await manager.get('/api/pipeline/insights')).body;
    expect(r.funnel[0].count).toBe(r.total);
    for (let i = 1; i < r.funnel.length; i++) expect(r.funnel[i].count).toBeLessThanOrEqual(r.funnel[i - 1].count);
    expect(r.booked).toBeGreaterThanOrEqual(2);
    expect(r.lostReasons.map((l: { reason: string }) => l.reason)).toEqual(expect.arrayContaining(['Budget mismatch', 'Not reachable']));
    expect(r.team.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(['Priya Sundar', 'Arun Kumar', 'Divya Raman']));
    const off = await manager.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Where are deals getting stuck?' }] });
    expect(off.body.reply).toMatch(/Weakest step/);
  });
});
