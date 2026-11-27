/**
 * Schema check for the persisted demo database. The demo has no data worth migrating field by field: when the stored
 * schemaVersion differs from SCHEMA_VERSION (or the shape is broken), the store reseeds from buildSeed(now).
 */
import type { DB } from '@/domain/types'
import { SCHEMA_VERSION } from '@/domain/catalogue'

const COLLECTIONS: (keyof DB)[] = [
  'users', 'leads', 'clients', 'properties', 'appointments', 'tasks', 'activities', 'notifications', 'assignments',
  'importJobs', 'drafts', 'savedViews',
]

/** True when a persisted value is a DB of the current schema that the app can use as is. */
export function isCurrentDb(value: unknown): value is DB {
  if (!value || typeof value !== 'object') return false
  const db = value as Partial<DB>
  if (!db.meta || db.meta.schemaVersion !== SCHEMA_VERSION || typeof db.meta.anchorDate !== 'string') return false
  if (!db.settings || typeof db.settings !== 'object') return false
  return COLLECTIONS.every((k) => Array.isArray(db[k]))
}

/** The persisted DB when it is current, else a fresh seed. */
export function migrateDb(persisted: unknown, reseed: () => DB): DB {
  return isCurrentDb(persisted) ? persisted : reseed()
}
