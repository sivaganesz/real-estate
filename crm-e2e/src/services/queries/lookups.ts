/** Small pure lookups shared by the shell and modules. */
import type { DB, ID, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'
import { localDay } from '@/lib/dates'
import { can } from '@/lib/permissions'
import { visible } from './visibility'

export const userById = (db: Pick<DB, 'users'>, id: ID | null | undefined): User | undefined =>
  id ? db.users.find((u) => u.id === id) : undefined

/** Open leads owned by a user (the workload the assignment engine uses). */
export const activeLeadCount = (db: Pick<DB, 'leads'>, userId: ID): number =>
  db.leads.filter((l) => l.ownerId === userId && OPEN_STAGES.includes(l.stage)).length

/** Live counts for the sidebar badges, scoped to what the user can see. */
export function navCounts(db: DB, user: User, now: Date) {
  const nowIso = now.toISOString()
  const today = localDay(now)
  const unassigned = can(user, 'lead.assign') ? db.leads.filter((l) => l.ownerId === null && OPEN_STAGES.includes(l.stage)).length : 0
  const overdueTasks = visible.tasks(db, user).filter((t) => t.status === 'open' && t.dueAt < nowIso).length
  const todayAppointments = visible.appointments(db, user).filter(
    (a) => localDay(a.start) === today && a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'noShow',
  ).length
  const unreadNotifications = db.notifications.filter((n) => n.userId === user.id && !n.readAt).length
  return { unassigned, overdueTasks, todayAppointments, unreadNotifications }
}
export type NavCounts = ReturnType<typeof navCounts>

export const leadById = (db: Pick<DB, 'leads'>, id: ID | null | undefined) => (id ? db.leads.find((l) => l.id === id) : undefined)
export const propertyById = (db: Pick<DB, 'properties'>, id: ID | null | undefined) => (id ? db.properties.find((p) => p.id === id) : undefined)
export const clientById = (db: Pick<DB, 'clients'>, id: ID | null | undefined) => (id ? db.clients.find((c) => c.id === id) : undefined)
export const appointmentById = (db: Pick<DB, 'appointments'>, id: ID | null | undefined) => (id ? db.appointments.find((a) => a.id === id) : undefined)
export const taskById = (db: Pick<DB, 'tasks'>, id: ID | null | undefined) => (id ? db.tasks.find((t) => t.id === id) : undefined)

/** A lead's open tasks, earliest first. */
export const openTasksForLead = (db: Pick<DB, 'tasks'>, leadId: ID) =>
  db.tasks.filter((t) => t.leadId === leadId && t.status === 'open').sort((a, b) => a.dueAt.localeCompare(b.dueAt))

/** The next follow-up of a lead: its earliest open task (derived, never stored). */
export const nextFollowUp = (db: Pick<DB, 'tasks'>, leadId: ID) => openTasksForLead(db, leadId)[0]

/** A lead's appointments, latest first. */
export const appointmentsForLead = (db: Pick<DB, 'appointments'>, leadId: ID) =>
  db.appointments.filter((a) => a.leadId === leadId).sort((a, b) => b.start.localeCompare(a.start))

/** Activities that mention a record (a timeline), newest first. */
export const timelineFor = (db: Pick<DB, 'activities'>, kind: string, id: ID) =>
  db.activities.filter((a) => a.refs.some((r) => r.kind === kind && r.id === id)).sort((a, b) => b.at.localeCompare(a.at))

/** Assignment history of a lead, oldest first. */
export const assignmentsForLead = (db: Pick<DB, 'assignments'>, leadId: ID) =>
  db.assignments.filter((a) => a.leadId === leadId).sort((a, b) => a.at.localeCompare(b.at))
