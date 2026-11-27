/**
 * Aggregates shared by Today, Reports, Team and AI insights (first version; M1 owns and refines it).
 * Pure functions of (db, …, now). Leads are always passed in already scoped (visibility.ts), so a manager's report
 * counts the team and an executive's counts their own work.
 */
import type { Activity, Appointment, DB, ID, Lead, LeadSource, LostReason, PipelineStageKey, Property, PropertyStatus, PropertyType, Settings, User } from '@/domain/types'
import { LEAD_SOURCES, LOST_REASONS, OPEN_STAGES, PROPERTY_STATUSES, STAGES } from '@/domain/catalogue'
import { localDay } from '@/lib/dates'
import { scopeOf } from '@/lib/permissions'
import { agingOf } from '@/lib/stalled'
import { visible } from './visibility'

const DAY = 86_400_000

export type Period = 'today' | 'week' | 'month' | 'quarter' | 'half'

/** Start of a period, in local time (week starts Monday). */
export function periodStart(period: Period, now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  else if (period === 'month') d.setDate(1)
  else if (period === 'quarter') d.setMonth(d.getMonth() - (d.getMonth() % 3), 1)
  else if (period === 'half') d.setMonth(d.getMonth() - 5, 1)
  return d
}
const inPeriod = (iso: string | undefined, period: Period, now: Date) => !!iso && iso >= periodStart(period, now).toISOString() && iso <= now.toISOString()

/** Users whose numbers a user sees: all for admins, the team (and self) for managers, self for executives. */
export function scopeUserIds(db: Pick<DB, 'users'>, user: User): ID[] {
  if (user.role === 'admin') return db.users.map((u) => u.id)
  if (user.role === 'manager') return db.users.filter((u) => u.id === user.id || u.managerId === user.id).map((u) => u.id)
  return [user.id]
}

/* ---------- activity counts ---------- */

export type ActivityCounts = { calls: number; whatsapp: number; visits: number; bookings: number; revenue: number }

export function activityCounts(db: DB, userIds: ID[], period: Period, now: Date): ActivityCounts {
  const ids = new Set(userIds)
  const acts = db.activities.filter((a) => ids.has(a.actorId) && inPeriod(a.at, period, now))
  const visits = db.appointments.filter((a) => ids.has(a.ownerId) && a.type === 'siteVisit' && a.status === 'completed' && inPeriod(a.outcome?.at ?? a.start, period, now)).length
  const booked = db.leads.filter((l) => l.firstOwnerId && ids.has(l.ownerId ?? l.firstOwnerId) && inPeriod(l.deal?.bookedAt, period, now))
  return {
    calls: acts.filter((a) => a.kind === 'comm.call').length,
    whatsapp: acts.filter((a) => a.kind === 'comm.whatsapp').length,
    visits,
    bookings: booked.length,
    revenue: booked.reduce((n, l) => n + (l.deal?.value ?? 0), 0),
  }
}

/** This month's progress against the user's monthly targets (managers: their own team target). */
export function targetProgress(db: DB, user: User, now: Date) {
  const ids = user.role === 'executive' ? [user.id] : scopeUserIds(db, user)
  const done = activityCounts(db, ids, 'month', now)
  const t = user.targets ?? { calls: 0, siteVisits: 0, bookings: 0, revenue: 0 }
  const pct = (a: number, b: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0)
  return {
    calls: { done: done.calls, target: t.calls, pct: pct(done.calls, t.calls) },
    siteVisits: { done: done.visits, target: t.siteVisits, pct: pct(done.visits, t.siteVisits) },
    bookings: { done: done.bookings, target: t.bookings, pct: pct(done.bookings, t.bookings) },
    revenue: { done: done.revenue, target: t.revenue, pct: pct(done.revenue, t.revenue) },
  }
}

/* ---------- pipeline ---------- */

/** How many leads reached each stage (from their stage history) and the drop-off to the next stage. */
export function funnel(leads: Lead[]): { stage: PipelineStageKey; reached: number; current: number; dropOffPct: number }[] {
  const path = STAGES.filter((s) => s !== 'lost')
  const reached = path.map((stage) => leads.filter((l) => l.stageHistory.some((h) => h.stage === stage) || l.stage === stage).length)
  return path.map((stage, i) => ({
    stage, reached: reached[i], current: leads.filter((l) => l.stage === stage).length,
    dropOffPct: i < path.length - 1 && reached[i] ? Math.round(((reached[i] - reached[i + 1]) / reached[i]) * 100) : 0,
  }))
}

