/**
 * Purchase readiness and the four-check qualification card (foundation-plan §5.5).
 * Ported from wireframe-rebuild/src/lib/readiness.ts (the transparent 100-point "ready to buy" score:
 * budget fits a property 25 · clear requirement 20 · timeline 20 · funding 15 · decision-making authority 10 ·
 * engagement 10), plus the card that shows Budget / Decision maker / Requirement / Timeline as known or missing,
 * and the questions (with quick-pick chips) to ask only for what is missing. The UI never shows the word "BANT".
 */
import type { Authority, Lead, Need, Property, Settings, Timeline } from '@/domain/types'
import { PROPERTY_TYPES } from '@/domain/catalogue'
import { propertiesForLead } from './matching'

export type ReadinessKey = 'budget' | 'requirement' | 'timeline' | 'funding' | 'authority' | 'engagement'
export const READINESS_MAX: Record<ReadinessKey, number> = { budget: 25, requirement: 20, timeline: 20, funding: 15, authority: 10, engagement: 10 }

const NEED: Record<Need, number> = { clear: 1, partly: 0.5, exploring: 0.2 }
export const TIMELINE_WEIGHT: Record<Timeline, number> = { immediate: 1, m1to3: 0.8, m3to6: 0.5, m6to12: 0.25, exploring: 0 }
const FUNDING = { ready: 1, arranging: 0.55, undecided: 0 } as const
const LOAN = { preApproved: 1, notNeeded: 0.8, needed: 0.4, unknown: 0 } as const
const AUTHORITY: Record<Authority, number> = { sole: 1, joint: 0.7, needsApproval: 0.4 }

export type ReadinessBand = 'high' | 'qualified' | 'developing' | 'early'
/** One line of the 100-point score: what it measures, the points out of its maximum, and the answer behind them. */
export type ReadinessRow = { key: ReadinessKey; points: number; max: number; answer: string }

export type QualContext = { properties: Property[]; settings: Pick<Settings, 'matching'>; now: Date }

export function readiness(lead: Lead, ctx: QualContext): { total: number; band: ReadinessBand; rows: ReadinessRow[] } {
  const q = lead.qualification
  const e = lead.engagement
  const max = lead.requirement.budgetMax
  const fits = max ? propertiesForLead(lead, ctx.properties, ctx.settings, ctx.now) : []
  const budget = fits.some((m) => m.property.price <= (max ?? 0)) ? 1 : fits.length ? 0.5 : 0
  const funding = q.fundingReady ? FUNDING[q.fundingReady] : LOAN[q.loan]
  const authority = q.authority ? AUTHORITY[q.authority] : q.decisionMakers.length ? 0.5 : 0
  const engagement = (e.responded ? 0.3 : 0) + (e.docsRequested ? 0.3 : 0) + (e.siteVisited ? 0.4 : 0)
  const row = (key: ReadinessKey, share: number, answer: string): ReadinessRow => ({ key, points: Math.round(READINESS_MAX[key] * share), max: READINESS_MAX[key], answer })
  const rows: ReadinessRow[] = [
    row('budget', budget, budget === 1 ? 'fits' : budget ? 'stretch' : max ? 'none' : 'unknown'),
    row('requirement', q.need ? NEED[q.need] : 0, q.need ?? 'unknown'),
    row('timeline', q.timeline ? TIMELINE_WEIGHT[q.timeline] : 0, q.timeline ?? 'unknown'),
    row('funding', funding, q.fundingReady ?? q.loan),
    row('authority', authority, q.authority ?? (q.decisionMakers.length ? 'named' : 'unknown')),
    row('engagement', engagement, [e.responded && 'responded', e.docsRequested && 'docs', e.siteVisited && 'visited'].filter(Boolean).join(',') || 'none'),
  ]
  const total = rows.reduce((n, r) => n + r.points, 0)
  const band: ReadinessBand = total >= 80 ? 'high' : total >= 60 ? 'qualified' : total >= 40 ? 'developing' : 'early'
  return { total, band, rows }
}

/* ---------- the four-check card ---------- */

export type QualCheck = 'budget' | 'authority' | 'need' | 'timeline'
export const QUAL_CHECKS: QualCheck[] = ['budget', 'authority', 'need', 'timeline']

/** A question for a missing check: an i18n prompt key and quick-pick chips (labels are i18n keys too). */
export type QualQuestion = { field: string; prompt: string; chips?: { label: string; value: unknown }[]; essential: boolean }

const QUESTIONS: Record<QualCheck, QualQuestion> = {
  budget: {
    field: 'requirement.budgetMax', prompt: 'leads:qualify.question.budget', essential: true,
    chips: [5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000].map((v) => ({ label: `leads:qualify.chip.budget${v}`, value: v })),
  },
  authority: {
    field: 'qualification.decisionMakers', prompt: 'leads:qualify.question.authority', essential: true,
    chips: (['self', 'spouse', 'parents', 'family'] as const).map((v) => ({ label: `catalogue:decisionMaker.${v}`, value: v })),
  },
  need: {
    field: 'qualification.need', prompt: 'leads:qualify.question.need', essential: true,
    chips: (['clear', 'partly', 'exploring'] as const).map((v) => ({ label: `catalogue:need.${v}`, value: v })),
  },
  timeline: {
    field: 'qualification.timeline', prompt: 'leads:qualify.question.timeline', essential: true,
    chips: (['immediate', 'm1to3', 'm3to6', 'exploring'] as const).map((v) => ({ label: `catalogue:timeline.${v}`, value: v })),
  },
}

