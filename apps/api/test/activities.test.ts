import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { EMAIL, login, setup, teardown, type Agent } from './helpers';
import { parseWhen } from '../src/ai/rules';

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
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe('appointments and activities', () => {
  it("shows an executive's day: overdue first, today, new leads, gaps", async () => {
    const d = (await priya.get('/api/activities/today')).body;
    expect(d.overdue.map((a: { lead: { name: string } }) => a.lead.name)).toContain('Mohammed Irfan');
    expect(d.today.map((a: { lead: { name: string } }) => a.lead.name)).toEqual(expect.arrayContaining(['Ramesh Krishnan', 'Sangeetha Raman']));
    expect(d.newLeads.map((l: { name: string }) => l.name)).toContain('Vignesh Babu');
    expect(d.noNextStep.map((l: { name: string }) => l.name)).toContain('Usha Rani');
    expect([...d.overdue, ...d.today].every((a: { owner: { name: string } }) => a.owner.name === 'Priya Sundar')).toBe(true);
  });

  it('a lead’s next step follows its earliest planned activity', async () => {
    const usha = await find(priya, 'Usha');
    expect(usha.nextAction).toBeFalsy();
    await priya.post('/api/activities').send({ leadId: usha.id, type: 'call', scheduledAt: inHours(30) });
    await priya.post('/api/activities').send({ leadId: usha.id, type: 'whatsapp', scheduledAt: inHours(6), title: 'Send Saravanampatti options' });
    const after = await find(priya, 'Usha');
    expect(after.nextAction.title).toBe('Send Saravanampatti options');
  });

  it('flags a clashing visit, and allows it when asked', async () => {
    const lakshmi = await find(priya, 'Lakshmi');
    const tl = (await priya.get(`/api/leads/${lakshmi.id}/timeline`)).body.items;
    const visit = tl.find((t: { status: string; type: string }) => t.status === 'planned' && t.type === 'site_visit');
    const fathimaOwnerIsDivya = await find(priya, 'Ramesh');
    const clash = await priya.post('/api/activities').send({ leadId: fathimaOwnerIsDivya.id, type: 'meeting', scheduledAt: new Date(new Date(visit.at).getTime() + 15 * 60_000).toISOString() });
    expect(clash.status).toBe(409);
    expect(clash.body.error).toMatch(/Lakshmi/);
    const forced = await priya.post('/api/activities').send({ leadId: fathimaOwnerIsDivya.id, type: 'meeting', scheduledAt: new Date(new Date(visit.at).getTime() + 15 * 60_000).toISOString(), force: true });
    expect(forced.status).toBe(201);
  });

  it('completing a visit records feedback on the shortlist, warms the lead, and plans what’s next', async () => {
    const anitha = await find(arun, 'Anitha');
    const tl = (await arun.get(`/api/leads/${anitha.id}/timeline`)).body.items;
    const visit = tl.find((t: { status: string; type: string }) => t.status === 'planned' && t.type === 'site_visit');
    const r = await arun.post(`/api/activities/${visit.id}/complete`).send({
      outcome: 'Visited',
      feedback: { interest: 'Very interested', liked: 'Pool, high floor', concerns: 'Maintenance charges' },
      next: { type: 'meeting', scheduledAt: inHours(48), notes: 'Bring the price sheet' },
    });
    expect(r.status).toBe(200);
    expect(r.body.needsNextStep).toBe(false);
    const lead = (await arun.get(`/api/leads/${anitha.id}`)).body.lead;
    expect(lead.temperature).toBe('hot');
    expect(lead.shortlist[0].status).toBe('liked');
    expect(lead.nextAction.type).toBe('meeting');
  });

  it('asks for a next step when the last plan is done; reschedule and cancel keep history', async () => {
    const sangeetha = await find(priya, 'Sangeetha');
    const call = (await priya.get(`/api/leads/${sangeetha.id}/timeline`)).body.items.find((t: { status: string }) => t.status === 'planned');
    const moved = await priya.post(`/api/activities/${call.id}/reschedule`).send({ scheduledAt: inHours(26), reason: 'Customer travelling' });
    expect(moved.body.activity.rescheduledFrom).toBeTruthy();
    const done = await priya.post(`/api/activities/${call.id}/complete`).send({ outcome: 'Interested', notes: 'Prefers Guduvanchery now' });
    expect(done.body.needsNextStep).toBe(true);
    expect((await priya.post(`/api/activities/${call.id}/cancel`).send({ reason: 'x' })).status).toBe(400);
  });

  it('keeps executives out of others’ calendars; managers see who is behind', async () => {
    const ramesh = await find(priya, 'Ramesh');
    const a = (await priya.get(`/api/leads/${ramesh.id}/timeline`)).body.items.find((t: { status: string }) => t.status === 'planned');
    expect((await arun.post(`/api/activities/${a.id}/cancel`).send({ reason: 'nope' })).status).toBe(404);
    const team = (await manager.get('/api/activities/team')).body;
    expect(team.overdue.map((o: { name: string }) => o.name)).toEqual(expect.arrayContaining(['Priya Sundar', 'Arun Kumar']));
    expect((await priya.get('/api/activities/team')).status).toBe(403);
  });

  it('understands times the way people say them', () => {
    const mon = new Date('2026-11-23T09:00:00+05:30'); // a Monday morning
    expect(parseWhen('tomorrow at 11am', mon)?.toString()).toBe(new Date('2026-11-24T11:00:00+05:30').toString());
    expect(parseWhen('sat 4:30 pm', mon)?.toString()).toBe(new Date('2026-11-28T16:30:00+05:30').toString());
    expect(parseWhen('call at 4', mon)?.toString()).toBe(new Date('2026-11-23T16:00:00+05:30').toString());
    expect(parseWhen('on 3 dec morning', mon)?.toString()).toBe(new Date('2026-12-03T10:00:00+05:30').toString());
    expect(parseWhen('call him', mon)).toBeNull();
  });

  it('assistant (offline) schedules by name and lists gaps', async () => {
    const r = await priya.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Schedule a call with Vignesh tomorrow at 11am' }] });
    expect(r.body.reply).toMatch(/Call with Vignesh Babu planned for Tomorrow/);
    const gaps = await manager.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Show leads without follow-ups' }] });
    expect(gaps.body.reply).toMatch(/nothing planned/);
    const who = await manager.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Which sales executives have overdue follow-ups?' }] });
    expect(who.body.reply).toMatch(/overdue, oldest/);
  });
});