/** Open pipeline value by stage: the deal value when known, else the top of the budget. */
export function pipelineValueByStage(leads: Lead[]): { stage: PipelineStageKey; count: number; value: number }[] {
  return OPEN_STAGES.map((stage) => {
    const list = leads.filter((l) => l.stage === stage)
    return { stage, count: list.length, value: list.reduce((n, l) => n + (l.deal?.value ?? l.requirement.budgetMax ?? 0), 0) }
  })
}

export const leadsBySource = (leads: Lead[]): { source: LeadSource; count: number; booked: number; visited: number }[] =>
  LEAD_SOURCES.map((source) => {
    const list = leads.filter((l) => l.source === source)
    return {
      source, count: list.length,
      visited: list.filter((l) => l.engagement.siteVisited || l.stageHistory.some((h) => h.stage === 'siteVisitDone')).length,
      booked: list.filter((l) => l.stage === 'booked' || l.stage === 'converted').length,
    }
  }).filter((x) => x.count > 0)

export const lostReasons = (leads: Lead[]): { reason: LostReason; count: number }[] =>
  LOST_REASONS.map((reason) => ({ reason, count: leads.filter((l) => l.stage === 'lost' && l.lost?.reason === reason).length }))

/** Share of closed leads that converted or booked. */
export function conversionRate(leads: Lead[]): number {
  const won = leads.filter((l) => l.stage === 'booked' || l.stage === 'converted').length
  const closed = won + leads.filter((l) => l.stage === 'lost').length
  return closed ? Math.round((won / closed) * 100) : 0
}

/** Average minutes from creation to first contact (TAT), over leads that were contacted. */
export function avgFirstContactMins(leads: Lead[]): number | null {
  const mins = leads.filter((l) => l.firstContactAt).map((l) => (new Date(l.firstContactAt!).getTime() - new Date(l.createdAt).getTime()) / 60_000)
  return mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null
}

/** Leads and bookings per month, oldest first (`months` back including this one). */
export function monthlyTrend(leads: Lead[], now: Date, months = 6): { month: string; leads: number; bookings: number; revenue: number }[] {
  const out: { month: string; leads: number; bookings: number; revenue: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const booked = leads.filter((l) => l.deal?.bookedAt && localDay(l.deal.bookedAt).startsWith(key))
    out.push({ month: key, leads: leads.filter((l) => localDay(l.createdAt).startsWith(key)).length, bookings: booked.length, revenue: booked.reduce((n, l) => n + (l.deal?.value ?? 0), 0) })
  }
  return out
}

/* ---------- inventory ---------- */

export const inventoryByStatus = (properties: Property[]): { status: PropertyStatus; count: number; value: number }[] =>
  PROPERTY_STATUSES.map((status) => {
    const list = properties.filter((p) => p.status === status && p.listing !== 'archived')
    return { status, count: list.length, value: list.reduce((n, p) => n + p.price, 0) }
  })

export function inventoryByType(properties: Property[]): { type: PropertyType; count: number; available: number }[] {
  const types = [...new Set(properties.map((p) => p.type))]
  return types.map((type) => ({ type, count: properties.filter((p) => p.type === type).length, available: properties.filter((p) => p.type === type && p.status === 'available').length }))
}

/* ---------- team ---------- */

export type ExecRow = {
  user: User; openLeads: number; hot?: number; overdue: number; callsToday: number; visitsToday: number
  slaBreaches: number; stalled: number; conversionPct: number; pendingFollowUps: number
}

