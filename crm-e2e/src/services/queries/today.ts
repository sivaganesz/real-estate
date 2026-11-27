/**
 * Today, per role (master prompt §6, ROLE_RESEARCH §5; owned by M1). Pure: (db, user, now) → structured, ranked items,
 * each with a reason key (i18n `today:reason.<key>`), params, a due time, the record and the one-click actions.
 * Nothing here is stored: the Today page recomputes it on every write, so a click re-ranks the list at once.
 *
 * Executive ranking (ROLE_RESEARCH §5.1):
 *  1 uncalled new leads (first-response clock) · 2 visits within 2 h · 3 overdue follow-ups · 4 post-visit calls due
 *  5 hot leads not contacted for N days · 6 stale leads · then the rest of today's follow-ups.
 * Inside a rank: hot leads first, then the earliest due time.
 * A hot or stale lead with a follow-up already planned (an open task due later) is not repeated: it was handled.
 */
import type { Appointment, DB, EntityRef, ID, ImportJob, Lead, Task, User } from '@/domain/types'
import { OPEN_STAGES, UPCOMING_APPOINTMENT_STATUSES } from '@/domain/catalogue'
import { addMinutesIso, clockTime, localDay } from '@/lib/dates'
import { findDuplicates } from '@/lib/duplicates'
import { previewAssignments } from '@/lib/assignment'
import { bestMatchesToday, type Match } from '@/lib/matching'
import { missingRequired } from '@/lib/property'
import { leadScore, type LeadScore } from '@/lib/scoring'
import { agingOf } from '@/lib/stalled'
import { visible } from './visibility'
import {
  activityCounts, closedAt, conversionRate, conversionSeries, dailySeries, inventoryByStatus, leadsBySource, funnel,
  overdueByExec, pctChange, periodBounds, pipelineValueSeries, streakDays, summaryKpis, targetProgress, teamBoard,
  teamRank, between, lostReasonsIn, type ExecRow,
} from './stats'

export type TodayAction = 'call' | 'whatsapp' | 'logOutcome' | 'reschedule' | 'done' | 'openLead' | 'openAppointment' | 'assign' | 'navigate'
export type TodayKind = 'uncalledNew' | 'visitSoon' | 'overdueTask' | 'postVisitCall' | 'hotNoContact' | 'stale' | 'dueToday'
export type TodayItem = {
  kind: TodayKind
  rank: number
  reasonKey: string
  params: Record<string, string | number>
  dueAt?: string
  ref: EntityRef
  leadId?: ID
  actions: TodayAction[]
  /** The due time has passed (first-response breached, task overdue). */
  overdue?: boolean
}

export const TODAY_KINDS: TodayKind[] = ['uncalledNew', 'visitSoon', 'overdueTask', 'postVisitCall', 'hotNoContact', 'stale', 'dueToday']
const RANK: Record<TodayKind, number> = { uncalledNew: 1, visitSoon: 2, overdueTask: 3, postVisitCall: 4, hotNoContact: 5, stale: 6, dueToday: 7 }
const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Scores for many leads at once (memoise per db in the UI). */
export function scoresFor(db: DB, leads: Lead[], now: Date): Map<ID, LeadScore> {
  const ctx = { properties: db.properties, settings: db.settings, now }
  return new Map(leads.map((l) => [l.id, leadScore(l, ctx)]))
}

const daysSinceContact = (l: Lead, now: Date) => Math.floor((now.getTime() - new Date(l.lastContactAt ?? l.createdAt).getTime()) / DAY)

