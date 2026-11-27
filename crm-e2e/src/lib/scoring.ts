/**
 * The lead score, 0–100, with a visible explanation per factor (foundation-plan §5.5):
 *
 * | Factor                     | Max | How                                                                       |
 * | qualification              |  40 | readiness (lib/qualification) scaled 100 → 40                             |
 * | engagement and recency     |  20 | responded +6, docs +4, visited +6, contact in the last 2 days +4;          |
 * |                            |     | −1 per day without contact after 2 days, minimum 0                        |
 * | budget and inventory fit   |  15 | best match score / 100 × 15                                               |
 * | source quality             |  10 | SOURCE_QUALITY × 10                                                       |
 * | urgency                    |  15 | timeline immediate 15 · 1–3 m 11 · 3–6 m 7 · 6–12 m 3 · exploring 0;       |
 * |                            |     | +2 for an NRI or a high-value budget, capped at 15                        |
 *
 * Temperature: hot ≥ settings.scoring.hotAt (70), warm ≥ warmAt (45), else cold; an override wins.
 * Probability: 0.5 × stage probability + 0.5 × score / 100 (lost 0, converted 1).
 * Priority: high when hot, a site visit is today or something is overdue; an override wins.
 * Nothing here is stored: scores are always derived.
 */
import type { Appointment, Lead, Priority, Property, Settings, Task, Temperature, Timeline } from '@/domain/types'
import { SOURCE_QUALITY } from '@/domain/catalogue'
import { localDay } from './dates'
import { HIGH_VALUE_BUDGET } from './classification'
import { propertiesForLead } from './matching'
import { readiness } from './qualification'

export type ScoreFactorKey = 'qualification' | 'engagement' | 'fit' | 'source' | 'urgency'
/** One factor of the score: i18n `leads:score.factor.<key>`, detail key `leads:score.detail.<detail>` with params. */
export type ScoreFactor = { key: ScoreFactorKey; points: number; max: number; detail?: string; params?: Record<string, string | number> }
export type LeadScore = { score: number; temperature: Temperature; probability: number; factors: ScoreFactor[] }

export type ScoreContext = {
  properties: Property[]
  settings: Pick<Settings, 'matching' | 'scoring' | 'pipeline'>
  now: Date
}

const URGENCY: Record<Timeline, number> = { immediate: 15, m1to3: 11, m3to6: 7, m6to12: 3, exploring: 0 }
const DAY = 86_400_000

export function temperatureFor(score: number, settings: Pick<Settings, 'scoring'>): Temperature {
  if (score >= settings.scoring.hotAt) return 'hot'
  if (score >= settings.scoring.warmAt) return 'warm'
  return 'cold'
}

export function leadScore(lead: Lead, ctx: ScoreContext): LeadScore {
  const ready = readiness(lead, ctx)
  const qualification = Math.round((ready.total / 100) * 40)

  const e = lead.engagement
  const last = lead.lastContactAt ?? lead.firstContactAt ?? lead.createdAt
  const idleDays = Math.max(0, Math.floor((ctx.now.getTime() - new Date(last).getTime()) / DAY))
  const recent = lead.lastContactAt && idleDays <= 2 ? 4 : 0
  const engagementRaw = (e.responded ? 6 : 0) + (e.docsRequested ? 4 : 0) + (e.siteVisited ? 6 : 0) + recent - Math.max(0, idleDays - 2)
  const engagement = Math.max(0, Math.min(20, engagementRaw))

  // a lead that already chose a unit (negotiation, booked) fits fully; else the best open match counts
  const dealProperty = lead.deal?.propertyId ? ctx.properties.find((p) => p.id === lead.deal?.propertyId) : undefined
  const best = dealProperty ? undefined : propertiesForLead(lead, ctx.properties, ctx.settings, ctx.now, { limit: 1 })[0]
  const fit = dealProperty ? 15 : best ? Math.round((best.score / 100) * 15) : 0

  const source = Math.round(SOURCE_QUALITY[lead.source] * 10)

  const highValue = (lead.requirement.budgetMax ?? 0) >= HIGH_VALUE_BUDGET
  const urgencyBase = lead.qualification.timeline ? URGENCY[lead.qualification.timeline] : 0
  const urgency = Math.min(15, urgencyBase + (lead.isNri || highValue ? 2 : 0))

  const factors: ScoreFactor[] = [
    { key: 'qualification', points: qualification, max: 40, detail: `band.${ready.band}`, params: { readiness: ready.total } },
    { key: 'engagement', points: engagement, max: 20, detail: idleDays > 2 ? 'idle' : 'recent', params: { days: idleDays } },
    {
      key: 'fit', points: fit, max: 15, detail: dealProperty ? 'dealProperty' : best ? 'bestMatch' : 'noMatch',
      params: dealProperty ? { title: dealProperty.title } : best ? { title: best.property.title, score: best.score } : {},
    },
    { key: 'source', points: source, max: 10, detail: 'source', params: { source: lead.source } },
    { key: 'urgency', points: urgency, max: 15, detail: lead.qualification.timeline ? `timeline.${lead.qualification.timeline}` : 'timeline.unknown', params: { nri: lead.isNri ? 1 : 0, highValue: highValue ? 1 : 0 } },
  ]
  const score = Math.max(0, Math.min(100, factors.reduce((n, f) => n + f.points, 0)))
  const temperature = lead.temperatureOverride ?? temperatureFor(score, ctx.settings)
  return { score, temperature, probability: probabilityFor(lead, score, ctx.settings), factors }
}

export function probabilityFor(lead: Pick<Lead, 'stage'>, score: number, settings: Pick<Settings, 'pipeline'>): number {
  if (lead.stage === 'lost') return 0
  if (lead.stage === 'converted') return 1
  const stageP = settings.pipeline.stages.find((s) => s.key === lead.stage)?.probability ?? 0
  return Math.round((0.5 * stageP + 0.5 * (score / 100)) * 100) / 100
}

/** High when hot, a site visit is today, or an open task is overdue; medium when warm; else low. */
export function priorityFor(
  lead: Pick<Lead, 'id' | 'priorityOverride'>,
  temperature: Temperature,
  ctx: { appointments: Appointment[]; tasks: Task[]; now: Date },
): Priority {
  if (lead.priorityOverride) return lead.priorityOverride
  const today = localDay(ctx.now)
  const nowIso = ctx.now.toISOString()
  const visitToday = ctx.appointments.some((a) => a.leadId === lead.id && a.type === 'siteVisit' && localDay(a.start) === today && a.status !== 'cancelled' && a.status !== 'noShow')
  const overdue = ctx.tasks.some((t) => t.leadId === lead.id && t.status === 'open' && t.dueAt < nowIso)
  if (temperature === 'hot' || visitToday || overdue) return 'high'
  return temperature === 'warm' ? 'medium' : 'low'
}
