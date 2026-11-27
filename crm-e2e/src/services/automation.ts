/**
 * Timers (foundation-plan §5.3): run on hydrate and then every 60 s. Idempotent: every notification carries a
 * dedupeKey, so a tick that finds nothing new changes nothing (and causes no re-render).
 * The ticker never changes leads or tasks; it only adds notifications.
 *
 *  - taskOverdue: once per task, to its owner
 *  - appointmentReminder: once, `reminderMins` before the start, to the owner
 *  - slaBreach: a new lead with an owner and no first contact after `firstResponseMins` → the owner;
 *    after `escalateAfterMins` → an escalation to the manager
 *  - unassigned queue: open unassigned leads older than `firstResponseMins` → one daily note to managers and admins
 *  - stalledDeal: once a day per lead, to the manager, when days in stage > 2 × target in qualified / visit done / negotiation
 */
import type { DB, EntityRef, ID, Notification, NotificationKind } from '@/domain/types'
import { OPEN_STAGES, UPCOMING_APPOINTMENT_STATUSES } from '@/domain/catalogue'
import { clockTime, localDay } from '@/lib/dates'
import { STALL_WATCH, agingOf } from '@/lib/stalled'
import { onDbHydrated } from '@/store/db-store'
import { SYSTEM_ACTOR, clock } from './core/actor'
import { commit, getDb } from './core/commit'
import { notify } from './core/effects'

export type DueNotification = { userId: ID; kind: NotificationKind; params: Notification['params']; ref?: EntityRef; priority?: Notification['priority']; dedupeKey: string }

const MIN = 60_000

/** Everything the timers would send now, before de-duplication against existing notifications. Pure. */
export function collectDue(db: DB, now: Date): DueNotification[] {
  const out: DueNotification[] = []
  const nowMs = now.getTime()
  const nowIso = now.toISOString()
  const today = localDay(now)
  const user = (id: ID | null | undefined) => db.users.find((u) => u.id === id)
  const managersOf = (id: ID | null | undefined) => {
    const m = user(id)?.managerId
    return m ? [m] : db.users.filter((u) => u.role === 'manager' && u.status === 'active').map((u) => u.id)
  }
  const sla = db.settings.sla

  for (const t of db.tasks) {
    if (t.status !== 'open' || t.dueAt >= nowIso) continue
    const lead = db.leads.find((l) => l.id === t.leadId)
    out.push({ userId: t.ownerId, kind: 'taskOverdue', params: { title: t.title, name: lead?.name ?? '' }, ref: { kind: 'task', id: t.id }, dedupeKey: `overdue:${t.id}` })
  }

  for (const a of db.appointments) {
    if (!UPCOMING_APPOINTMENT_STATUSES.includes(a.status)) continue
    const start = new Date(a.start).getTime()
    if (nowMs >= start || nowMs < start - a.reminderMins * MIN) continue
    const lead = db.leads.find((l) => l.id === a.leadId)
    const property = db.properties.find((p) => p.id === a.propertyIds[0])
    out.push({
      userId: a.ownerId, kind: 'appointmentReminder', params: { name: lead?.name ?? '', property: property?.title ?? '', time: clockTime(a.start) },
      ref: { kind: 'appointment', id: a.id }, dedupeKey: `reminder:${a.id}${a.rescheduledFrom ? `:${a.start}` : ''}`,
    })
  }

  let unassigned = 0
  for (const l of db.leads) {
    if (!OPEN_STAGES.includes(l.stage)) continue
    const ageMin = (nowMs - new Date(l.createdAt).getTime()) / MIN
    if (!l.ownerId) {
      if (ageMin >= sla.firstResponseMins) unassigned++
      continue
    }
    if (l.stage === 'new' && !l.firstContactAt && ageMin >= sla.firstResponseMins) {
      out.push({ userId: l.ownerId, kind: 'slaBreach', params: { name: l.name, mins: sla.firstResponseMins }, ref: { kind: 'lead', id: l.id }, priority: 'high', dedupeKey: `sla:${l.id}` })
      if (ageMin >= sla.escalateAfterMins) {
        for (const m of managersOf(l.ownerId)) {
          out.push({ userId: m, kind: 'escalation', params: { name: l.name, owner: user(l.ownerId)?.name ?? '', mins: Math.floor(ageMin) }, ref: { kind: 'lead', id: l.id }, priority: 'high', dedupeKey: `escalation:${l.id}` })
        }
      }
    }
    if (STALL_WATCH.includes(l.stage)) {
      const aging = agingOf(l, db.settings, now)
      if (aging.tone === 'danger') {
        for (const m of managersOf(l.ownerId)) {
          out.push({ userId: m, kind: 'stalledDeal', params: { name: l.name, days: aging.days, stage: l.stage }, ref: { kind: 'lead', id: l.id }, dedupeKey: `stalled:${l.id}:${today}` })
        }
      }
    }
  }
  if (unassigned) {
    const recipients = db.users.filter((u) => (u.role === 'manager' || u.role === 'admin') && u.status === 'active')
    for (const r of recipients) out.push({ userId: r.id, kind: 'slaBreach', params: { count: unassigned, mins: sla.firstResponseMins }, priority: 'high', dedupeKey: `unassigned-queue:${today}` })
  }
  return out
}

const isNew = (db: DB, n: DueNotification) => {
  const u = db.users.find((x) => x.id === n.userId)
  return !!u && u.status === 'active' && !db.notifications.some((x) => x.userId === n.userId && x.dedupeKey === n.dedupeKey)
}

/** One pass of the timers. Returns how many notifications were added. */
export function tick(now: Date = clock.now()): number {
  const due = collectDue(getDb(), now).filter((n) => isNew(getDb(), n))
  if (!due.length) return 0
  const { result } = commit('automation.tick', (tx) => {
    let added = 0
    for (const n of due) if (notify(tx, n.userId, n.kind, n.params, { ref: n.ref, priority: n.priority, dedupeKey: n.dedupeKey })) added++
    return added
  }, { via: 'automation', actor: SYSTEM_ACTOR })
  return result
}

/** Starts the ticker: once the stored database is loaded, then every minute. Returns a stop function. */
export function startAutomation(intervalMs = 60_000): () => void {
  const off = onDbHydrated(() => {
    tick()
  })
  const id = setInterval(() => tick(), intervalMs)
  return () => {
    off()
    clearInterval(id)
  }
}
