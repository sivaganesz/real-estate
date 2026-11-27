/**
 * The assignment engine (foundation-plan §5.4). Pure: the same input always gives the same pick.
 *
 * 1. Pool: active executives who are not on leave (in a visit is fine); with a manager scope, only that manager's reports.
 * 2. Rules (location → property type → language → source): each enabled rule that matches the lead narrows the pool to
 *    rule.userIds ∩ pool, but only when that leaves someone. The first rule that narrows names the reason.
 * 3. Workload = the user's leads in open stages. With maxActivePerExec, users at the cap drop out (unless that empties it).
 * 4. Lowest workload wins. A tie goes round-robin: tied users by id, the first after settings.rrCursor, wrapping.
 * 5. An empty pool → userId null, reason `unassigned`: the lead waits in the manager's queue.
 */
import type { Appointment, Assignment, AssignmentRule, ID, Lead, Property, Settings, Task, Temperature, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'
import { localDay } from './dates'
import { leadScore } from './scoring'

export type AssigneePick = { userId: ID | null; reason: Assignment['reason']; workload: Record<ID, number>; candidates: ID[] }

const RULE_ORDER: AssignmentRule['kind'][] = ['location', 'propertyType', 'language', 'source']
const RULE_REASON = { location: 'ruleLocation', propertyType: 'rulePropertyType', language: 'ruleLanguage', source: 'ruleSource' } as const
const lower = (s: string) => s.trim().toLowerCase()

/** Does a rule's values match the lead? */
export function ruleMatches(rule: AssignmentRule, lead: Pick<Lead, 'requirement' | 'source' | 'preferredLanguage'>): boolean {
  const values = rule.values.map(lower)
  switch (rule.kind) {
    case 'location':
      return [...lead.requirement.cities, ...lead.requirement.localities].some((p) => values.includes(lower(p)))
    case 'propertyType':
      return lead.requirement.propertyTypes.some((t) => values.includes(lower(t)))
    case 'language':
      return !!lead.preferredLanguage && values.includes(lower(lead.preferredLanguage))
    case 'source':
      return values.includes(lower(lead.source))
  }
}

/** Executives who can take new leads (active, not on leave), optionally only one manager's reports. */
export function assignablePool(users: User[], managerId?: ID): User[] {
  return users.filter((u) => u.role === 'executive' && u.status === 'active' && u.availability !== 'onLeave' && (!managerId || u.managerId === managerId))
}

export function workloadOf(leads: Pick<Lead, 'ownerId' | 'stage'>[], userIds: ID[]): Record<ID, number> {
  const w: Record<ID, number> = Object.fromEntries(userIds.map((id) => [id, 0]))
  for (const l of leads) if (l.ownerId && l.ownerId in w && OPEN_STAGES.includes(l.stage)) w[l.ownerId]++
  return w
}

/** The next id after `cursor` in id order, wrapping to the first. */
export function roundRobin(ids: ID[], cursor: ID | null): ID {
  const sorted = [...ids].sort()
  return (cursor && sorted.find((id) => id > cursor)) || sorted[0]
}

export function pickAssignee(input: {
  lead: Pick<Lead, 'requirement' | 'source' | 'preferredLanguage'>
  users: User[]
  leads: Pick<Lead, 'ownerId' | 'stage'>[]
  settings: Settings['assignment']
  managerId?: ID
}): AssigneePick {
  const { lead, users, leads, settings, managerId } = input
  let pool = assignablePool(users, managerId).map((u) => u.id)
  const workload = workloadOf(leads, pool)
  if (!pool.length) return { userId: null, reason: { key: 'unassigned' }, workload, candidates: [] }

  // rules, in a fixed order of kinds
  let ruleReason: Assignment['reason'] | undefined
  const rules = settings.rules
    .filter((r) => r.enabled && (r.scope === 'global' || !managerId || r.scope.managerId === managerId))
    .sort((a, b) => RULE_ORDER.indexOf(a.kind) - RULE_ORDER.indexOf(b.kind))
  for (const rule of rules) {
    if (!ruleMatches(rule, lead)) continue
    const narrowed = pool.filter((id) => rule.userIds.includes(id))
    if (!narrowed.length) continue
    if (narrowed.length < pool.length && !ruleReason) ruleReason = { key: RULE_REASON[rule.kind], params: { values: rule.values.join(', ') } }
    pool = narrowed
  }

  // the cap
  const cap = settings.maxActivePerExec
  if (cap) {
    const under = pool.filter((id) => workload[id] < cap)
    if (under.length) pool = under
  }

  const lowest = Math.min(...pool.map((id) => workload[id]))
  const tied = pool.filter((id) => workload[id] === lowest)
  if (tied.length > 1) {
    return { userId: roundRobin(tied, settings.rrCursor), reason: { key: 'roundRobinTie', params: { count: tied.length } }, workload, candidates: pool }
  }
  return { userId: tied[0], reason: ruleReason ?? { key: 'lowestWorkload', params: { count: lowest } }, workload, candidates: pool }
}

/**
 * "Who would get what" before confirming auto-assignment: replays the engine over the leads in order, updating
 * workloads and the round-robin cursor between picks exactly as the assignment service does.
 */
export function previewAssignments(
  db: { leads: Lead[]; users: User[]; settings: Pick<Settings, 'assignment'> }, ids: ID[], managerId?: ID,
): { leadId: ID; to: ID | null; reasonKey: Assignment['reason']['key'] }[] {
  const leads = db.leads.map((l) => ({ ...l }))
  const settings = { ...db.settings.assignment }
  const out: { leadId: ID; to: ID | null; reasonKey: Assignment['reason']['key'] }[] = []
  for (const id of ids) {
    const lead = leads.find((l) => l.id === id)
    if (!lead) continue
    const pick = pickAssignee({ lead, users: db.users, leads, settings, managerId })
    out.push({ leadId: id, to: pick.userId, reasonKey: pick.reason.key })
    if (pick.userId) {
      lead.ownerId = pick.userId
      settings.rrCursor = pick.userId
    }
  }
  return out
}

/* ---------- M8: the numbers the assign dialog, Team and the redistribute dialog show ---------- */

/** One executive's load and record, as the assign dialog and the Team page show it. */
export type AssigneeStats = {
  userId: ID
  /** Open leads (the engine's workload). */
  active: number
  hot: number
  warm: number
  cold: number
  /** Open tasks (follow-ups) and how many of them are overdue. */
  pendingFollowUps: number
  overdue: number
  /** Appointments today that are still on (not cancelled / completed / no-show). */
  todayAppointments: number
  /** Booked or converted, out of closed leads (booked + converted + lost) they owned; null with nothing closed yet. */
  conversionPct: number | null
}

type StatsDb = { leads: Lead[]; tasks: Task[]; appointments: Appointment[] }

/**
 * Per-user stats from plain data. `temperatureOf` is passed in (lib/scoring needs properties and settings), so this
 * stays cheap to test; `localDayOf` turns an ISO time into the local 'YYYY-MM-DD' (lib/dates.localDay).
 */
export function assigneeStats(
  db: StatsDb, userIds: ID[], now: Date,
  deps: { temperatureOf: (lead: Lead) => Temperature; localDayOf: (iso: string | Date) => string },
): Record<ID, AssigneeStats> {
  const nowIso = now.toISOString()
  const today = deps.localDayOf(now)
  const out: Record<ID, AssigneeStats> = {}
  for (const id of userIds) out[id] = { userId: id, active: 0, hot: 0, warm: 0, cold: 0, pendingFollowUps: 0, overdue: 0, todayAppointments: 0, conversionPct: null }
  const won: Record<ID, number> = {}
  const closed: Record<ID, number> = {}
  for (const l of db.leads) {
    const s = l.ownerId ? out[l.ownerId] : undefined
    if (s && OPEN_STAGES.includes(l.stage)) {
      s.active++
      s[deps.temperatureOf(l)]++
    }
    // attribution: the person who closed it (owner), else the first owner
    const credit = l.ownerId ?? l.firstOwnerId
    if (credit && credit in out && (l.stage === 'booked' || l.stage === 'converted' || l.stage === 'lost')) {
      closed[credit] = (closed[credit] ?? 0) + 1
      if (l.stage !== 'lost') won[credit] = (won[credit] ?? 0) + 1
    }
  }
  for (const t of db.tasks) {
    const s = out[t.ownerId]
    if (!s || t.status !== 'open') continue
    s.pendingFollowUps++
    if (t.dueAt < nowIso) s.overdue++
  }
  for (const a of db.appointments) {
    const s = out[a.ownerId]
    if (!s || a.status === 'cancelled' || a.status === 'completed' || a.status === 'noShow') continue
    if (deps.localDayOf(a.start) === today) s.todayAppointments++
  }
  for (const id of userIds) if (closed[id]) out[id].conversionPct = Math.round(((won[id] ?? 0) / closed[id]) * 100)
  return out
}

/** Open leads a user owns, oldest first (what a deactivation or leave hands over). */
export const openLeadsOf = (leads: Lead[], userId: ID): Lead[] =>
  leads.filter((l) => l.ownerId === userId && OPEN_STAGES.includes(l.stage)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

export type RedistributeChoice = 'auto' | 'unassign' | { toUserId: ID }

/**
 * "Who gets what" when a user is deactivated, before confirming: mirrors effects.onUserDeactivated — the user is out
 * of the pool, auto picks run in order within their manager's team (workloads and the cursor move between picks).
 */
export function previewRedistribution(
  db: { leads: Lead[]; users: User[]; settings: Pick<Settings, 'assignment'> }, userId: ID, choice: RedistributeChoice,
): { leadId: ID; to: ID | null; reasonKey: Assignment['reason']['key'] }[] {
  const leaving = db.users.find((u) => u.id === userId)
  const mine = openLeadsOf(db.leads, userId)
  if (choice === 'unassign') return mine.map((l) => ({ leadId: l.id, to: null, reasonKey: 'unassigned' }))
  if (typeof choice === 'object') return mine.map((l) => ({ leadId: l.id, to: choice.toUserId, reasonKey: 'manual' }))
  const users = db.users.map((u) => (u.id === userId ? { ...u, status: 'deactivated' as const } : u))
  return previewAssignments({ ...db, users }, mine.map((l) => l.id), leaving?.managerId)
}

/** Counts per receiver in a preview, biggest first (the summary line "Sneha 3 · Vikram 2 · unassigned 1"). */
export function previewTotals(preview: { to: ID | null }[]): { to: ID | null; count: number }[] {
  const m = new Map<ID | null, number>()
  for (const p of preview) m.set(p.to, (m.get(p.to) ?? 0) + 1)
  return [...m.entries()].map(([to, count]) => ({ to, count })).sort((a, b) => b.count - a.count || String(a.to).localeCompare(String(b.to)))
}

/** assigneeStats over the whole database, with temperatures from the lead score (lib/scoring) and local days. */
export function assigneeStatsFromDb(db: StatsDb & { properties: Property[]; settings: Settings }, userIds: ID[], now: Date): Record<ID, AssigneeStats> {
  const ctx = { properties: db.properties, settings: db.settings, now }
  return assigneeStats(db, userIds, now, {
    temperatureOf: (l) => l.temperatureOverride ?? leadScore(l, ctx).temperature,
    localDayOf: (d) => localDay(d),
  })
}