export function teamBoard(db: DB, manager: User, now: Date): ExecRow[] {
  const nowIso = now.toISOString()
  const today = localDay(now)
  const execs = db.users.filter((u) => u.role === 'executive' && (manager.role === 'admin' || u.managerId === manager.id))
  return execs.map((user) => {
    const mine = db.leads.filter((l) => l.ownerId === user.id)
    const open = mine.filter((l) => OPEN_STAGES.includes(l.stage))
    const tasks = db.tasks.filter((t) => t.ownerId === user.id && t.status === 'open')
    return {
      user,
      openLeads: open.length,
      overdue: tasks.filter((t) => t.dueAt < nowIso).length,
      pendingFollowUps: tasks.length,
      callsToday: db.activities.filter((a) => a.actorId === user.id && a.kind === 'comm.call' && localDay(a.at) === today).length,
      visitsToday: db.appointments.filter((a) => a.ownerId === user.id && a.type === 'siteVisit' && localDay(a.start) === today && a.status !== 'cancelled').length,
      slaBreaches: open.filter((l) => l.stage === 'new' && !l.firstContactAt && now.getTime() - new Date(l.createdAt).getTime() > db.settings.sla.firstResponseMins * 60_000).length,
      stalled: open.filter((l) => agingOf(l, db.settings, now).tone === 'danger').length,
      conversionPct: conversionRate(db.leads.filter((l) => l.firstOwnerId === user.id || l.ownerId === user.id)),
    }
  })
}

export function overdueByExec(db: DB, user: User, now: Date): { userId: ID; count: number }[] {
  const nowIso = now.toISOString()
  const ids = scopeUserIds(db, user)
  return ids
    .map((userId) => ({ userId, count: db.tasks.filter((t) => t.ownerId === userId && t.status === 'open' && t.dueAt < nowIso).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
}

/* ---------- activity heatmap ---------- */

/** Calls, messages and visits per weekday (0 = Monday) × hour over the last `days`. */
export function activityHeatmap(activities: Activity[], now: Date, days = 30): { day: number; hour: number; count: number }[] {
  const since = now.getTime() - days * DAY
  const counts = new Map<string, number>()
  for (const a of activities) {
    if (!a.kind.startsWith('comm.') && a.kind !== 'appointment.completed') continue
    const d = new Date(a.at)
    if (d.getTime() < since || d > now) continue
    const key = `${(d.getDay() + 6) % 7}:${d.getHours()}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([k, count]) => {
    const [day, hour] = k.split(':').map(Number)
    return { day, hour, count }
  })
}

/** Headline numbers for a user's scope (admin KPIs, report header). */
export function summaryKpis(db: DB, user: User, now: Date) {
  const leads = visible.leads(db, user)
  const today = localDay(now)
  const ids = scopeUserIds(db, user)
  return {
    newLeadsToday: leads.filter((l) => localDay(l.createdAt) === today).length,
    openLeads: leads.filter((l) => OPEN_STAGES.includes(l.stage)).length,
    visitsToday: db.appointments.filter((a) => ids.includes(a.ownerId) && a.type === 'siteVisit' && localDay(a.start) === today && a.status !== 'cancelled').length,
    bookingsThisMonth: leads.filter((l) => inPeriod(l.deal?.bookedAt, 'month', now)).length,
    pipelineValue: pipelineValueByStage(leads).reduce((n, s) => n + s.value, 0),
    conversionPct: conversionRate(leads),
    availableInventory: db.properties.filter((p) => p.status === 'available' && p.listing === 'live').length,
    avgFirstContactMins: avgFirstContactMins(leads.filter((l) => localDay(l.createdAt) >= localDay(new Date(now.getTime() - 30 * DAY)))),
  }
}

/* =====================================================================================================================
 * M1 refinements (Today & Reports). Everything below is additive: the functions above keep their signatures.
 * ===================================================================================================================== */

export type ReportPeriod = Exclude<Period, 'today'>
export const REPORT_PERIODS: ReportPeriod[] = ['week', 'month', 'quarter', 'half']

/** An inclusive ISO window check. */
export const between = (iso: string | undefined, from: Date, to: Date) => !!iso && iso >= from.toISOString() && iso <= to.toISOString()

/**
 * The period window and the previous one of the same elapsed length (so "this month so far" is compared with
 * "last month up to the same day": a fair delta on the 5th of the month).
 */
export function periodBounds(period: Period, now: Date): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const from = periodStart(period, now)
  const prevFrom = new Date(from)
  if (period === 'today') prevFrom.setDate(prevFrom.getDate() - 1)
  else if (period === 'week') prevFrom.setDate(prevFrom.getDate() - 7)
  else if (period === 'month') prevFrom.setMonth(prevFrom.getMonth() - 1)
  else if (period === 'quarter') prevFrom.setMonth(prevFrom.getMonth() - 3)
  else prevFrom.setMonth(prevFrom.getMonth() - 6)
  const prevTo = new Date(prevFrom.getTime() + (now.getTime() - from.getTime()))
  return { from, to: now, prevFrom, prevTo }
}

/** Percentage change from `prev` to `cur` (null when there is nothing to compare with). */
export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0
  return Math.round(((cur - prev) / prev) * 100)
}

export type BucketUnit = 'day' | 'week' | 'month'
export type Bucket = { key: string; from: Date; to: Date; unit: BucketUnit }

/** Time buckets for a trend chart: days for a week or month, weeks for a quarter, months for six months. */
export function periodBuckets(period: ReportPeriod, now: Date): Bucket[] {
  const start = periodStart(period, now)
  const out: Bucket[] = []
  if (period === 'week' || period === 'month') {
    for (const d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      const to = new Date(d)
      to.setHours(23, 59, 59, 999)
      out.push({ key: localDay(d), from: new Date(d), to, unit: 'day' })
    }
    return out
  }
  if (period === 'quarter') {
    const d = new Date(start)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // back to the Monday
    for (; d <= now; d.setDate(d.getDate() + 7)) {
      const to = new Date(d)
      to.setDate(to.getDate() + 6)
      to.setHours(23, 59, 59, 999)
      out.push({ key: localDay(d), from: new Date(Math.max(d.getTime(), start.getTime())), to, unit: 'week' })
    }
    return out
  }
  for (let i = 5; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    out.push({ key: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`, from, to, unit: 'month' })
  }
  return out
}

export type TrendPoint = { key: string; unit: BucketUnit; leads: number; visits: number; bookings: number; revenue: number }
type VisitLike = Pick<Appointment, 'type' | 'status' | 'start' | 'outcome'>

/** Leads created, site visits done, bookings and booked value per bucket of the period. */
export function trendSeries(data: { leads: Lead[]; appointments: VisitLike[] }, period: ReportPeriod, now: Date): TrendPoint[] {
  return periodBuckets(period, now).map((b) => {
    const booked = data.leads.filter((l) => between(l.deal?.bookedAt, b.from, b.to))
    return {
      key: b.key, unit: b.unit,
      leads: data.leads.filter((l) => between(l.createdAt, b.from, b.to)).length,
      visits: data.appointments.filter((a) => a.type === 'siteVisit' && a.status === 'completed' && between(a.outcome?.at ?? a.start, b.from, b.to)).length,
      bookings: booked.length,
      revenue: booked.reduce((n, l) => n + (l.deal?.value ?? 0), 0),
    }
  })
}

/** Counts per local day for the last `days` days, oldest first, ending today (sparklines). */
export function dailySeries(dates: (string | undefined)[], now: Date, days = 14): number[] {
  const index = new Map<string, number>()
  const out = Array.from({ length: days }, () => 0)
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - (days - 1 - i))
    index.set(localDay(d), i)
  }
  const nowIso = now.toISOString()
  for (const iso of dates) {
    if (!iso || iso > nowIso) continue
    const i = index.get(localDay(iso))
    if (i != null) out[i]++
  }
  return out
}

