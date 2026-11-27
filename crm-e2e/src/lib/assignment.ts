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
import type { Assignment, AssignmentRule, ID, Lead, Settings, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'

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
