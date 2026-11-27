/**
 * Everything a Reports page shows, for one subject (everyone / a team / one person) and one period, computed from
 * the store in one pass (pure). The funnel, sources and trends use the leads that came in during the period (a
 * cohort), so periods compare like with like; the pipeline health and value use the leads open now. Drill-downs
 * (clicking a bar, slice or stage) return the exact records behind a number.
 */
import type { DB, ID, Lead, LeadSource, LostReason, PipelineStageKey, Property, PropertyStatus, PropertyType, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'
import { agingOf } from '@/lib/stalled'
import {
  activityHeatmap, activityTrend, avgFirstContactMins, between, closedAt, execPerformance, funnel,
  inventoryByStatus, inventoryByType, leadsBySource, lostReasonsIn, pctChange, periodBounds, periodBuckets,
  pipelineValueByStage, stageAging, subjectLeads, subjectUserIds, trendSeries, type ReportPeriod, type ReportSubject,
} from '@/services/queries/stats'

export const REPORT_TABS = ['overview', 'pipeline', 'sources', 'team', 'activity', 'inventory'] as const
export type ReportTab = (typeof REPORT_TABS)[number]
export const isReportTab = (s: string | undefined): s is ReportTab => !!s && (REPORT_TABS as readonly string[]).includes(s)

const DAY = 86_400_000

export function buildReport(db: DB, viewer: User, subject: ReportSubject, period: ReportPeriod, now: Date) {
  const { from, to, prevFrom, prevTo } = periodBounds(period, now)
  const userIds = subjectUserIds(db, subject)
  const ids = new Set(userIds)
  const leads = subjectLeads(db, viewer, subject)
  const cohort = leads.filter((l) => between(l.createdAt, from, to))
  const prevCohort = leads.filter((l) => between(l.createdAt, prevFrom, prevTo))
  const appts = db.appointments.filter((a) => subject.kind === 'all' || ids.has(a.ownerId))
  const visitsIn = (f: Date, t: Date) => appts.filter((a) => a.type === 'siteVisit' && a.status === 'completed' && between(a.outcome?.at ?? a.start, f, t)).length
  const booked = leads.filter((l) => between(l.deal?.bookedAt, from, to))
  const prevBooked = leads.filter((l) => between(l.deal?.bookedAt, prevFrom, prevTo))
  const revenue = booked.reduce((n, l) => n + (l.deal?.value ?? 0), 0)
  const prevRevenue = prevBooked.reduce((n, l) => n + (l.deal?.value ?? 0), 0)
  // conversion in the period: deals booked in it over deals booked or lost in it (null when nothing closed in it)
  const lostIn = leads.filter((l) => l.stage === 'lost' && between(l.lost?.at ?? closedAt(l), from, to)).length
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage))
  const acts = db.activities.filter((a) => subject.kind === 'all' || ids.has(String(a.actorId)))
  const days = Math.max(7, Math.ceil((to.getTime() - from.getTime()) / DAY))
  const fun = funnel(cohort)
  return {
    subject, period, from, to,
    leads, cohort, open,
    kpis: {
      leads: cohort.length, leadsDelta: pctChange(cohort.length, prevCohort.length),
      visits: visitsIn(from, to), visitsDelta: pctChange(visitsIn(from, to), visitsIn(prevFrom, prevTo)),
      bookings: booked.length, bookingsDelta: pctChange(booked.length, prevBooked.length),
      revenue, revenueDelta: pctChange(revenue, prevRevenue),
      conversion: booked.length + lostIn ? Math.round((booked.length / (booked.length + lostIn)) * 100) : null,
      pipeline: pipelineValueByStage(open).reduce((n, s) => n + s.value, 0),
      tat: avgFirstContactMins(cohort),
    },
    funnel: fun.filter((f) => f.stage !== 'converted').map((f, i, all) => ({ stage: f.stage, count: f.reached, current: f.current, dropOffPct: i > 0 ? all[i - 1].dropOffPct : undefined })),
    trend: trendSeries({ leads, appointments: appts }, period, now),
    sources: leadsBySource(cohort).sort((a, b) => b.count - a.count),
    lost: lostReasonsIn(leads, from, to),
    aging: stageAging(open, db.settings, now),
    pipelineValue: pipelineValueByStage(open),
    execs: execPerformance(db, userIds, period, now),
    heat: activityHeatmap(acts, now, days),
    activity: activityTrend(acts, subject.kind === 'all' ? db.users.map((u) => u.id) : userIds, period, now),
    inventoryStatus: inventoryByStatus(db.properties),
    inventoryType: inventoryByType(db.properties.filter((p) => p.listing !== 'archived')),
  }
}
export type ReportData = ReturnType<typeof buildReport>

/* ---------- drill-downs ---------- */

export type Drill =
  | { kind: 'stage'; stage: PipelineStageKey; scope: 'reached' | 'open' }
  | { kind: 'source'; source: LeadSource }
  | { kind: 'lost'; reason: LostReason }
  | { kind: 'owner'; userId: ID }
  | { kind: 'bucket'; key: string; metric: 'leads' | 'bookings' }
  | { kind: 'stalled' }
  | { kind: 'cohort' }
  | { kind: 'booked' }
  | { kind: 'propertyStatus'; status: PropertyStatus }
  | { kind: 'propertyType'; type: PropertyType }