/** When a lead left the open pipeline (booked counts as open until converted), from its stage history. */
export function closedAt(l: Pick<Lead, 'stage' | 'stageHistory' | 'stageSince'>): string | undefined {
  if (l.stage !== 'converted' && l.stage !== 'lost') return undefined
  return [...l.stageHistory].reverse().find((h) => h.stage === l.stage)?.at ?? l.stageSince
}

/** The open pipeline value at the end of each of the last `weeks` weeks (oldest first): a sparkline for the KPI. */
export function pipelineValueSeries(leads: Lead[], now: Date, weeks = 8): number[] {
  const out: number[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const at = new Date(now.getTime() - i * 7 * DAY).toISOString()
    out.push(leads.filter((l) => l.createdAt <= at && (closedAt(l) ?? '9999') > at)
      .reduce((n, l) => n + (l.deal?.value ?? l.requirement.budgetMax ?? 0), 0))
  }
  return out
}

/** Booked-or-converted share of the leads closed in each of the last `months` months (oldest first). */
export function conversionSeries(leads: Lead[], now: Date, months = 6): number[] {
  const out: number[] = []
  for (let i = months - 1; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const won = leads.filter((l) => between(l.deal?.bookedAt, from, to)).length
    const lost = leads.filter((l) => l.stage === 'lost' && between(l.lost?.at ?? closedAt(l), from, to)).length
    out.push(won + lost ? Math.round((won / (won + lost)) * 100) : 0)
  }
  return out
}

