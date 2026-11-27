import { describe, expect, it } from 'vitest'
import type { Appointment } from '@/domain/types'
import { localDay } from '@/lib/dates'
import {
  appointmentState, atMinutes, conflictIds, filterAppointments, groupByDay, hourRange, layoutDay, minutesOfDay, monthGrid,
  nowOffset, parseDay, parseView, rangeFor, shiftAnchor, slotAt, typeLegend, weekDays, weekStart,
} from './calendar'

const at = (day: string, hhmm: string) => {
  const [y, m, d] = day.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return new Date(y, m - 1, d, h, mi).toISOString()
}
let n = 0
const appt = (p: Partial<Appointment> & { start: string }): Appointment => ({
  id: p.id ?? `APT-${++n}`, type: p.type ?? 'siteVisit', status: p.status ?? 'scheduled', propertyIds: [], ownerId: p.ownerId ?? 'u1',
  durationMin: p.durationMin ?? 60, reminderMins: 60, createdBy: 'u1', createdAt: '', updatedAt: '', ...p,
})

describe('views and navigation', () => {
  it('parses the view and the date with safe fallbacks', () => {
    expect(parseView('month', 'week')).toBe('month')
    expect(parseView('year', 'week')).toBe('week')
    expect(parseView(null, 'day')).toBe('day')
    expect(parseDay('2026-11-27', '2026-01-01')).toBe('2026-11-27')
    expect(parseDay('27/11/2026', '2026-01-01')).toBe('2026-01-01')
  })
  it('weeks start on Monday', () => {
    expect(weekStart('2026-11-27')).toBe('2026-11-23') // a Friday
    expect(weekStart('2026-11-29')).toBe('2026-11-23') // a Sunday
    expect(weekDays('2026-11-23')).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'])
  })
  it('builds whole weeks for a month, covering every day of it', () => {
    const g = monthGrid('2026-11-15')
    expect(g[0][0]).toBe('2026-10-26')
    expect(g.every((w) => w.length === 7)).toBe(true)
    const days = g.flat()
    expect(days).toContain('2026-11-01')
    expect(days).toContain('2026-11-30')
    expect(days[days.length - 1] >= '2026-11-30').toBe(true)
  })
  it('moves by a day, a week or a month', () => {
    expect(shiftAnchor('2026-11-27', 'day', 1)).toBe('2026-11-28')
    expect(shiftAnchor('2026-11-27', 'week', -1)).toBe('2026-11-20')
    expect(shiftAnchor('2026-11-27', 'month', 1)).toBe('2026-12-01')
    expect(shiftAnchor('2026-01-31', 'month', -1)).toBe('2025-12-01')
  })
  it('gives the visible range per view', () => {
    expect(rangeFor('2026-11-27', 'day')).toEqual({ from: '2026-11-27', to: '2026-11-27' })
    expect(rangeFor('2026-11-27', 'week')).toEqual({ from: '2026-11-23', to: '2026-11-29' })
    expect(rangeFor('2026-11-27', 'list')).toEqual({ from: '2026-11-23', to: '2026-12-06' })
  })
})