/** Is the requirement itself clear enough: stated as clear, or type + city (+ configuration for homes) known. */
export function requirementKnown(lead: Pick<Lead, 'requirement' | 'qualification'>): boolean {
  if (lead.qualification.need === 'clear') return true
  const r = lead.requirement
  const needsConfig = r.propertyTypes.some((t) => PROPERTY_TYPES[t].configurable)
  return r.propertyTypes.length > 0 && r.cities.length > 0 && (!needsConfig || r.configurations.length > 0)
}

export function qualificationCard(lead: Pick<Lead, 'requirement' | 'qualification'>): {
  known: QualCheck[]; missing: QualCheck[]; checks: { key: QualCheck; known: boolean }[]; questions: QualQuestion[]
} {
  const q = lead.qualification
  const state: Record<QualCheck, boolean> = {
    budget: !!lead.requirement.budgetMax,
    authority: !!q.authority || q.decisionMakers.length > 0,
    need: requirementKnown(lead),
    timeline: !!q.timeline,
  }
  const known = QUAL_CHECKS.filter((k) => state[k])
  const missing = QUAL_CHECKS.filter((k) => !state[k])
  return { known, missing, checks: QUAL_CHECKS.map((key) => ({ key, known: state[key] })), questions: missing.map((k) => QUESTIONS[k]) }
}

/* ---------- Indian-context follow-up questions (optional, never block) ---------- */

/** Helpful questions beyond the four checks: home loan, self-use or investment, preferred possession. */
export function extraQuestions(lead: Pick<Lead, 'requirement' | 'qualification'>): QualQuestion[] {
  const q = lead.qualification
  const out: QualQuestion[] = []
  if (q.loan === 'unknown' && !q.fundingReady) {
    out.push({
      field: 'qualification.loan', prompt: 'leads:qualify.question.loan', essential: false,
      chips: (['needed', 'preApproved', 'notNeeded'] as const).map((v) => ({ label: `catalogue:loan.${v}`, value: v })),
    })
  }
  if (!q.buyerPurpose) {
    out.push({
      field: 'qualification.buyerPurpose', prompt: 'leads:qualify.question.purpose', essential: false,
      chips: (['selfUse', 'investment', 'rental'] as const).map((v) => ({ label: `catalogue:buyerPurpose.${v}`, value: v })),
    })
  }
  if (lead.requirement.possession === 'any' && lead.requirement.propertyTypes.every((t) => PROPERTY_TYPES[t].family !== 'plot' && PROPERTY_TYPES[t].family !== 'land')) {
    out.push({
      field: 'requirement.possession', prompt: 'leads:qualify.question.possession', essential: false,
      chips: (['ready', 'underConstruction'] as const).map((v) => ({ label: `catalogue:possession.${v}`, value: v })),
    })
  }
  return out
}

/** The change to save when a question chip is picked. Values may come as a scalar or a one-item list (AI chips). */
export type QualPatch = { requirement?: Partial<Lead['requirement']>; qualification?: Partial<Lead['qualification']> }

export function answerPatch(lead: Pick<Lead, 'requirement' | 'qualification'>, field: string, raw: unknown): QualPatch | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === undefined || value === null || value === '') return null
  const q = lead.qualification
  switch (field) {
    case 'requirement.budgetMax': {
      const n = Number(value)
      if (!Number.isFinite(n) || n <= 0) return null
      const min = lead.requirement.budgetMin
      return { requirement: { budgetMax: n, ...(min && min > n ? { budgetMin: undefined } : {}) } }
    }
    case 'qualification.decisionMakers': {
      const v = value as Lead['qualification']['decisionMakers'][number]
      const makers = q.decisionMakers.includes(v) ? q.decisionMakers : [...q.decisionMakers, v]
      const authority: Authority = makers.length === 1 && makers[0] === 'self' ? 'sole' : makers.includes('company') ? 'needsApproval' : 'joint'
      return { qualification: { decisionMakers: makers, authority: q.authority ?? authority } }
    }
    case 'qualification.need': return { qualification: { need: value as Need } }
    case 'qualification.timeline': return { qualification: { timeline: value as Timeline } }
    case 'qualification.loan': return { qualification: { loan: value as Lead['qualification']['loan'] } }
    case 'qualification.buyerPurpose': return { qualification: { buyerPurpose: value as Lead['qualification']['buyerPurpose'] } }
    case 'requirement.possession': return { requirement: { possession: value as Lead['requirement']['possession'] } }
    default: return null
  }
}
