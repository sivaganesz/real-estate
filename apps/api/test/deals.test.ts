import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { EMAIL, login, setup, teardown, type Agent } from './helpers';

let app: Express;
let admin: Agent;
let manager: Agent;
let priya: Agent;
let arun: Agent;
beforeAll(async () => {
  app = await setup();
  admin = await login(app, EMAIL.admin);
  manager = await login(app, EMAIL.manager);
  priya = await login(app, EMAIL.priya);
  arun = await login(app, EMAIL.arun);
});
afterAll(teardown);

const L = 100_000;
const find = async (agent: Agent, name: string) => (await agent.get('/api/leads?q=' + encodeURIComponent(name))).body.items[0];
const avail = async (agent: Agent, q: string) => (await agent.get(`/api/properties?q=${encodeURIComponent(q)}&smart=false&availability=available`)).body.items;

describe('negotiations and bookings', () => {
  it('opens a negotiation on a property and moves the customer to Negotiation', async () => {
    const usha = await find(priya, 'Usha');
    const flat = (await avail(priya, 'Saravanampatti'))[0];
    const r = await priya.post('/api/deals').send({ leadId: usha.id, propertyId: flat.id, offer: 45 * L });
    expect(r.status).toBe(201);
    expect(r.body.deal).toMatchObject({ status: 'negotiating', listPrice: 48 * L, currentPrice: 45 * L });
    expect((await find(priya, 'Usha')).stage).toBe('negotiation');
    const again = await priya.post('/api/deals').send({ leadId: usha.id, propertyId: flat.id });
    expect(again.body.deal.id).toBe(r.body.deal.id);
  });

  it('agrees small discounts at once and sends bigger ones to the right approver', async () => {
    const usha = await find(priya, 'Usha');
    const deal = (await priya.get(`/api/deals?lead=${usha.id}`)).body.items[0];
    // 0.5% off: within an executive's 1%.
    const small = await priya.post(`/api/deals/${deal.id}/price`).send({ price: 47.76 * L });
    expect(small.body).toMatchObject({ needsApproval: false, deal: { status: 'approved', discountPct: 0.5 } });
    // 8% off: beyond a manager's 5%, so it goes to an admin.
    const big = await priya.post(`/api/deals/${deal.id}/price`).send({ price: 44.16 * L, note: 'Customer has a competing offer' });
    expect(big.body).toMatchObject({ needsApproval: true, deal: { status: 'approval', approval: { level: 'admin', discountPct: 8 } } });
    expect((await manager.post(`/api/deals/${deal.id}/decision`).send({ decision: 'approve' })).status).toBe(403);
    expect((await priya.post(`/api/deals/${deal.id}/decision`).send({ decision: 'approve' })).status).toBe(403);
    const waiting = (await admin.get('/api/deals/waiting')).body.approvals.map((d: { id: string }) => d.id);
    expect(waiting).toContain(deal.id);
    const counter = await admin.post(`/api/deals/${deal.id}/decision`).send({ decision: 'counter', counterPrice: 46 * L, note: 'Best we can do' });
    expect(counter.body.deal).toMatchObject({ status: 'negotiating', currentPrice: 46 * L });
  });

  it('lets a manager approve a discount within their limit, not their own request', async () => {
    const balaji = await find(manager, 'Balaji');
    const deal = (await manager.get(`/api/deals?lead=${balaji.id}`)).body.items[0];
    expect(deal.status).toBe('approval');
    expect((await manager.get('/api/deals/waiting')).body.approvals.map((d: { id: string }) => d.id)).toContain(deal.id);
    const ok = await manager.post(`/api/deals/${deal.id}/decision`).send({ decision: 'approve' });
    expect(ok.body.deal).toMatchObject({ status: 'approved', agreedPrice: 34.5 * L });
  });

  it('booking: executives send it, a manager confirms; unit booked, customer Booked, payment plan adds up, rivals closed', async () => {
    const lakshmi = await find(priya, 'Lakshmi');
    const villa = (await avail(priya, 'Palm Grove'))[0];
    // A rival negotiation on the same villa from another customer.
    const divakar = await find(manager, 'Divakar');
    await manager.post(`/api/leads/${divakar.id}/log`).send({ type: 'call', outcome: 'Interested' });
    const rival = (await manager.post('/api/deals').send({ leadId: divakar.id, propertyId: villa.id })).body.deal;

    const deal = (await priya.post('/api/deals').send({ leadId: lakshmi.id, propertyId: villa.id })).body.deal;
    await priya.post(`/api/deals/${deal.id}/price`).send({ price: villa.price });
    expect((await priya.post(`/api/deals/${deal.id}/book`).send({ amount: 5 * L, mode: 'Cheque' })).status).toBe(403);
    await priya.post(`/api/deals/${deal.id}/booking-request`).send({ amount: 5 * L, mode: 'Cheque', reference: 'ICICI 1201' });
    expect((await manager.get('/api/deals/waiting')).body.bookings.map((d: { id: string }) => d.id)).toContain(deal.id);

    const booked = await manager.post(`/api/deals/${deal.id}/book`).send({});
    expect(booked.body.closedRivals).toBe(1);
    const d = booked.body.deal;
    expect(d.status).toBe('booked');
    expect(d.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0)).toBe(villa.price);
    expect(d.payments[0]).toMatchObject({ label: 'Booking amount', amount: 5 * L, status: 'paid' });
    expect((await priya.get(`/api/properties/${villa.id}`)).body.property.availability).toBe('booked');
    expect((await find(priya, 'Lakshmi')).stage).toBe('booked');
    expect((await manager.get(`/api/deals/${rival.id}`)).body.deal).toMatchObject({ status: 'cancelled', cancelReason: 'Unit booked by another customer' });
  });

  it('records payments, registers the sale (unit sold), and cancelling a booking releases the unit', async () => {
    const kavya = await find(manager, 'Kavya');
    const k = (await manager.get(`/api/deals?lead=${kavya.id}`)).body.items[0];
    expect(k.paid).toBeGreaterThan(0);
    const after = await manager.post(`/api/deals/${k.id}/payments/2`).send({ reference: 'Disbursal 2' });
    expect(after.body.deal.payments[2].status).toBe('paid');
    const reg = await manager.post(`/api/deals/${k.id}/register`);
    expect(reg.body.deal.status).toBe('registered');
    expect((await manager.get(`/api/properties/${k.property.id}`)).body.property.availability).toBe('sold');

    const abdul = await find(manager, 'Abdul');
    const a = (await manager.get(`/api/deals?lead=${abdul.id}`)).body.items[0];
    const c = await manager.post(`/api/deals/${a.id}/cancel`).send({ reason: 'Loan rejected', then: 'lost' });
    expect(c.body.deal.status).toBe('cancelled');
    expect((await manager.get(`/api/properties/${a.property.id}`)).body.property.availability).toBe('available');
    expect((await find(manager, 'Abdul')).stage).toBe('lost');
  });

  it('dragging to Negotiation opens a deal; the money view and assistant see it', async () => {
    const irfan = await find(priya, 'Irfan');
    const flat = (await avail(priya, 'Green Meadows'))[0];
    await priya.post(`/api/pipeline/move/${irfan.id}`).send({ to: 'negotiation', propertyId: flat.id });
    const deals = (await priya.get(`/api/deals?lead=${irfan.id}`)).body.items;
    expect(deals[0]).toMatchObject({ status: 'negotiating', property: { id: flat.id } });
    const s = (await manager.get('/api/deals/summary')).body;
    expect(s.negotiating.count).toBeGreaterThan(0);
    expect(s.dueSoon.length).toBeGreaterThan(0);
    const ai = await manager.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'What approvals are waiting for me?' }] });
    expect(ai.body.reply).toMatch(/Bookings to confirm|Nothing is waiting/);
    const arunsDeals = (await arun.get('/api/deals')).body.items;
    expect(arunsDeals.every((d: { lead: { owner: string } }) => d.lead.owner === 'Arun Kumar')).toBe(true);
  });
});
