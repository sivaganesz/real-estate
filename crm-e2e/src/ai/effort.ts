/**
 * "How much manual effort did AI save?" (master prompt §12.0): counted from the real records, never invented.
 * - actions: changes the user made through the assistant today (activities with via 'ai');
 * - fields: AI-filled fields on leads, properties and appointments the user created or updated today;
 * - autoAssigned: leads auto-assigned today in the user's scope (assignments with mode 'auto');
 * - autoTasks: follow-ups the automations created for the user today;
 * - minutes: a rough estimate (10 s per field, 45 s per assistant action, 60 s per assignment, 30 s per task), shown
 *   as "about".
 * Pure; no React, no store.
 */
import type { DB, User } from '@/domain/types'
import { localDay } from '@/lib/dates'
import { scopeUserIds } from '@/services/queries/stats'

export type EffortSaved = { actions: number; fields: number; autoAssigned: number; autoTasks: number; minutes: number }

const aiFields = (meta: Record<string, { origin: string }> | undefined) => Object.values(meta ?? {}).filter((m) => m.origin === 'ai').length

export function effortSaved(db: DB, user: User, now: Date): EffortSaved {
  const today = localDay(now)
  const onDay = (iso: string | undefined) => !!iso && localDay(iso) === today
  const scope = new Set(scopeUserIds(db, user))
  const actions = db.activities.filter((a) => a.via === 'ai' && a.actorId === user.id && onDay(a.at)).length
  const fields =
    db.leads.filter((l) => l.createdBy === user.id && (onDay(l.createdAt) || onDay(l.updatedAt))).reduce((n, l) => n + aiFields(l.fieldMeta), 0)
    + db.properties.filter((p) => p.createdBy === user.id && (onDay(p.createdAt) || onDay(p.updatedAt))).reduce((n, p) => n + aiFields(p.fieldMeta), 0)
    + db.appointments.filter((a) => a.createdBy === user.id && onDay(a.createdAt)).reduce((n, a) => n + aiFields(a.fieldMeta), 0)
  const autoAssigned = db.assignments.filter((a) => a.mode === 'auto' && onDay(a.at) && (user.role === 'admin' || (a.toUserId !== null && scope.has(a.toUserId)))).length
  const autoTasks = db.tasks.filter((x) => x.origin === 'automation' && x.ownerId === user.id && onDay(x.createdAt)).length
  const minutes = Math.round((fields * 10 + actions * 45 + autoAssigned * 60 + autoTasks * 30) / 60)
  return { actions, fields, autoAssigned, autoTasks, minutes }
}

/** Leads auto-assigned today in the user's scope (Manager Today: "12 leads auto-assigned today"). */
export const autoAssignedToday = (db: DB, user: User, now: Date) => effortSaved(db, user, now).autoAssigned
