/**
 * The global activity log (~150 entries), generated from the seeded records so every timeline is coherent:
 * lead created / assigned / stage changes, first contact, appointments, completed tasks, today's calls
 * (Arjun 7, Sneha 5, Vikram 4) and a 30-day call history that feeds the heatmap and "calls this month".
 * Params are rendered by the i18n `activity` namespace: t(`activity:${kind}`, params).
 */
import { addMinutes } from 'date-fns'
import type { Activity, ActorId, Appointment, Assignment, EntityRef, ID, Lead, Task, User } from '@/domain/types'
import type { Clock } from './dates'
import { ARJUN, SNEHA, VIKRAM } from './users'

export const CALLS_TODAY: Record<ID, number> = { [ARJUN]: 7, [SNEHA]: 5, [VIKRAM]: 4 }

export function seedActivities(c: Clock, data: { users: User[]; leads: Lead[]; appointments: Appointment[]; tasks: Task[]; assignments: Assignment[] }): Activity[] {
  const { users, leads, appointments, tasks, assignments } = data
  const out: Omit<Activity, 'id'>[] = []
  const userName = (id: ID | null | undefined) => users.find((u) => u.id === id)?.name ?? ''
  const leadRef = (id: ID): EntityRef => ({ kind: 'lead', id })
  const push = (a: Omit<Activity, 'id'>) => out.push(a)
  const current = leads.filter((l) => l.stage !== 'converted' && l.stage !== 'lost')

  for (const l of leads) {
    const closed = l.stage === 'converted' || l.stage === 'lost'
    // closed leads only carry their closing change (their full history predates the 30-day log window)
    if (!closed) push({ kind: 'lead.created', at: l.createdAt, actorId: l.createdBy, refs: [leadRef(l.id)], params: { name: l.name, source: l.source }, via: l.createdVia })
    if (!closed && l.firstContactAt) {
      push({ kind: 'comm.call', at: l.firstContactAt, actorId: l.firstOwnerId ?? l.ownerId ?? 'system', refs: [leadRef(l.id)], params: { result: 'connected', name: l.name }, via: 'manual', text: 'First call: understood the requirement and budget.' })
    }
    // current leads: the latest stage change; closed leads: the closing change
    const last = l.stageHistory[l.stageHistory.length - 1]
    const prev = l.stageHistory[l.stageHistory.length - 2]
    if (prev && last) {
      push({ kind: 'lead.stageChanged', at: last.at, actorId: last.by, refs: [leadRef(l.id)], params: { from: prev.stage, to: last.stage, name: l.name }, via: 'manual', text: l.lost?.note })
    }
  }

  for (const a of assignments) {
    if (!current.some((l) => l.id === a.leadId)) continue
    push({
      kind: a.fromUserId ? 'lead.reassigned' : 'lead.assigned', at: a.at, actorId: a.by, refs: [leadRef(a.leadId), ...(a.toUserId ? [{ kind: 'user' as const, id: a.toUserId }] : [])],
      params: { to: userName(a.toUserId), from: userName(a.fromUserId), reason: a.reason.key }, via: a.mode === 'auto' ? 'automation' : 'manual', text: a.note,
    })
  }

  for (const ap of appointments) {
    const refs: EntityRef[] = [{ kind: 'appointment', id: ap.id }, ...(ap.leadId ? [leadRef(ap.leadId)] : [])]
    push({ kind: 'appointment.created', at: ap.createdAt, actorId: ap.createdBy, refs, params: { type: ap.type }, via: 'manual' })
    if (ap.status === 'completed' && ap.outcome) push({ kind: 'appointment.completed', at: ap.outcome.at, actorId: ap.ownerId, refs, params: { type: ap.type, result: ap.outcome.result }, via: 'manual', text: ap.outcome.summary })
    if (ap.status === 'noShow') push({ kind: 'appointment.noShow', at: addMinutes(new Date(ap.start), 45).toISOString(), actorId: ap.ownerId, refs, params: { type: ap.type }, via: 'manual' })
    if (ap.status === 'cancelled') push({ kind: 'appointment.cancelled', at: addMinutes(new Date(ap.start), -600).toISOString(), actorId: ap.ownerId, refs, params: { type: ap.type }, via: 'manual', text: ap.cancelReason })
  }

  for (const t of tasks) {
    if (t.status === 'done' && t.completedAt) {
      push({ kind: 'task.completed', at: t.completedAt, actorId: t.ownerId, refs: [{ kind: 'task', id: t.id }, ...(t.leadId ? [leadRef(t.leadId)] : [])], params: { title: t.title, type: t.type }, via: 'manual', text: t.outcome })
    }
  }

  // today's calls, spread between midnight and now so they are always "today" and never in the future
  for (const [userId, count] of Object.entries(CALLS_TODAY)) {
    const mine = current.filter((l) => l.ownerId === userId)
    for (let i = 0; i < count; i++) {
      const lead = mine[i % mine.length]
      const result = i % 3 === 2 ? 'notReachable' : 'connected'
      push({ kind: 'comm.call', at: c.earlier((i + 1) / (count + 1)), actorId: userId, refs: [leadRef(lead.id)], params: { result, name: lead.name }, via: 'manual' })
    }
  }

  // 30-day call history (heatmap density): a deterministic pattern per executive, weekdays busier
  const execs: ActorId[] = [ARJUN, SNEHA, VIKRAM]
  execs.forEach((userId, e) => {
    const mine = leads.filter((l) => l.ownerId === userId)
    for (let d = 1; d <= 30; d++) {
      if ((d + e) % 3 !== 0) continue
      const lead = mine[(d + e) % mine.length]
      push({ kind: d % 4 === 0 ? 'comm.whatsapp' : 'comm.call', at: c.at(-d, `${10 + ((d + e) % 8)}:${d % 2 ? '15' : '40'}`), actorId: userId, refs: [leadRef(lead.id)], params: { result: 'connected', name: lead.name }, via: 'manual' })
    }
  })

  return out
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((a, i) => ({ ...a, id: `ACT-${1001 + i}` }))
}
