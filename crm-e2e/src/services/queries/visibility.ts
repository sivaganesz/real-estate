/**
 * What a user may see (foundation-plan §3.2): pure functions of (db, user). Every list reads through these,
 * so switching profile changes the data scope automatically.
 */
import type { Activity, Appointment, Client, DB, Lead, Task, User } from '@/domain/types'
import { can, scopeOf } from '@/lib/permissions'

export const visible = {
  leads: (db: DB, user: User): Lead[] => db.leads.filter((l) => can(user, 'lead.view', l, db)),
  tasks: (db: DB, user: User): Task[] => db.tasks.filter((t) => can(user, 'task.view', t, db)),
  appointments: (db: DB, user: User): Appointment[] => db.appointments.filter((a) => can(user, 'appointment.view', a, db)),
  clients: (db: DB, user: User): Client[] => db.clients.filter((c) => can(user, 'client.view', c, db)),
  /** The global log: all for admins, the team's work for managers; executives see only their own records' entries. */
  activities: (db: DB, user: User): Activity[] => {
    if (scopeOf(user, 'activity.viewLog') === 'all') return db.activities
    const leadIds = new Set(visible.leads(db, user).map((l) => l.id))
    const teamIds = new Set(db.users.filter((u) => u.id === user.id || u.managerId === user.id).map((u) => u.id))
    return db.activities.filter((a) => (can(user, 'activity.viewLog') && teamIds.has(a.actorId)) || a.refs.some((r) => r.kind === 'lead' && leadIds.has(r.id)))
  },
}