/* ---------- report scope (all / team / personal) ---------- */

export type ReportSubject = { kind: 'all' } | { kind: 'team'; managerId: ID } | { kind: 'user'; userId: ID }

export const subjectKey = (s: ReportSubject) => (s.kind === 'all' ? 'all' : s.kind === 'team' ? `team:${s.managerId}` : `user:${s.userId}`)
export function parseSubject(key: string | null | undefined): ReportSubject | null {
  if (key === 'all') return { kind: 'all' }
  const [kind, id] = (key ?? '').split(':')
  if (kind === 'team' && id) return { kind: 'team', managerId: id }
  if (kind === 'user' && id) return { kind: 'user', userId: id }
  return null
}

/** The subjects a viewer may report on, widest first: everyone (admin), each team, each executive; or just self. */
export function subjectOptions(db: Pick<DB, 'users' | 'leads'>, viewer: User): ReportSubject[] {
  const scope = scopeOf(viewer, 'report.view')
  if (!scope) return []
  if (scope === 'own') return [{ kind: 'user', userId: viewer.id }]
  const execs = (ids: ID[]) => db.users
    .filter((u) => u.role === 'executive' && ids.includes(u.id) && (u.status === 'active' || db.leads.some((l) => l.ownerId === u.id || l.firstOwnerId === u.id)))
    .map((u): ReportSubject => ({ kind: 'user', userId: u.id }))
  if (scope === 'team') {
    const team = db.users.filter((u) => u.managerId === viewer.id).map((u) => u.id)
    return [{ kind: 'team', managerId: viewer.id }, ...execs(team)]
  }
  const managers = db.users.filter((u) => u.role === 'manager' && u.status === 'active')
  return [{ kind: 'all' }, ...managers.map((m): ReportSubject => ({ kind: 'team', managerId: m.id })), ...execs(db.users.map((u) => u.id))]
}

/** The people whose activity a subject covers. */
export function subjectUserIds(db: Pick<DB, 'users'>, s: ReportSubject): ID[] {
  if (s.kind === 'all') return db.users.map((u) => u.id)
  if (s.kind === 'team') return db.users.filter((u) => u.id === s.managerId || u.managerId === s.managerId).map((u) => u.id)
  return [s.userId]
}

/**
 * The leads a subject covers, within what the viewer may see. A lead belongs to a person while they own it and stays
 * on their record after a handover (`firstOwnerId`), so attribution survives reassignment. A team also covers its
 * unassigned queue.
 */
export function subjectLeads(db: DB, viewer: User, s: ReportSubject): Lead[] {
  const seen = visible.leads(db, viewer)
  if (s.kind === 'all') return seen
  const ids = new Set(subjectUserIds(db, s))
  return seen.filter((l) => (l.ownerId != null && ids.has(l.ownerId)) || (!!l.firstOwnerId && ids.has(l.firstOwnerId)) || (s.kind === 'team' && l.ownerId === null))
}

/* ---------- pipeline health ---------- */

export type StageAging = { stage: PipelineStageKey; count: number; value: number; avgDays: number; stalled: number; targetDays: number }

/** Per open stage: leads now, their value, the average days in the stage and how many are stalled (> 2× target). */
export function stageAging(leads: Lead[], settings: Pick<Settings, 'pipeline'>, now: Date): StageAging[] {
  return OPEN_STAGES.map((stage) => {
    const list = leads.filter((l) => l.stage === stage)
    const ages = list.map((l) => agingOf(l, settings, now))
    return {
      stage, count: list.length,
      value: list.reduce((n, l) => n + (l.deal?.value ?? l.requirement.budgetMax ?? 0), 0),
      avgDays: ages.length ? Math.round(ages.reduce((n, a) => n + a.days, 0) / ages.length) : 0,
      stalled: ages.filter((a) => a.tone === 'danger').length,
      targetDays: settings.pipeline.stages.find((x) => x.key === stage)?.targetDays ?? 0,
    }
  })
}

/** Lost reasons for leads lost inside a window (all time when no window). */
export function lostReasonsIn(leads: Lead[], from?: Date, to?: Date): { reason: LostReason; count: number; value: number }[] {
  const lost = leads.filter((l) => l.stage === 'lost' && (!from || !to || between(l.lost?.at ?? closedAt(l), from, to)))
  return LOST_REASONS.map((reason) => {
    const list = lost.filter((l) => l.lost?.reason === reason)
    return { reason, count: list.length, value: list.reduce((n, l) => n + (l.requirement.budgetMax ?? 0), 0) }
  })
}

