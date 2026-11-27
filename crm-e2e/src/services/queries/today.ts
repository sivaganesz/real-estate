/**
 * Today, per role (first version; M1 owns and refines it). Pure: (db, user, now) → structured, ranked items, each with
 * a reason key (i18n `today:reason.<key>`), params, a due time, the record and the one-click actions.
 *
 * Executive ranking (ROLE_RESEARCH §5.1):
 *  1 uncalled new leads (first-response clock) · 2 visits within 2 h · 3 overdue follow-ups · 4 post-visit calls due
 *  5 hot leads not contacted for N days · 6 stale leads · then the rest of today's follow-ups.
 */
import type { Appointment, DB, EntityRef, ID, ImportJob, Lead, Task, User } from '@/domain/types'
import { OPEN_STAGES, UPCOMING_APPOINTMENT_STATUSES } from '@/domain/catalogue'
import { addMinutesIso, localDay } from '@/lib/dates'
import { findDuplicates } from '@/lib/duplicates'
import { previewAssignments } from '@/lib/assignment'
import { bestMatchesToday, type Match } from '@/lib/matching'
import { missingRequired } from '@/lib/property'
import { leadScore, type LeadScore } from '@/lib/scoring'
import { agingOf } from '@/lib/stalled'
import { visible } from './visibility'
import { activityCounts, summaryKpis, targetProgress, teamBoard, leadsBySource, funnel, overdueByExec, type ExecRow } from './stats'

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
}

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
    push({ kind: 'uncalledNew', reasonKey: due < nowIso ? 'slaBreached' : 'newLead', params: { name: l.name, mins: Math.floor((now.getTime() - new Date(l.createdAt).getTime()) / 60_000) }, dueAt: due, ref: { kind: 'lead', id: l.id }, leadId: l.id, actions: ['call', 'whatsapp', 'logOutcome', 'openLead'] })
  }
  for (const a of db.appointments) {
    if (a.ownerId !== user.id || !UPCOMING_APPOINTMENT_STATUSES.includes(a.status)) continue
    const start = new Date(a.start).getTime()
    if (start < now.getTime() || start > now.getTime() + 2 * HOUR) continue
    push({ kind: 'visitSoon', reasonKey: `soon.${a.type}`, params: { name: lead(a.leadId)?.name ?? '', mins: Math.round((start - now.getTime()) / 60_000) }, dueAt: a.start, ref: { kind: 'appointment', id: a.id }, leadId: a.leadId, actions: ['call', 'whatsapp', 'openAppointment'] })
  }
  for (const t of tasks) {
    if (t.autoReason === 'slaFirstCall' && lead(t.leadId)?.stage === 'new') continue
    const base = { params: { title: t.title, name: lead(t.leadId)?.name ?? '' }, dueAt: t.dueAt, ref: { kind: 'task' as const, id: t.id }, leadId: t.leadId }
    if (t.autoReason === 'postVisitCall' && localDay(t.dueAt) <= today) push({ ...base, kind: 'postVisitCall', reasonKey: 'postVisit', actions: ['call', 'whatsapp', 'done', 'reschedule', 'openLead'] })
    else if (t.dueAt < nowIso) push({ ...base, kind: 'overdueTask', reasonKey: 'overdue', actions: ['call', 'whatsapp', 'done', 'reschedule', 'openLead'] })
  }
  for (const l of leads) {
    const s = scores.get(l.id)
    const idle = daysSinceContact(l, now)
    if (s?.temperature === 'hot' && l.firstContactAt && idle >= db.settings.sla.hotNoContactDays) {
      push({ kind: 'hotNoContact', reasonKey: 'hotNoContact', params: { name: l.name, days: idle }, ref: { kind: 'lead', id: l.id }, leadId: l.id, actions: ['call', 'whatsapp', 'openLead'] })
    } else if (l.firstContactAt && idle >= db.settings.sla.staleDays) {
      push({ kind: 'stale', reasonKey: 'stale', params: { name: l.name, days: idle }, ref: { kind: 'lead', id: l.id }, leadId: l.id, actions: ['call', 'whatsapp', 'openLead'] })
    }
  }
  for (const t of tasks) {
    if (localDay(t.dueAt) !== today || t.dueAt < nowIso) continue
    if (t.autoReason === 'postVisitCall' || (t.autoReason === 'slaFirstCall' && lead(t.leadId)?.stage === 'new')) continue
    push({ kind: 'dueToday', reasonKey: 'dueToday', params: { title: t.title, name: lead(t.leadId)?.name ?? '' }, dueAt: t.dueAt, ref: { kind: 'task', id: t.id }, leadId: t.leadId, actions: ['call', 'whatsapp', 'done', 'reschedule', 'openLead'] })
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

export function executiveToday(db: DB, user: User, now: Date) {
  const nowIso = now.toISOString()
  const today = localDay(now)
  const leads = visible.leads(db, user).filter((l) => OPEN_STAGES.includes(l.stage))
  const scores = scoresFor(db, leads, now)
  const tasks = visible.tasks(db, user).filter((t) => t.status === 'open')
  return {
    items: priorityItems(db, user, now),
    appointments: todaysAppointments(db, [user.id], now),
    hot: leads.filter((l) => scores.get(l.id)?.temperature === 'hot').sort((a, b) => (scores.get(b.id)?.score ?? 0) - (scores.get(a.id)?.score ?? 0)),
    overdue: tasks.filter((t) => t.dueAt < nowIso).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    dueToday: tasks.filter((t) => localDay(t.dueAt) === today && t.dueAt >= nowIso).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    newToday: leads.filter((l) => localDay(l.createdAt) === today),
    notContacted: leads.filter((l) => daysSinceContact(l, now) >= db.settings.sla.hotNoContactDays),
    visitedNotBooked: leads.filter((l) => l.stage === 'siteVisitDone' || (l.engagement.siteVisited && l.stage === 'negotiation')),
    matches: bestMatchesToday(db, user, now) as Match[],
    targets: targetProgress(db, user, now),
    today: activityCounts(db, [user.id], 'today', now),
    scores,
  }
}

export function managerToday(db: DB, user: User, now: Date) {
  const nowIso = now.toISOString()
  const leads = visible.leads(db, user)
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage))
  const unassigned = open.filter((l) => l.ownerId === null).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const suggestions = previewAssignments(db, unassigned.map((l) => l.id), user.role === 'manager' ? user.id : undefined)
  const team: ExecRow[] = teamBoard(db, user, now)
  const teamIds = team.map((r) => r.user.id)
  const onLeave = team.filter((r) => r.user.availability === 'onLeave' && r.user.status === 'active' && r.openLeads > 0)
  const deactivatedOwners = team.filter((r) => r.user.status === 'deactivated' && r.openLeads > 0)
  const escalations = open.filter((l) => l.ownerId && l.stage === 'new' && !l.firstContactAt && now.getTime() - new Date(l.createdAt).getTime() > db.settings.sla.escalateAfterMins * 60_000)
  const scores = scoresFor(db, open, now)
  const highValueUntouched = open.filter((l) => (l.requirement.budgetMax ?? 0) >= 15_000_000 && !l.firstContactAt)
  return {
    unassigned: unassigned.map((l) => ({ lead: l, suggestion: suggestions.find((s) => s.leadId === l.id) })),
    team,
    overdueByExec: overdueByExec(db, user, now),
    overdueTasks: visible.tasks(db, user).filter((t) => t.status === 'open' && t.dueAt < nowIso),
    visits: todaysAppointments(db, teamIds, now),
    stalled: open.filter((l) => agingOf(l, db.settings, now).tone === 'danger'),
    negotiation: open.filter((l) => l.stage === 'negotiation'),
    attention: { escalations, highValueUntouched, onLeave, deactivatedOwners },
    targets: targetProgress(db, user, now),
    funnel: funnel(leads),
    autoAssignedToday: db.assignments.filter((a) => a.mode === 'auto' && localDay(a.at) === localDay(now) && (!a.toUserId || teamIds.includes(a.toUserId))).length,
    scores,
  }
}

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
  return {
    kpis: summaryKpis(db, user, now),
    sources: leadsBySource(leads),
    funnel: funnel(leads),
    team: teamBoard(db, user, now),
    imports: recentImports,
    alerts: {
      unassigned: unassigned.length, oldestUnassignedMins, duplicates, deactivatedOwners,
      incompleteProperties: db.properties.filter((p) => p.listing === 'live' && missingRequired(p).length > 0),
      openDrafts: db.drafts.filter((d) => d.status === 'open').length,
    },
  }
}

/** Open tasks of a user due on a given local day (Today timeline helper). */
export const tasksOnDay = (db: DB, userId: ID, day: string): Task[] =>
  db.tasks.filter((t) => t.ownerId === userId && t.status === 'open' && localDay(t.dueAt) === day).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
