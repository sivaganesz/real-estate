import { CRORE } from './format';
import { isQualified, type Requirement, type Stage } from './sales';
import type { Temperature } from './leads';

/** A budget at or above this marks a likely high-net-worth buyer. */
export const HNI_BUDGET = 2 * CRORE;

export const BUYER_SEGMENTS = ['hni', 'investor', 'qualified', 'general'] as const;
export type BuyerSegment = (typeof BUYER_SEGMENTS)[number];
export const SEGMENT_LABEL: Record<BuyerSegment, string> = { hni: 'Potential HNI', investor: 'Investor', qualified: 'Qualified buyer', general: 'General lead' };

/** Who this buyer is, in one word for the list: a big budget first, then investors, then qualified buyers. */
export function buyerSegment(r: Partial<Requirement> | null | undefined): BuyerSegment {
  if ((r?.budgetMax ?? r?.budgetMin ?? 0) >= HNI_BUDGET) return 'hni';
  if (r?.intent === 'investment') return 'investor';
  if (isQualified(r)) return 'qualified';
  return 'general';
}

/** "ready to buy", "buying in 3 months": the timeline as it reads after the score. */
export const TIMELINE_SHORT: Record<string, string> = {
  immediate: 'ready to buy',
  '3_months': 'buying in 3 months',
  '6_months': 'buying in 6 months',
  exploring: 'just exploring',
};

const STAGE_POINTS: Record<Stage, number> = { new: 0, contacted: 6, qualified: 12, visit: 18, negotiation: 22, booked: 25, lost: 0 };
const TIMELINE_POINTS: Record<string, number> = { immediate: 20, '3_months': 14, '6_months': 8, exploring: 2 };
const FINANCING_POINTS: Record<string, number> = { own_funds: 15, loan_approved: 15, loan: 8, unknown: 3 };
const TEMPERATURE_POINTS: Record<Temperature, number> = { hot: 10, warm: 5, cold: 0 };

type ScoreInput = { requirement?: Partial<Requirement> | null; stage: Stage; temperature: Temperature; overdue?: boolean; stale?: boolean };

export const SCORE_PARTS = ['requirement', 'timeline', 'payment', 'stage', 'interest'] as const;
export type ScorePart = (typeof SCORE_PARTS)[number];
export const SCORE_PART_MAX: Record<ScorePart, number> = { requirement: 30, timeline: 20, payment: 15, stage: 25, interest: 10 };
export const SCORE_PART_LABEL: Record<ScorePart, string> = { requirement: 'Requirement', timeline: 'Timeline', payment: 'Payment', stage: 'Stage', interest: 'Interest' };

/** The score's five parts, before any points lost to slipping follow-ups. */
export function scoreParts(l: ScoreInput): Record<ScorePart, number> {
  const r = l.requirement ?? {};
  return {
    requirement: (r.budgetMax || r.budgetMin ? 10 : 0) + (r.city || r.localities?.length ? 10 : 0) + (r.types?.length ? 10 : 0),
    timeline: r.timeline ? TIMELINE_POINTS[r.timeline] ?? 0 : 5,
    payment: r.financing ? FINANCING_POINTS[r.financing] ?? 0 : 3,
    stage: STAGE_POINTS[l.stage],
    interest: TEMPERATURE_POINTS[l.temperature],
  };
}

/**
 * How ready this buyer is, 0 to 100. Points for what we know (budget,
 * location, type: 30), how soon (20), how they pay (15), how far along the
 * sale is (25) and how keen they sound (10); less when follow-ups slip.
 */
export function leadScore(l: ScoreInput): number {
  if (l.stage === 'lost') return 0;
  const p = scoreParts(l);
  const s = SCORE_PARTS.reduce((t, k) => t + p[k], 0) - (l.overdue ? 5 : 0) - (l.stale ? 5 : 0);
  return Math.max(0, Math.min(100, s));
}

/** Buyers at or above this are the hot ones to call first. */
export const HOT_SCORE = 80;

export type ScoreBand = 'high' | 'qualified' | 'nurture' | 'early' | 'closed';
export const SCORE_BAND_LABEL: Record<ScoreBand, string> = { high: 'High-priority lead', qualified: 'Qualified lead', nurture: 'Needs nurturing', early: 'Early stage lead', closed: 'Closed' };
export function scoreBand(score: number, stage?: Stage): ScoreBand {
  if (stage === 'booked' || stage === 'lost') return 'closed';
  return score >= HOT_SCORE ? 'high' : score >= 60 ? 'qualified' : score >= 40 ? 'nurture' : 'early';
}