/** The ranked priority list for an executive (or any user's own work). */
export function priorityItems(db: DB, user: User, now: Date): TodayItem[] {
  const nowIso = now.toISOString()
  const today = localDay(now)
  const leads = db.leads.filter((l) => l.ownerId === user.id && OPEN_STAGES.includes(l.stage))
  const tasks = db.tasks.filter((t) => t.ownerId === user.id && t.status === 'open')
  const scores = scoresFor(db, leads, now)
  const lead = (id: ID | undefined) => db.leads.find((l) => l.id === id)
  const planned = new Set(tasks.filter((t) => t.leadId && t.dueAt >= nowIso).map((t) => t.leadId))
  const items: TodayItem[] = []
  const used = new Set<string>()
  const push = (it: Omit<TodayItem, 'rank'>) => {
    const key = `${it.kind}:${it.ref.kind}:${it.ref.id}`
    if (used.has(key)) return
    used.add(key)
    items.push({ ...it, rank: RANK[it.kind] })
  }

  for (const l of leads) {
    if (l.stage !== 'new' || l.firstContactAt) continue
    const due = addMinutesIso(l.createdAt, db.settings.sla.firstResponseMins)
    const breached = due < nowIso
    push({
      kind: 'uncalledNew', reasonKey: breached ? 'slaBreached' : 'newLead', overdue: breached,
      params: { name: l.name, mins: Math.max(0, Math.floor((now.getTime() - new Date(l.createdAt).getTime()) / 60_000)) },
      dueAt: due, ref: { kind: 'lead', id: l.id }, leadId: l.id, actions: ['call', 'whatsapp', 'logOutcome', 'openLead'],
    })
  }
  for (const a of db.appointments) {
    if (a.ownerId !== user.id || !UPCOMING_APPOINTMENT_STATUSES.includes(a.status)) continue
    const start = new Date(a.start).getTime()
    if (start < now.getTime() || start > now.getTime() + 2 * HOUR) continue
    push({ kind: 'visitSoon', reasonKey: `soon.${a.type}`, params: { name: lead(a.leadId)?.name ?? '', mins: Math.round((start - now.getTime()) / 60_000), time: clockTime(a.start) }, dueAt: a.start, ref: { kind: 'appointment', id: a.id }, leadId: a.leadId, actions: ['call', 'whatsapp', 'reschedule', 'openAppointment'] })
  }
  for (const t of tasks) {
    if (t.autoReason === 'slaFirstCall' && lead(t.leadId)?.stage === 'new') continue
    const base = { params: { title: t.title, name: lead(t.leadId)?.name ?? '' }, dueAt: t.dueAt, ref: { kind: 'task' as const, id: t.id }, leadId: t.leadId, overdue: t.dueAt < nowIso }
    const actions: TodayAction[] = t.leadId ? ['call', 'whatsapp', 'logOutcome', 'done', 'reschedule', 'openLead'] : ['done', 'reschedule']
    if (t.autoReason === 'postVisitCall' && localDay(t.dueAt) <= today) push({ ...base, kind: 'postVisitCall', reasonKey: 'postVisit', actions })
    else if (t.dueAt < nowIso) push({ ...base, kind: 'overdueTask', reasonKey: 'overdue', actions })
  }
  for (const l of leads) {
    if (planned.has(l.id) || !l.firstContactAt) continue
    const s = scores.get(l.id)
    const idle = daysSinceContact(l, now)
    const actions: TodayAction[] = ['call', 'whatsapp', 'logOutcome', 'reschedule', 'openLead']
    if (s?.temperature === 'hot' && idle >= db.settings.sla.hotNoContactDays) {
      push({ kind: 'hotNoContact', reasonKey: 'hotNoContact', params: { name: l.name, days: idle }, ref: { kind: 'lead', id: l.id }, leadId: l.id, actions })
    } else if (idle >= db.settings.sla.staleDays) {
      push({ kind: 'stale', reasonKey: 'stale', params: { name: l.name, days: idle }, ref: { kind: 'lead', id: l.id }, leadId: l.id, actions })
    }
  }
  for (const t of tasks) {
    if (localDay(t.dueAt) !== today || t.dueAt < nowIso) continue
    if (t.autoReason === 'postVisitCall' || (t.autoReason === 'slaFirstCall' && lead(t.leadId)?.stage === 'new')) continue
    const actions: TodayAction[] = t.leadId ? ['call', 'whatsapp', 'logOutcome', 'done', 'reschedule', 'openLead'] : ['done', 'reschedule']
    push({ kind: 'dueToday', reasonKey: 'dueToday', params: { title: t.title, name: lead(t.leadId)?.name ?? '' }, dueAt: t.dueAt, ref: { kind: 'task', id: t.id }, leadId: t.leadId, actions })
  }

  const hot = (it: TodayItem) => (it.leadId && scores.get(it.leadId)?.temperature === 'hot' ? 0 : 1)
  return items.sort((a, b) => a.rank - b.rank || hot(a) - hot(b) || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'))
}

const todaysAppointments = (db: DB, ownerIds: ID[], now: Date): Appointment[] => {
  const today = localDay(now)
  return db.appointments
    .filter((a) => ownerIds.includes(a.ownerId) && localDay(a.start) === today && a.status !== 'cancelled')
    .sort((a, b) => a.start.localeCompare(b.start))
}

/** The last completed site visit of a lead (for the "Visited, not booked" strip). */
const lastVisitAt = (db: DB, leadId: ID): string | undefined =>
  db.appointments
    .filter((a) => a.leadId === leadId && a.type === 'siteVisit' && a.status === 'completed')
    .map((a) => a.outcome?.at ?? a.start)
    .sort()
    .pop()

export type VisitedNotBooked = { lead: Lead; visitedAt: string; days: number }

export function executiveToday(db: DB, user: User, now: Date) {
  const nowIso = now.toISOString()
  const today = localDay(now)
  const leads = visible.leads(db, user).filter((l) => OPEN_STAGES.includes(l.stage))
  const scores = scoresFor(db, leads, now)
  const tasks = visible.tasks(db, user).filter((t) => t.status === 'open')
  const items = priorityItems(db, user, now)
  const appointments = todaysAppointments(db, [user.id], now)
  const notContactedDays = db.settings.sla.hotNoContactDays
  const visitedNotBooked: VisitedNotBooked[] = leads
    .filter((l) => l.stage === 'siteVisitDone' || (l.engagement.siteVisited && l.stage === 'negotiation'))
    .map((lead) => {
      const visitedAt = lastVisitAt(db, lead.id) ?? lead.stageSince
      return { lead, visitedAt, days: Math.max(0, Math.floor((now.getTime() - new Date(visitedAt).getTime()) / DAY)) }
    })
    .filter((x) => x.days <= 14)
    .sort((a, b) => a.days - b.days)
  const overdue = tasks.filter((t) => t.dueAt < nowIso).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const dueToday = tasks.filter((t) => localDay(t.dueAt) === today && t.dueAt >= nowIso).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  return {
    items,
    appointments,
    nextAppointment: appointments.find((a) => a.start >= nowIso && UPCOMING_APPOINTMENT_STATUSES.includes(a.status)),
    hot: leads.filter((l) => (l.temperatureOverride ?? scores.get(l.id)?.temperature) === 'hot').sort((a, b) => (scores.get(b.id)?.score ?? 0) - (scores.get(a.id)?.score ?? 0)),
    overdue,
    dueToday,
    newToday: leads.filter((l) => localDay(l.createdAt) === today),
    notContacted: leads.filter((l) => daysSinceContact(l, now) >= notContactedDays).sort((a, b) => daysSinceContact(b, now) - daysSinceContact(a, now)),
    notContactedDays,
    visitedNotBooked,
    matches: bestMatchesToday(db, user, now) as Match[],
    targets: targetProgress(db, user, now),
    today: activityCounts(db, [user.id], 'today', now),
    rank: teamRank(db, user, now),
    streak: streakDays(db.activities, user.id, now),
    scores,
  }
}
export type ExecutiveToday = ReturnType<typeof executiveToday>

/** The numbers the executive greeting is built from (the sentence itself is assembled in the UI, in the UI language). */
export function executiveBriefFacts(t: Pick<ExecutiveToday, 'items' | 'appointments' | 'overdue' | 'dueToday' | 'newToday' | 'scores'>, now: Date) {
  const nowIso = now.toISOString()
  const first = t.items[0]
  return {
    visits: t.appointments.filter((a) => a.type === 'siteVisit' && a.status !== 'completed' && a.status !== 'noShow').length,
    visitsLeft: t.appointments.filter((a) => a.start >= nowIso && UPCOMING_APPOINTMENT_STATUSES.includes(a.status)).length,
    followUps: t.dueToday.length + t.overdue.length,
    overdue: t.overdue.length,
    newLeads: t.newToday.length,
    first,
    firstHot: !!first?.leadId && t.scores.get(first.leadId)?.temperature === 'hot',
  }
}

export type UnassignedRow = { lead: Lead; suggestion?: ReturnType<typeof previewAssignments>[number]; ageMins: number; breached: boolean }

export function managerToday(db: DB, user: User, now: Date) {
  const nowIso = now.toISOString()
  const leads = visible.leads(db, user)
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage))
  const unassignedLeads = open.filter((l) => l.ownerId === null).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const suggestions = previewAssignments(db, unassignedLeads.map((l) => l.id), user.role === 'manager' ? user.id : undefined)
  const team: ExecRow[] = teamBoard(db, user, now)
  const teamIds = team.map((r) => r.user.id)
  const onLeave = team.filter((r) => r.user.availability === 'onLeave' && r.user.status === 'active' && r.openLeads > 0)
  const deactivatedOwners = team.filter((r) => r.user.status === 'deactivated' && r.openLeads > 0)
  const escalations = open.filter((l) => l.ownerId && l.stage === 'new' && !l.firstContactAt && now.getTime() - new Date(l.createdAt).getTime() > db.settings.sla.escalateAfterMins * 60_000)
  const scores = scoresFor(db, open, now)
  const highValueUntouched = open.filter((l) => (l.requirement.budgetMax ?? 0) >= 15_000_000 && (!l.firstContactAt || Math.floor((now.getTime() - new Date(l.lastContactAt ?? l.createdAt).getTime()) / DAY) >= db.settings.sla.hotNoContactDays))
  const overdueTasks = visible.tasks(db, user).filter((t) => t.status === 'open' && t.dueAt < nowIso).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const missedPostVisit = overdueTasks.filter((t) => t.autoReason === 'postVisitCall')
  return {
    unassigned: unassignedLeads.map((l): UnassignedRow => {
      const ageMins = Math.max(0, Math.floor((now.getTime() - new Date(l.createdAt).getTime()) / 60_000))
      return { lead: l, suggestion: suggestions.find((s) => s.leadId === l.id), ageMins, breached: ageMins > db.settings.sla.firstResponseMins }
    }),
    team,
    teamToday: activityCounts(db, teamIds, 'today', now),
    overdueByExec: overdueByExec(db, user, now).map((x) => ({ ...x, tasks: overdueTasks.filter((t) => t.ownerId === x.userId) })),
    overdueTasks,
    visits: todaysAppointments(db, teamIds, now),
    stalled: open.filter((l) => agingOf(l, db.settings, now).tone === 'danger').sort((a, b) => a.stageSince.localeCompare(b.stageSince)),
    negotiation: open.filter((l) => l.stage === 'negotiation'),
    attention: { escalations, highValueUntouched, onLeave, deactivatedOwners, missedPostVisit },
    targets: targetProgress(db, user, now),
    funnel: funnel(leads),
    autoAssignedToday: db.assignments.filter((a) => a.mode === 'auto' && localDay(a.at) === localDay(now) && (!a.toUserId || teamIds.includes(a.toUserId))).length,
    scores,
  }
}
export type ManagerToday = ReturnType<typeof managerToday>

