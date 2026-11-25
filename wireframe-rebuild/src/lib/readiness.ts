/**
 * Purchase readiness — the transparent 100-point "ready to buy" score (spec-system-wireframe logic.js → readiness).
 * Budget fits a property 25 · clear requirement 20 · timeline 20 · funding 15 · decision-making authority 10 · engagement 10.
 * Kept separate from the property fit score; BANT labels never appear on screen.
 */
import type { Database, Lead } from '@/data/types'
import type { Tone } from '@/components/app/tone'
import { propertiesForLead } from './matching'

const POINTS = { budget: 25, requirement: 20, timeline: 20, funding: 15, authority: 10, engagement: 10 }
const NEED: Record<Lead['qualification']['need'], number> = { clear: 1, partly: 0.5, exploring: 0.2 }
const TIMELINE: Record<Lead['qualification']['timeline'], number> = { m1: 1, m1to3: 0.8, m3to6: 0.5, m6to12: 0.25, undecided: 0 }
const FUNDING: Record<Lead['qualification']['fundingReady'], number> = { ready: 1, arranging: 0.55, undecided: 0 }
const AUTHORITY: Record<Lead['qualification']['authority'], number> = { sole: 1, joint: 0.7, needsApproval: 0.4, unknown: 0 }

export type ReadinessBand = 'high' | 'qualified' | 'developing' | 'early'
export const BAND_TONE: Record<ReadinessBand, Tone> = { high: 'success', qualified: 'info', developing: 'warning', early: 'neutral' }

/** One line of the 100-point score: what it measures, the points out of its maximum, and the answer behind them. */
export type ReadinessRow = { key: keyof typeof POINTS; points: number; max: number; answer: string }
export const READINESS_MAX = POINTS

export function readiness(lead: Lead, db: Database): { total: number; band: ReadinessBand; rows: ReadinessRow[] } {
  const q = lead.qualification
  const e = lead.engagement
  const eligible = propertiesForLead(lead, db.properties.filter((p) => !p.archived), db.settings)
  const budget = eligible.some((m) => m.property.price <= lead.budget.max) ? 1 : eligible.length ? 0.5 : 0
  const engagement = (e.responded ? 0.3 : 0) + (e.docsRequested ? 0.3 : 0) + (e.siteVisited ? 0.4 : 0)
  const rows: ReadinessRow[] = [
    { key: 'budget', points: Math.round(POINTS.budget * budget), max: POINTS.budget, answer: budget === 1 ? 'fits' : budget ? 'stretch' : 'none' },
    { key: 'requirement', points: Math.round(POINTS.requirement * NEED[q.need]), max: POINTS.requirement, answer: q.need },
    { key: 'timeline', points: Math.round(POINTS.timeline * TIMELINE[q.timeline]), max: POINTS.timeline, answer: q.timeline },
    { key: 'funding', points: Math.round(POINTS.funding * FUNDING[q.fundingReady]), max: POINTS.funding, answer: q.fundingReady },
    { key: 'authority', points: Math.round(POINTS.authority * AUTHORITY[q.authority]), max: POINTS.authority, answer: q.authority },
    { key: 'engagement', points: Math.round(POINTS.engagement * engagement), max: POINTS.engagement, answer: [e.responded && 'responded', e.docsRequested && 'docs', e.siteVisited && 'visited'].filter(Boolean).join(',') || 'none' },
  ]
  const total = rows.reduce((n, r) => n + r.points, 0)
  const band: ReadinessBand = total >= 80 ? 'high' : total >= 60 ? 'qualified' : total >= 40 ? 'developing' : 'early'
  return { total, band, rows }
}