describe('time grid layout', () => {
  it('puts overlapping appointments side by side and lone ones full width', () => {
    const a = appt({ start: at('2026-11-27', '12:30') })
    const b = appt({ start: at('2026-11-27', '12:45') })
    const c = appt({ start: at('2026-11-27', '15:00') })
    const placed = layoutDay([c, b, a], 8)
    const byId = Object.fromEntries(placed.map((p) => [p.a.id, p]))
    expect(byId[a.id]).toMatchObject({ lane: 0, lanes: 2, top: 270, height: 60 })
    expect(byId[b.id]).toMatchObject({ lane: 1, lanes: 2 })
    expect(byId[c.id]).toMatchObject({ lane: 0, lanes: 1, top: 420 })
  })
  it('reuses a lane once the earlier appointment has ended', () => {
    const a = appt({ start: at('2026-11-27', '10:00'), durationMin: 120 })
    const b = appt({ start: at('2026-11-27', '10:30'), durationMin: 30 })
    const c = appt({ start: at('2026-11-27', '11:00'), durationMin: 30 })
    const placed = layoutDay([a, b, c], 8)
    expect(placed.find((p) => p.a.id === c.id)?.lane).toBe(1)
    expect(placed.every((p) => p.lanes === 2)).toBe(true)
  })
  it('gives short calls a readable minimum height', () => {
    expect(layoutDay([appt({ start: at('2026-11-27', '09:00'), durationMin: 15 })], 8)[0].height).toBe(20)
  })
  it('stretches the hours to fit early or late appointments', () => {
    expect(hourRange([])).toEqual([8, 20])
    expect(hourRange([appt({ start: at('2026-11-27', '07:15') }), appt({ start: at('2026-11-27', '20:30') })])).toEqual([7, 22])
  })
  it('places the current-time line only inside the visible hours', () => {
    expect(nowOffset(new Date(2026, 10, 27, 11, 30), 8, 20)).toBe(210)
    expect(nowOffset(new Date(2026, 10, 27, 6, 0), 8, 20)).toBeNull()
  })
  it('turns a click offset into a 30-minute slot', () => {
    expect(slotAt(95, 8)).toBe(8 * 60 + 90)
    expect(minutesOfDay(atMinutes('2026-11-27', 630))).toBe(630)
    expect(localDay(atMinutes('2026-11-27', 630))).toBe('2026-11-27')
  })
})

describe('clashes and filters', () => {
  it('flags overlapping bookings of the same executive only', () => {
    const a = appt({ id: 'A', ownerId: 'vikram', start: at('2026-11-27', '12:30') })
    const b = appt({ id: 'B', ownerId: 'vikram', start: at('2026-11-27', '12:45') })
    const c = appt({ id: 'C', ownerId: 'sneha', start: at('2026-11-27', '12:30') })
    const d = appt({ id: 'D', ownerId: 'vikram', start: at('2026-11-27', '12:40'), status: 'cancelled' })
    expect([...conflictIds([a, b, c, d])].sort()).toEqual(['A', 'B'])
  })
  it('filters by type, status and executive together', () => {
    const list = [
      appt({ id: 'A', type: 'siteVisit', ownerId: 'x', start: at('2026-11-27', '10:00') }),
      appt({ id: 'B', type: 'phoneCall', ownerId: 'x', start: at('2026-11-27', '11:00') }),
      appt({ id: 'C', type: 'siteVisit', ownerId: 'y', start: at('2026-11-27', '12:00'), status: 'completed' }),
    ]
    expect(filterAppointments(list, { types: ['siteVisit'], statuses: [], ownerIds: [] }).map((a) => a.id)).toEqual(['A', 'C'])
    expect(filterAppointments(list, { types: ['siteVisit'], statuses: ['completed'], ownerIds: [] }).map((a) => a.id)).toEqual(['C'])
    expect(filterAppointments(list, { types: [], statuses: [], ownerIds: ['x'] }).map((a) => a.id)).toEqual(['A', 'B'])
    expect(typeLegend(list).find((l) => l.type === 'siteVisit')?.count).toBe(2)
  })
  it('groups by day in time order', () => {
    const g = groupByDay([appt({ start: at('2026-11-28', '09:00') }), appt({ start: at('2026-11-27', '15:00') }), appt({ start: at('2026-11-27', '10:00') })])
    expect(g.map((x) => x.day)).toEqual(['2026-11-27', '2026-11-28'])
    expect(g[0].items[0].start < g[0].items[1].start).toBe(true)
  })
})

describe('appointmentState', () => {
  const now = new Date(2026, 10, 27, 12, 0)
  it('offers confirm before and outcome / no-show after the start', () => {
    expect(appointmentState(appt({ start: at('2026-11-27', '16:00') }), now)).toMatchObject({ upcoming: true, canConfirm: true, canComplete: false })
    expect(appointmentState(appt({ start: at('2026-11-27', '11:00') }), now)).toMatchObject({ canComplete: true, canNoShow: true, canConfirm: false })
    expect(appointmentState(appt({ start: at('2026-11-27', '11:00'), status: 'completed' }), now)).toMatchObject({ upcoming: false, canComplete: false })
    expect(appointmentState(appt({ start: at('2026-11-27', '16:00'), status: 'confirmed' }), now).canConfirm).toBe(false)
  })
})