/** Open leads owned by a user, for one-click "reassign with auto-assign" proposals. */
export const openLeadIdsOf = (db: Pick<DB, 'leads'>, userId: ID): ID[] =>
  db.leads.filter((l) => l.ownerId === userId && OPEN_STAGES.includes(l.stage)).map((l) => l.id)

export function adminToday(db: DB, user: User, now: Date) {
  const leads = db.leads
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage))
  const unassigned = open.filter((l) => l.ownerId === null)
  const oldestUnassignedMins = unassigned.length ? Math.max(...unassigned.map((l) => Math.floor((now.getTime() - new Date(l.createdAt).getTime()) / 60_000))) : 0
  const seen = new Set<ID>()
  const duplicates: { lead: Lead; other: Lead }[] = []
  for (const l of open) {
    if (seen.has(l.id)) continue
    const d = findDuplicates({ leads: open }, { phone: l.phone, email: l.email, excludeId: l.id })[0]
    if (d) {
      seen.add(l.id)
      seen.add(d.lead.id)
      duplicates.push({ lead: l.createdAt > d.lead.createdAt ? l : d.lead, other: l.createdAt > d.lead.createdAt ? d.lead : l })
    }
  }
  const deactivatedOwners = db.users
    .filter((u) => u.status === 'deactivated')
    .map((u) => ({ user: u, count: open.filter((l) => l.ownerId === u.id).length }))
    .filter((x) => x.count > 0)
  const recentImports: ImportJob[] = [...db.importJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const kpis = summaryKpis(db, user, now)
  const yesterday = new Date(now.getTime() - DAY)
  const month = periodBounds('month', now)
  const visitStarts = db.appointments.filter((a) => a.type === 'siteVisit' && a.status !== 'cancelled').map((a) => a.start)
  const conv = conversionSeries(leads, now)
  const pipe = pipelineValueSeries(leads, now)
  const missingLeadData = open.filter((l) => !l.requirement.budgetMax || (!l.requirement.cities.length && !l.requirement.localities.length))
  return {
    kpis,
    series: {
      newLeads: dailySeries(leads.map((l) => l.createdAt), now),
      visits: dailySeries(visitStarts, now),
      bookings: dailySeries(leads.map((l) => l.deal?.bookedAt), now, 30),
      pipeline: pipe,
      conversion: conv,
    },
    deltas: {
      newLeads: kpis.newLeadsToday - leads.filter((l) => localDay(l.createdAt) === localDay(yesterday)).length,
      visits: kpis.visitsToday - visitStarts.filter((s) => localDay(s) === localDay(yesterday)).length,
      bookings: pctChange(kpis.bookingsThisMonth, leads.filter((l) => between(l.deal?.bookedAt, month.prevFrom, month.prevTo)).length),
      pipeline: pctChange(pipe[pipe.length - 1] ?? 0, pipe[pipe.length - 5] ?? 0),
      conversion: (conv[conv.length - 1] ?? 0) - (conv[conv.length - 2] ?? 0),
    },
    inventory: inventoryByStatus(db.properties),
    sources: leadsBySource(leads),
    funnel: funnel(leads),
    team: teamBoard(db, user, now),
    imports: recentImports,
    importTotals: {
      jobs: db.importJobs.filter((j) => between(j.createdAt, month.from, month.to)).length,
      imported: db.importJobs.filter((j) => between(j.createdAt, month.from, month.to)).reduce((n, j) => n + j.counts.imported, 0),
      duplicates: db.importJobs.filter((j) => between(j.createdAt, month.from, month.to)).reduce((n, j) => n + j.counts.duplicates, 0),
    },
    alerts: {
      unassigned: unassigned.length, unassignedIds: unassigned.map((l) => l.id), oldestUnassignedMins, duplicates, deactivatedOwners,
      incompleteProperties: db.properties.filter((p) => p.listing === 'live' && missingRequired(p).length > 0),
      missingLeadData,
      openDrafts: db.drafts.filter((d) => d.status === 'open').length,
    },
    insights: businessInsights(db, now),
  }
}
export type AdminToday = ReturnType<typeof adminToday>

