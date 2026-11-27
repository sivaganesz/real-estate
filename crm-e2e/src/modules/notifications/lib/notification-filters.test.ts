import { describe, expect, it } from 'vitest'
import type { Notification, NotificationKind } from '@/domain/types'
import {
  DEFAULT_NOTIFICATION_FILTERS, activeNotificationFilters, categoryOf, digest, filterNotifications, groupByDay, notificationCounts, notificationsFor,
} from './notification-filters'
import { addDaysToDay } from '@/lib/dates'

const KINDS: NotificationKind[] = ['assignment', 'reassignment', 'appointmentCreated', 'appointmentReminder', 'taskOverdue', 'slaBreach', 'escalation',
  'importFinished', 'stageChanged', 'booking', 'propertyUnavailable', 'leaveReassign', 'stalledDeal', 'deactivatedOwner', 'duplicateFound', 'system']
const n = (p: Partial<Notification> & Pick<Notification, 'id' | 'kind' | 'at'>): Notification => ({ userId: 'u-arjun', params: {}, priority: 'normal', ...p })
const all: Notification[] = [
  n({ id: 'n1', kind: 'assignment', at: '2026-11-27T05:00:00.000Z' }),
  n({ id: 'n2', kind: 'slaBreach', at: '2026-11-27T06:00:00.000Z', priority: 'high' }),
  n({ id: 'n3', kind: 'appointmentReminder', at: '2026-11-25T06:00:00.000Z', readAt: '2026-11-25T07:00:00.000Z' }),
  n({ id: 'n4', kind: 'booking', at: '2026-11-01T06:00:00.000Z', readAt: '2026-11-01T07:00:00.000Z', priority: 'high' }),
  n({ id: 'n5', kind: 'importFinished', at: '2026-11-27T07:00:00.000Z', userId: 'u-sneha' }),
]
const ctx = { today: '2026-11-27', dayOf: (iso: string) => iso.slice(0, 10), addDays: addDaysToDay }

describe('notification filters', () => {
  it('maps every kind to a category', () => {
    for (const k of KINDS) expect(categoryOf(k)).toBeTruthy()
    expect(categoryOf('leaveReassign')).toBe('assignments')
    expect(categoryOf('taskOverdue')).toBe('schedule')
  })

  it('keeps only the user\'s own, newest first', () => {
    expect(notificationsFor(all, 'u-arjun').map((x) => x.id)).toEqual(['n2', 'n1', 'n3', 'n4'])
  })

  it('filters by read state, category, priority and time', () => {
    const mine = notificationsFor(all, 'u-arjun')
    const f = (over: Partial<typeof DEFAULT_NOTIFICATION_FILTERS>) => filterNotifications(mine, { ...DEFAULT_NOTIFICATION_FILTERS, ...over }, ctx).map((x) => x.id)
    expect(f({})).toEqual(['n2', 'n1', 'n3', 'n4'])
    expect(f({ read: 'unread' })).toEqual(['n2', 'n1'])
    expect(f({ read: 'read' })).toEqual(['n3', 'n4'])
    expect(f({ categories: ['alerts', 'deals'] })).toEqual(['n2', 'n4'])
    expect(f({ highOnly: true })).toEqual(['n2', 'n4'])
    expect(f({ when: 'today' })).toEqual(['n2', 'n1'])
    expect(f({ when: '7d' })).toEqual(['n2', 'n1', 'n3'])
    expect(activeNotificationFilters({ ...DEFAULT_NOTIFICATION_FILTERS, categories: ['alerts'], highOnly: true, when: '7d' })).toBe(3)
  })

  it('counts unread, unread high-priority and per category', () => {
    const c = notificationCounts(notificationsFor(all, 'u-arjun'))
    expect(c).toMatchObject({ all: 4, unread: 2, high: 1 })
    expect(c.byCategory).toEqual({ assignments: 1, schedule: 1, alerts: 1, deals: 1, system: 0 })
  })

  it('groups by day in order', () => {
    expect(groupByDay(notificationsFor(all, 'u-arjun'), ctx.dayOf).map((g) => [g.day, g.items.length])).toEqual([['2026-11-27', 2], ['2026-11-25', 1], ['2026-11-01', 1]])
  })
})

describe('digest (simulated catch-up)', () => {
  it('counts unread by urgency and points at the most urgent one', () => {
    const d = digest(notificationsFor(all, 'u-arjun'))
    expect(d).toMatchObject({ total: 2, high: 1 })
    expect(d.parts).toEqual([{ kind: 'slaBreach', count: 1 }, { kind: 'assignment', count: 1 }])
    expect(d.first?.id).toBe('n2')
    expect(digest([]).first).toBeNull()
  })
})
