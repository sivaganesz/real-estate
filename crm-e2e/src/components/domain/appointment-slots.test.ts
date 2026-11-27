import { describe, expect, it } from 'vitest'
import type { Appointment } from '@/domain/types'
import { nextFreeSlots, suggestSlots } from './appointment-slots'

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString()
const busy = (start: string, durationMin = 60, ownerId = 'v', status: Appointment['status'] = 'scheduled') =>
  ({ id: start + ownerId, ownerId, start, durationMin, status })
const hhmm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

describe('suggestSlots', () => {
  const now = new Date(2026, 10, 27, 8, 0)
  it('suggests daylight slots for a site visit around existing bookings (15-minute buffer)', () => {
    const slots = suggestSlots([busy(at(28, 10, 0)), busy(at(28, 13, 0))], { ownerId: 'v', day: '2026-11-28', durationMin: 60, type: 'siteVisit', now, count: 4 })
    expect(slots.map(hhmm)).toEqual(['11:30', '15:00', '15:30', '16:00'])
  })
  it('ignores other executives and cancelled bookings', () => {
    const slots = suggestSlots([busy(at(28, 10), 60, 'other'), busy(at(28, 10, 30), 60, 'v', 'cancelled')], { ownerId: 'v', day: '2026-11-28', durationMin: 60, type: 'siteVisit', now })
    expect(slots.map(hhmm)[0]).toBe('10:00')
  })
  it('never suggests the past: today starts at least 30 minutes from now', () => {
    const slots = suggestSlots([], { ownerId: 'v', day: '2026-11-27', durationMin: 30, type: 'phoneCall', now: new Date(2026, 10, 27, 14, 10) })
    expect(slots.map(hhmm)).toEqual(['15:00', '15:30', '16:00'])
    expect(suggestSlots([], { ownerId: 'v', day: '2026-11-26', durationMin: 30, type: 'phoneCall', now })).toEqual([])
  })
  it('skips the booking being edited', () => {
    const own = { ...busy(at(28, 10)), id: 'self' }
    expect(suggestSlots([own], { ownerId: 'v', day: '2026-11-28', durationMin: 60, type: 'siteVisit', now, excludeId: 'self' }).map(hhmm)[0]).toBe('10:00')
  })
  it('looks ahead day by day when a day is full', () => {
    const late = new Date(2026, 10, 27, 18, 0)
    const slots = nextFreeSlots([], { ownerId: 'v', from: '2026-11-27', durationMin: 60, type: 'siteVisit', now: late, count: 2 })
    expect(slots.map((s) => new Date(s).getDate())).toEqual([28, 28])
  })
})
