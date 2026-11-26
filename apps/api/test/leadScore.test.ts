import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { buyerSegment, leadScore, scoreBand, scoreParts } from '@estate/shared';
import { EMAIL, login, setup, teardown } from './helpers';

const L = 100_000;
const CR = 10_000_000;

describe('lead score', () => {
  const ready = { types: ['apartment' as const], budgetMin: 60 * L, budgetMax: 80 * L, city: 'Chennai', timeline: 'immediate' as const, financing: 'loan_approved' as const };

  it('a known, keen buyer far along the sale scores high', () => {
    const s = leadScore({ requirement: ready, stage: 'negotiation', temperature: 'hot' });
    expect(s).toBe(30 + 20 + 15 + 22 + 10);
    expect(scoreBand(s)).toBe('high');
  });

  it('a fresh enquiry with nothing captured scores low, and slipping follow-ups cost points', () => {
    expect(leadScore({ requirement: {}, stage: 'new', temperature: 'warm' })).toBe(5 + 3 + 5);
    const onTime = leadScore({ requirement: ready, stage: 'qualified', temperature: 'warm' });
    expect(leadScore({ requirement: ready, stage: 'qualified', temperature: 'warm', overdue: true, stale: true })).toBe(onTime - 10);
  });

  it('lost leads score 0 and read as closed', () => {
    expect(leadScore({ requirement: ready, stage: 'lost', temperature: 'hot' })).toBe(0);
    expect(scoreBand(90, 'booked')).toBe('closed');
  });

  it('the five parts add up to the score', () => {
    expect(leadScore({ requirement: ready, stage: 'visit', temperature: 'hot' })).toBe(Object.values(scoreParts({ requirement: ready, stage: 'visit', temperature: 'hot' })).reduce((a, b) => a + b, 0));
  });

  it('names the buyer: big budgets first, then investors, then qualified buyers', () => {
    expect(buyerSegment({ ...ready, budgetMax: 3 * CR, intent: 'investment' })).toBe('hni');
    expect(buyerSegment({ ...ready, intent: 'investment' })).toBe('investor');
    expect(buyerSegment(ready)).toBe('qualified');
    expect(buyerSegment({ types: ['plot'] })).toBe('general');
  });
});

describe('leads list', () => {
  let app: Express;
  beforeAll(async () => {
    app = await setup();
  });
  afterAll(teardown);

  it('sends each lead with its score and buyer type', async () => {
    const manager = await login(app, EMAIL.manager);
    const items = (await manager.get('/api/leads?open=true&limit=300')).body.items as { name: string; score: number; segment: string; requirement: { intent?: string } }[];
    expect(items.length).toBeGreaterThan(5);
    for (const l of items) {
      expect(l.score).toBeGreaterThanOrEqual(0);
      expect(l.score).toBeLessThanOrEqual(100);
    }
    expect(items.find((l) => l.name === 'Suresh Kumar')).toMatchObject({ segment: 'investor', requirement: { intent: 'investment' } });
    expect(items.find((l) => l.name === 'Tarun Agarwal')?.segment).toBe('hni');
  });
});