export const isPropertyDrill = (d: Drill) => d.kind === 'propertyStatus' || d.kind === 'propertyType'

/** The leads behind a number on the page. */
export function drillLeads(data: ReportData, d: Drill, ctx: { settings: DB['settings']; now: Date }): Lead[] {
  switch (d.kind) {
    case 'stage':
      return d.scope === 'open'
        ? data.open.filter((l) => l.stage === d.stage)
        : data.cohort.filter((l) => l.stage === d.stage || l.stageHistory.some((h) => h.stage === d.stage))
    case 'source': return data.cohort.filter((l) => l.source === d.source)
    case 'lost': return data.leads.filter((l) => l.stage === 'lost' && l.lost?.reason === d.reason && between(l.lost?.at ?? closedAt(l), data.from, data.to))
    case 'owner': return data.leads.filter((l) => l.ownerId === d.userId || l.firstOwnerId === d.userId)
    case 'bucket': {
      const b = periodBuckets(data.period, data.to).find((x) => x.key === d.key)
      if (!b) return []
      return d.metric === 'leads' ? data.leads.filter((l) => between(l.createdAt, b.from, b.to)) : data.leads.filter((l) => between(l.deal?.bookedAt, b.from, b.to))
    }
    case 'stalled': return data.open.filter((l) => agingOf(l, ctx.settings, ctx.now).tone === 'danger')
    case 'cohort': return data.cohort
    case 'booked': return data.leads.filter((l) => between(l.deal?.bookedAt, data.from, data.to))
    default: return []
  }
}

export function drillProperties(properties: Property[], d: Drill): Property[] {
  if (d.kind === 'propertyStatus') return properties.filter((p) => p.status === d.status && p.listing !== 'archived')
  if (d.kind === 'propertyType') return properties.filter((p) => p.type === d.type && p.listing !== 'archived')
  return []
}

/* ---------- the AI summary (simulated: rules over the numbers; shown with the Demo AI badge) ---------- */

export type SummaryLine = { key: string; params: Record<string, string | number>; tParams?: Record<string, string>; tone: 'success' | 'warning' | 'danger' | 'info' | 'primary'; drill?: Drill }

export function reportSummary(data: ReportData, users: Pick<User, 'id' | 'name'>[]): SummaryLine[] {
  const out: SummaryLine[] = []
  const k = data.kpis
  out.push({ key: k.leadsDelta == null ? 'leadsNew' : k.leadsDelta >= 0 ? 'leadsUp' : 'leadsDown', params: { count: k.leads, pct: Math.abs(k.leadsDelta ?? 0) }, tone: (k.leadsDelta ?? 0) >= 0 ? 'success' : 'warning', drill: { kind: 'cohort' } })
  if (k.bookings) out.push({ key: 'bookings', params: { count: k.bookings, value: k.revenue }, tone: 'success', drill: { kind: 'booked' } })
  const steps = data.funnel.filter((f, i) => i > 0 && f.dropOffPct != null && data.funnel[i - 1].count >= 3)
  const worst = [...steps].sort((a, b) => (b.dropOffPct ?? 0) - (a.dropOffPct ?? 0))[0]
  if (worst && (worst.dropOffPct ?? 0) > 0) {
    const prev = data.funnel[data.funnel.indexOf(worst) - 1]
    out.push({ key: 'dropOff', params: { pct: worst.dropOffPct ?? 0 }, tParams: { from: `catalogue:stage.${prev.stage}`, to: `catalogue:stage.${worst.stage}` }, tone: 'warning', drill: { kind: 'stage', stage: prev.stage, scope: 'reached' } })
  }
  const src = data.sources.filter((s) => s.count >= 2).sort((a, b) => b.visited / b.count - a.visited / a.count)[0]
  if (src && src.visited) out.push({ key: 'source', params: { pct: Math.round((src.visited / src.count) * 100) }, tParams: { source: `catalogue:source.${src.source}` }, tone: 'info', drill: { kind: 'source', source: src.source } })
  const lost = [...data.lost].sort((a, b) => b.count - a.count)[0]
  if (lost && lost.count) out.push({ key: 'lost', params: { count: lost.count }, tParams: { reason: `catalogue:lostReason.${lost.reason}` }, tone: 'danger', drill: { kind: 'lost', reason: lost.reason } })
  const stalled = data.aging.reduce((n, a) => n + a.stalled, 0)
  if (stalled) out.push({ key: 'stalled', params: { count: stalled }, tone: 'warning', drill: { kind: 'stalled' } })
  if (data.execs.length > 1) {
    const best = [...data.execs].sort((a, b) => b.bookings - a.bookings || b.visits - a.visits)[0]
    const name = users.find((u) => u.id === best.userId)?.name
    if (name && (best.bookings || best.visits)) out.push({ key: 'bestExec', params: { name, bookings: best.bookings, visits: best.visits }, tone: 'primary', drill: { kind: 'owner', userId: best.userId } })
  }
  return out.slice(0, 5)
}

/** A chart label for a time bucket: "27 Nov" (day), "24 Nov" (week start) or "Nov" (month). */
export function bucketLabel(key: string, lang = 'en'): string {
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN'
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split('-').map(Number)
    return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(y, m - 1, 1))
  }
  const [y, m, d] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(y, m - 1, d))
}

