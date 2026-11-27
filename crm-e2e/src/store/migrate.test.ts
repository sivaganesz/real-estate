import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { SCHEMA_VERSION } from '@/domain/catalogue'
import { isCurrentDb, migrateDb } from './migrate'

const NOW = new Date(2026, 10, 27, 9, 0)

describe('migrate', () => {
  const db = buildSeed(NOW)

  it('keeps a current DB as is', () => {
    expect(isCurrentDb(db)).toBe(true)
    expect(migrateDb(db, () => buildSeed(NOW))).toBe(db)
  })

  it('reseeds on a schema mismatch or a broken shape', () => {
    const reseeded = buildSeed(NOW)
    expect(migrateDb({ ...db, meta: { ...db.meta, schemaVersion: SCHEMA_VERSION + 1 } }, () => reseeded)).toBe(reseeded)
    expect(migrateDb({ ...db, leads: undefined }, () => reseeded)).toBe(reseeded)
    expect(migrateDb(null, () => reseeded)).toBe(reseeded)
    expect(migrateDb('garbage', () => reseeded)).toBe(reseeded)
  })
})
