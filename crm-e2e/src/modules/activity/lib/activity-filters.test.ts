import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/types'
import { addDaysToDay } from '@/lib/dates'
import {
  NO_FILTERS, activeFilterCount, activityStats, actorsIn, dailyCounts, filterActivities, kindGroupOf, readActivityQuery,
} from './activity-filters'

const users = [{ id: 'u-arjun', name: 'Arjun Mehta' }, { id: 'u-sneha', name: 'Sneha Reddy' }]
const act = (p: Partial<Activity> & Pick<Activity, 'id' | 'kind' | 'at'>): Activity => ({ actorId: 'u-arjun', refs: [{ kind: 'lead', id: 'L1' }], params: {}, via: 'manual', ...p })
const list: Activity[] = [
  act({ id: 'a1', kind: 'comm.call', at: '2026-11-27T05:00:00.000Z' }),
  act({ id: 'a2', kind: 'lead.assigned', at: '2026-11-26T05:00:00.000Z', actorId: 'system', via: 'automation' }),
  act({ id: 'a3', kind: 'appointment.created', at: '2026-11-20T05:00:00.000Z', actorId: 'u-sneha', via: 'ai', refs: [{ kind: 'appointment', id: 'A1' }, { kind: 'lead', id: 'L2' }] }),
  act({ id: 'a4', kind: 'settings.changed', at: '2026-10-01T05:00:00.000Z', actorId: 'u-admin', refs: [{ kind: 'settings', id: 'settings' }], text: 'raised SLA' }),
  act({ id: 'a5', kind: 'import.completed', at: '2026-11-27T04:00:00.000Z', actorId: 'u-sneha', via: 'import', refs: [{ kind: 'importJob', id: 'IMP-1' }] }),
]
const ctx = { today: '2026-11-27', dayOf: (iso: string) => iso.slice(0, 10), addDays: addDaysToDay, text: (a: Activity) => a.kind }

describe('kind groups and filters', () => {
  it('groups kinds', () => {
    expect(kindGroupOf('comm.call')).toBe('communication')
    expect(kindGroupOf('note')).toBe('communication')
    expect(kindGroupOf('draft.saved')).toBe('imports')
    expect(kindGroupOf('user.availability')).toBe('team')
    expect(kindGroupOf('settings.changed')).toBe('settings')
  })

  it('returns everything newest first with no filters', () => {
    expect(filterActivities(list, NO_FILTERS, ctx).map((a) => a.id)).toEqual(['a1', 'a5', 'a2', 'a3', 'a4'])
    expect(activeFilterCount(NO_FILTERS)).toBe(0)
  })

  it('filters by actor, entity, group, via, range and text together', () => {
    const f = (over: Partial<typeof NO_FILTERS>) => filterActivities(list, { ...NO_FILTERS, ...over }, ctx).map((a) => a.id)
    expect(f({ actors: ['u-sneha'] })).toEqual(['a5', 'a3'])
    expect(f({ entities: ['appointment'] })).toEqual(['a3'])
    expect(f({ groups: ['leads', 'settings'] })).toEqual(['a2', 'a4'])
    expect(f({ via: ['ai', 'automation'] })).toEqual(['a2', 'a3'])
    expect(f({ range: 'today' })).toEqual(['a1', 'a5'])
    expect(f({ range: '7d' })).toEqual(['a1', 'a5', 'a2'])
    expect(f({ range: '30d' })).toEqual(['a1', 'a5', 'a2', 'a3'])
    expect(f({ q: 'sla' })).toEqual(['a4'])
    expect(f({ actors: ['u-sneha'], range: 'today' })).toEqual(['a5'])
    expect(activeFilterCount({ ...NO_FILTERS, actors: ['x'], range: '7d', q: ' a ' })).toBe(3)
  })
})

describe('stats', () => {
  it('counts by how it was done and finds the most active person', () => {
    expect(activityStats(list)).toEqual({ total: 5, ai: 1, automation: 1, import: 1, manual: 2, people: 3, topActor: 'u-sneha' })
    expect(activityStats([])).toMatchObject({ total: 0, topActor: null })
  })
  it('counts per day, oldest first', () => {
    expect(dailyCounts(list, '2026-11-27', 3, ctx.dayOf, addDaysToDay)).toEqual([0, 1, 2])
  })
  it('lists actors by activity with system last', () => {
    expect(actorsIn(list)).toEqual(['u-sneha', 'u-admin', 'u-arjun', 'system'])
  })
})

describe('readActivityQuery (simulated)', () => {
  it('reads via, person and range', () => {
    expect(readActivityQuery('AI changes by Arjun this week', users).filters).toEqual({ via: ['ai'], range: '7d', actors: ['u-arjun'] })
  })
  it('reads kinds and automation', () => {
    const r = readActivityQuery("automatic assignments today", users)
    expect(r.filters).toMatchObject({ via: ['automation'], range: 'today', groups: ['leads'] })
    expect(readActivityQuery("Sneha's calls and visits last month", users).filters).toEqual({ actors: ['u-sneha'], range: '30d', groups: ['communication', 'appointments'] })
  })
  it('keeps unknown words as search text', () => {
    const r = readActivityQuery('settings changes about SLA', users)
    expect(r.filters.groups).toEqual(['settings'])
    expect(r.filters.q).toBeUndefined()
    expect(readActivityQuery('Whitefield', users).filters).toEqual({ q: 'whitefield' })
  })
})
