import { beforeEach, describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import type { ID, User } from '@/domain/types'
import { PermissionError } from '@/lib/permissions'
import { useDbStore } from '@/store/db-store'
import { clock, runAs } from './core/actor'
import { getDb } from './core/commit'
import { resetDemo } from './demo'
import { deleteLead } from './leads'

const NOW = new Date(2026, 10, 27, 10, 0)
const user = (id: ID): User => getDb().users.find((u) => u.id === id)!

beforeEach(() => {
  clock.now = () => NOW
  useDbStore.setState({ db: buildSeed(NOW) })
})

describe('services/demo.resetDemo', () => {
  it('restores the fresh seed for an admin after changes', () => {
    const fresh = buildSeed(NOW)
    const leadId = getDb().leads[0].id
    runAs(user('u-admin'), () => deleteLead(leadId))
    expect(getDb().leads.some((l) => l.id === leadId)).toBe(false)

    runAs(user('u-admin'), () => resetDemo())
    expect(getDb().leads.map((l) => l.id)).toEqual(fresh.leads.map((l) => l.id))
    expect(getDb().properties).toHaveLength(fresh.properties.length)
    expect(getDb().meta.anchorDate).toBe(fresh.meta.anchorDate)
  })

  it('is refused for managers and executives', () => {
    expect(() => runAs(user('u-rohit'), () => resetDemo())).toThrow(PermissionError)
    expect(() => runAs(user('u-arjun'), () => resetDemo())).toThrow(PermissionError)
  })
})