/* ---------- people ---------- */

export type ExecPerf = {
  userId: ID; newLeads: number; openLeads: number; calls: number; whatsapp: number; visits: number
  bookings: number; revenue: number; conversionPct: number; avgFirstContactMins: number | null; overdue: number; lost: number
}

/** One row per executive among `userIds` for the period (the Reports team table and bar chart). */
export function execPerformance(db: DB, userIds: ID[], period: ReportPeriod, now: Date): ExecPerf[] {
  const { from, to } = periodBounds(period, now)
  const nowIso = now.toISOString()
  return db.users.filter((u) => u.role === 'executive' && userIds.includes(u.id)).map((u) => {
    const own = db.leads.filter((l) => l.ownerId === u.id || l.firstOwnerId === u.id)
    const acts = db.activities.filter((a) => a.actorId === u.id && between(a.at, from, to))
    const booked = own.filter((l) => between(l.deal?.bookedAt, from, to))
    return {
      userId: u.id,
      newLeads: own.filter((l) => between(l.createdAt, from, to)).length,
      openLeads: own.filter((l) => l.ownerId === u.id && OPEN_STAGES.includes(l.stage)).length,
      calls: acts.filter((a) => a.kind === 'comm.call').length,
      whatsapp: acts.filter((a) => a.kind === 'comm.whatsapp').length,
      visits: db.appointments.filter((a) => a.ownerId === u.id && a.type === 'siteVisit' && a.status === 'completed' && between(a.outcome?.at ?? a.start, from, to)).length,
      bookings: booked.length,
      revenue: booked.reduce((n, l) => n + (l.deal?.value ?? 0), 0),
      conversionPct: conversionRate(own),
      avgFirstContactMins: avgFirstContactMins(own.filter((l) => between(l.createdAt, from, to))),
      overdue: db.tasks.filter((t) => t.ownerId === u.id && t.status === 'open' && t.dueAt < nowIso).length,
      lost: own.filter((l) => l.stage === 'lost' && between(l.lost?.at ?? closedAt(l), from, to)).length,
    }
  })
}

/** Days in a row (ending today, or yesterday when today has nothing yet) with at least one call or message. */
export function streakDays(activities: Pick<Activity, 'actorId' | 'kind' | 'at'>[], userId: ID, now: Date): number {
  const nowIso = now.toISOString()
  const days = new Set(activities.filter((a) => a.actorId === userId && a.kind.startsWith('comm.') && a.at <= nowIso).map((a) => localDay(a.at)))
  const d = new Date(now)
  if (!days.has(localDay(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(localDay(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

/** Where an executive stands among the active executives of the same team this month (bookings, then visits, then calls). */
export function teamRank(db: DB, user: User, now: Date): { rank: number; of: number } | null {
  if (user.role !== 'executive' || !user.managerId) return null
  const peers = db.users.filter((u) => u.role === 'executive' && u.status === 'active' && u.managerId === user.managerId)
  const score = (id: ID) => {
    const c = activityCounts(db, [id], 'month', now)
    return c.bookings * 1_000_000 + c.visits * 1_000 + c.calls
  }
  const mine = score(user.id)
  return { rank: 1 + peers.filter((p) => p.id !== user.id && score(p.id) > mine).length, of: peers.length }
}

export type ActivityPoint = { key: string; unit: BucketUnit; calls: number; whatsapp: number; notes: number }

/** Calls, WhatsApp messages and notes per bucket of the period, for the given people. */
export function activityTrend(activities: Pick<Activity, 'actorId' | 'kind' | 'at'>[], userIds: ID[], period: ReportPeriod, now: Date): ActivityPoint[] {
  const ids = new Set<string>(userIds)
  const mine = activities.filter((a) => ids.has(a.actorId))
  return periodBuckets(period, now).map((b) => {
    const list = mine.filter((a) => between(a.at, b.from, b.to))
    return { key: b.key, unit: b.unit, calls: list.filter((a) => a.kind === 'comm.call').length, whatsapp: list.filter((a) => a.kind === 'comm.whatsapp').length, notes: list.filter((a) => a.kind === 'note').length }
  })
}