/** Open tasks of a user due on a given local day (Today timeline helper). */
export const tasksOnDay = (db: DB, userId: ID, day: string): Task[] =>
  db.tasks.filter((t) => t.ownerId === userId && t.status === 'open' && localDay(t.dueAt) === day).sort((a, b) => a.dueAt.localeCompare(b.dueAt))

/* ---------- AI business insights (simulated: rules over the real data, shown with the Demo AI badge) ---------- */

export type InsightLink =
  | { to: 'reports'; tab?: string } | { to: 'leads' } | { to: 'pipeline' } | { to: 'properties' } | { to: 'import' }
  | { to: 'lead'; id: ID } | { to: 'team' }
export type Insight = {
  key: string
  params: Record<string, string | number>
  /** Params that are i18n keys themselves (a source or a reason), translated by the UI. */
  tParams?: Record<string, string>
  tone: 'success' | 'warning' | 'danger' | 'info' | 'primary'
  link: InsightLink
}

/** 3–5 short, data-backed observations for the admin, most useful first, each with a drill-down. */
export function businessInsights(db: DB, now: Date): Insight[] {
  const out: Insight[] = []
  const leads = db.leads
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage))
  // 1. the source that converts best to bookings (at least 3 leads, so one lucky lead does not win)
  const sources = leadsBySource(leads).filter((s) => s.count >= 3)
  const best = [...sources].sort((a, b) => b.booked / b.count - a.booked / a.count || b.count - a.count)[0]
  if (best && best.booked > 0) {
    out.push({ key: 'bestSource', params: { pct: Math.round((best.booked / best.count) * 100), count: best.count }, tParams: { source: `catalogue:source.${best.source}` }, tone: 'success', link: { to: 'reports', tab: 'sources' } })
  }
  // 2. the main reason deals were lost in the last 90 days
  const since = new Date(now.getTime() - 90 * DAY)
  const top = lostReasonsIn(leads, since, now).sort((a, b) => b.count - a.count)[0]
  if (top && top.count > 0) out.push({ key: 'lostReason', params: { count: top.count }, tParams: { reason: `catalogue:lostReason.${top.reason}` }, tone: 'warning', link: { to: 'reports', tab: 'pipeline' } })
  // 3. leads waiting for an owner
  const unassigned = open.filter((l) => l.ownerId === null)
  if (unassigned.length) {
    const oldest = Math.max(...unassigned.map((l) => Math.floor((now.getTime() - new Date(l.createdAt).getTime()) / HOUR)))
    out.push({ key: 'unassigned', params: { count: unassigned.length, hours: oldest }, tone: 'danger', link: { to: 'leads' } })
  }
  // 4. stalled deals and the value at risk
  const stalled = open.filter((l) => agingOf(l, db.settings, now).tone === 'danger')
  if (stalled.length) out.push({ key: 'stalled', params: { count: stalled.length, value: stalled.reduce((n, l) => n + (l.deal?.value ?? l.requirement.budgetMax ?? 0), 0) }, tone: 'warning', link: { to: 'pipeline' } })
  // 5. where unsold inventory piles up
  const byLocality = new Map<string, number>()
  for (const p of db.properties) if (p.status === 'available' && p.listing === 'live') byLocality.set(p.location.locality, (byLocality.get(p.location.locality) ?? 0) + 1)
  const pile = [...byLocality.entries()].sort((a, b) => b[1] - a[1])[0]
  if (pile && pile[1] >= 2) out.push({ key: 'inventory', params: { count: pile[1], locality: pile[0] }, tone: 'info', link: { to: 'properties' } })
  // 6. conversion this month against the closed-deal average
  const rate = conversionRate(leads)
  const closedThisMonth = leads.filter((l) => between(closedAt(l) ?? l.deal?.bookedAt, periodBounds('month', now).from, now)).length
  if (out.length < 5 && closedThisMonth) out.push({ key: 'conversion', params: { pct: rate, count: closedThisMonth }, tone: 'primary', link: { to: 'reports', tab: 'overview' } })
  return out.slice(0, 5)
}
