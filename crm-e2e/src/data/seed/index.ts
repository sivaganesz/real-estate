/**
 * buildSeed(now): the whole demo database, every date relative to `now` (foundation-plan §6).
 * Called on first load, on a schema-version mismatch, and by "Reset demo data".
 */
import type { DB } from '@/domain/types'
import { SCHEMA_VERSION } from '@/domain/catalogue'
import { localDay } from '@/lib/dates'
import { seedActivities } from './activities'
import { seedAppointments } from './appointments'
import { seedAssignments } from './assignments'
import { seedClients } from './clients'
import { makeClock } from './dates'
import { seedDrafts } from './drafts'
import { seedImportJobs } from './imports'
import { seedCurrentLeads, seedHistoricalLeads } from './leads'
import { seedNotifications } from './notifications'
import { seedProperties } from './properties'
import { seedSavedViews, seedSettings } from './settings'
import { seedTasks } from './tasks'
import { seedUsers } from './users'

/** The highest numeric suffix per id prefix, so services/core/ids continues after the seed. */
export function countersFor(db: Omit<DB, 'meta'>): Record<string, number> {
  const counters: Record<string, number> = {}
  const all = [db.leads, db.properties, db.appointments, db.tasks, db.clients, db.activities, db.notifications, db.assignments, db.importJobs, db.drafts, db.savedViews]
  for (const list of all) {
    for (const { id } of list) {
      const m = /^([A-Z]+)-(\d+)$/.exec(id)
      if (m) counters[m[1]] = Math.max(counters[m[1]] ?? 0, Number(m[2]))
    }
  }
  return counters
}

export function buildSeed(now: Date = new Date()): DB {
  const c = makeClock(now)
  const users = seedUsers(c)
  const properties = seedProperties(c)
  const leads = [...seedCurrentLeads(c), ...seedHistoricalLeads(c)]
  const clients = seedClients(c, leads)
  const appointments = seedAppointments(c, properties)
  const tasks = seedTasks(c)
  const assignments = seedAssignments(c, leads)
  const activities = seedActivities(c, { users, leads, appointments, tasks, assignments })
  const rest = {
    users, leads, clients, properties, appointments, tasks, activities,
    notifications: seedNotifications(c), assignments, importJobs: seedImportJobs(c), drafts: seedDrafts(c),
    savedViews: seedSavedViews(), settings: seedSettings(),
  }
  return {
    meta: { schemaVersion: SCHEMA_VERSION, anchorDate: localDay(now), seededAt: now.toISOString(), counters: countersFor(rest) },
    ...rest,
  }
}

export { INTENDED_TEMPERATURE } from './leads'
export { SWITCHABLE_EXECUTIVES, ADMIN_ID, MANAGER_ID, ARJUN, SNEHA, VIKRAM, FARHAN, KAVYA } from './users'
