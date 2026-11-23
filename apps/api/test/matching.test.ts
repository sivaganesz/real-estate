import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { EMAIL, login, setup, teardown, type Agent } from './helpers';
import { scoreMatch } from '../src/services/matching';

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

const find = async (agent: Agent, name: string) => (await agent.get('/api/leads?q=' + encodeURIComponent(name))).body.items[0];
const base = { _id: 'p1', type: 'apartment', purpose: 'sale', listing: 'live', availability: 'available', city: 'Chennai', locality: 'Porur', areaSqft: 1080, amenities: ['Lift', 'Car parking'], details: { bedrooms: 2, facing: 'East' }, approvals: [] } as const;

describe('property matching', () => {
  it('explains a fit in plain reasons and labels it, with no raw score shown', () => {
    const m = scoreMatch({ types: ['apartment'], bedrooms: 2, budgetMax: 7_500_000, localities: ['Porur'], mustHaves: ['Lift', 'East facing'] }, { ...base, price: 6_800_000 } as never)!;
    expect(m.fit).toBe('strong');
    expect(m.reasons.map((r) => r.text)).toEqual(expect.arrayContaining(['₹68 L, within budget (up to ₹75 L)', 'In Porur, a preferred area', '2 BHK as wanted', 'Lift', 'East facing']));
  });

  it('says how far over budget, and drops what is way over, wrong type, sold or rejected', () => {
    const over = scoreMatch({ types: ['apartment'], budgetMax: 6_500_000, localities: ['Porur'] }, { ...base, price: 6_900_000 } as never)!;
    expect(over.reasons.find((r) => r.ok === 'near')?.text).toMatch(/₹4 L over budget \(6%\)/);
    expect(scoreMatch({ budgetMax: 5_000_000 }, { ...base, price: 6_900_000 } as never)).toBeNull();
    expect(scoreMatch({ types: ['plot'] }, { ...base, price: 1 } as never)).toBeNull();
    expect(scoreMatch({}, { ...base, availability: 'sold' } as never)).toBeNull();
    expect(scoreMatch({}, { ...base, price: 6_000_000 } as never, [{ propertyId: 'p1', status: 'rejected' }])).toBeNull();
    const fewer = scoreMatch({ bedrooms: 3 }, { ...base, price: 6_000_000 } as never);
    expect(fewer).toBeNull();
  });

  it('finds properties for a customer, best first, without a project flooding the list', async () => {
    const ramesh = await find(priya, 'Ramesh');
    const r = (await priya.get(`/api/matching/lead/${ramesh.id}`)).body;
    expect(r.qualified).toBe(true);
    expect(r.items.length).toBeGreaterThan(1);
    expect(r.items[0].fit).not.toBe('partial');
    for (const m of r.items) {
      expect(m.property.type).toBe('apartment');
      expect(m.property.price).toBeLessThanOrEqual(7_500_000 * 1.2);
    }
    const perProject = new Map<string, number>();
    for (const m of r.items) if (m.property.projectId) perProject.set(m.property.projectId, (perProject.get(m.property.projectId) ?? 0) + 1);
    expect(Math.max(0, ...perProject.values())).toBeLessThanOrEqual(2);
  });

  it('finds buyers for a property, only among the customers you can see', async () => {
    const plot = (await manager.get('/api/properties?q=Sunrise Enclave&smart=false&availability=available')).body.items[0];
    const all = (await manager.get(`/api/matching/property/${plot.id}`)).body.items;
    expect(all.map((i: { lead: { name: string } }) => i.lead.name)).toEqual(expect.arrayContaining(['Suresh Kumar', 'Sangeetha Raman']));
    const arunsView = (await arun.get(`/api/matching/property/${plot.id}`)).body.items;
    expect(arunsView.every((i: { lead: { owner: string } }) => i.lead.owner === 'Arun Kumar')).toBe(true);
  });

  it('sharing logs it, shortlists it and returns a ready message; rejecting removes it from matches', async () => {
    const irfan = await find(priya, 'Irfan');
    const m = (await priya.get(`/api/matching/lead/${irfan.id}`)).body.items;
    const [a, b] = [m[0].property.id, m[1].property.id];
    const s = (await priya.post(`/api/matching/share/${irfan.id}`).send({ propertyIds: [a, b] })).body;
    expect(s.message).toMatch(/^Hi Mohammed, as discussed, here are 2 options/);
    expect(s.links[0].url).toMatch(/\/p\/[\w-]+$/);
    const tl = (await priya.get(`/api/leads/${irfan.id}/timeline`)).body.items;
    expect(tl[0].title).toMatch(/Shared 2 properties/);
    await priya.post(`/api/matching/shortlist/${irfan.id}`).send({ propertyId: a, status: 'rejected' });
    const again = (await priya.get(`/api/matching/lead/${irfan.id}`)).body.items.map((x: { property: { id: string } }) => x.property.id);
    expect(again).not.toContain(a);
    const bInfo = (await priya.get(`/api/matching/lead/${irfan.id}`)).body.items.find((x: { property: { id: string } }) => x.property.id === b);
    expect(bInfo.reasons.some((r: { text: string }) => /Already shared/.test(r.text))).toBe(true);
  });

  it('suggests fresh best matches for Today, and the assistant explains matches offline', async () => {
    const today = (await priya.get('/api/matching/today')).body.items;
    expect(today.length).toBeGreaterThan(0);
    const ramesh = await find(priya, 'Ramesh');
    const r = await priya.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Find properties that fit them' }], context: { page: 'Lead', entity: 'lead', entityId: ramesh.id } });
    expect(r.body.reply).toMatch(/fit\. Best:/);
    expect(r.body.reply).toMatch(/✓/);
    expect(r.body.records[0].kind).toBe('property');
  });
});
