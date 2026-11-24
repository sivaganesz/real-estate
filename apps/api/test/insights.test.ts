import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { EMAIL, login, setup, teardown, type Agent } from './helpers';

let app: Express;
let manager: Agent;
beforeAll(async () => {
  app = await setup();
  manager = await login(app, EMAIL.manager);
});
afterAll(teardown);

describe('business insights', () => {
  it('ranks properties by interest and lists the ignored ones', async () => {
    const r = (await manager.get('/api/insights/interest')).body;
    expect(r.top.length).toBeGreaterThan(3);
    for (let i = 1; i < r.top.length; i++) expect(r.top[i].score).toBeLessThanOrEqual(r.top[i - 1].score);
    expect(r.top[0].property.title).toBeTruthy();
  });

  it('measures sales pace per project and flags slow movers', async () => {
    const r = (await manager.get('/api/insights/movement')).body;
    const palm = r.projects.find((p: { name: string }) => p.name === 'Palm Grove Villas');
    const sunrise = r.projects.find((p: { name: string }) => p.name === 'Sunrise Enclave');
    expect(palm.slow).toBe(true);
    expect(sunrise.movedInWindow).toBeGreaterThan(palm.movedInWindow);
    expect(r.projects[0].slow).toBe(true);
  });

  it('answers both questions offline', async () => {
    const a = await manager.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Which properties receive the most enquiries?' }] });
    expect(a.body.reply).toMatch(/Most interest/);
    const b = await manager.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Which projects have low inventory movement?' }] });
    expect(b.body.reply).toMatch(/Palm Grove Villas\*\* ⚠ slow/);
  });
});

describe('admin overview', () => {
  it('gives the admin stock, people, imports and recent changes', async () => {
    const admin = await login(app, EMAIL.admin);
    const r = (await admin.get('/api/insights/overview')).body;
    expect(r.stock.available).toBeGreaterThan(0);
    expect(r.stock.availableValue).toBeGreaterThan(0);
    expect(r.people.some((p: { role: string }) => p.role === 'executive')).toBe(true);
    expect(Array.isArray(r.imports)).toBe(true);
    expect(r.recent.length).toBeGreaterThan(0);
  });

  it('is admin only', async () => {
    expect((await manager.get('/api/insights/overview')).status).toBe(403);
  });
});
