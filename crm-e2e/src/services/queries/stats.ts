/**
 * Aggregates shared by Today, Reports, Team and AI insights (first version; M1 owns and refines it).
 * Pure functions of (db, …, now). Leads are always passed in already scoped (visibility.ts), so a manager's report
 * counts the team and an executive's counts their own work.
 */
import type { Activity, DB, ID, Lead, LeadSource, LostReason, PipelineStageKey, Property, PropertyStatus, PropertyType, User } from '@/domain/types'
import { LEAD_SOURCES, LOST_REASONS, OPEN_STAGES, PROPERTY_STATUSES, STAGES } from '@/domain/catalogue'
import { localDay } from '@/lib/dates'
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
