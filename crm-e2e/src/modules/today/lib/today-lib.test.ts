import { describe, expect, it } from 'vitest'
import type { TodayItem } from '@/services/queries/today'
import { adminBrief, daysLeftInMonth, executiveBrief, greetingKey, managerBrief, perDayNeeded } from './brief'
import { agePhrase, dayAt10, dueState, filterCounts, filterItems, itemKey, reasonParams, rescheduleSlots, splitMins } from './slots'

const item = (kind: TodayItem['kind'], id: string, name = 'Priya Sharma'): TodayItem =>
  ({ kind, rank: 1, reasonKey: 'x', params: { name }, ref: { kind: 'lead', id }, leadId: id, actions: [] })

describe('reschedule slots', () => {
  it('offers "in 2 hours" (rounded to the quarter hour) during the day, then tomorrow, in 3 days and next Monday', () => {
    const now = new Date(2026, 10, 27, 10, 7) // Friday
    const slots = rescheduleSlots(now)
    expect(slots.map((s) => s.key)).toEqual(['in2h', 'tomorrowMorning', 'tomorrowEvening', 'in3days', 'nextWeek'])
    const in2h = new Date(slots[0].at)
    expect([in2h.getHours(), in2h.getMinutes()]).toEqual([12, 15])
    const tomorrow = new Date(slots[1].at)
    expect([tomorrow.getDate(), tomorrow.getHours()]).toEqual([28, 10])
    expect(new Date(slots[2].at).getHours()).toBe(17)
    const monday = new Date(slots[4].at)
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(30)
  })

  it('drops "in 2 hours" in the evening and picks the following Monday on a Monday', () => {
    expect(rescheduleSlots(new Date(2026, 10, 27, 18, 0)).map((s) => s.key)).not.toContain('in2h')
    const monday = rescheduleSlots(new Date(2026, 10, 30, 9, 0)).find((s) => s.key === 'nextWeek')!
    expect(new Date(monday.at).getDate()).toBe(7)
  })

  it('a picked day means 10:00 local time', () => {
    const d = new Date(dayAt10('2026-12-03'))
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 11, 3, 10])
  })
})

describe('due state', () => {
  const now = new Date(2026, 10, 27, 10, 0)
  it('reads overdue, soon (≤ 2 h), later today, another day or none', () => {
    expect(dueState(new Date(2026, 10, 27, 9, 0).toISOString(), now)).toEqual({ state: 'overdue', mins: 60 })
    expect(dueState(new Date(2026, 10, 27, 11, 30).toISOString(), now)).toEqual({ state: 'soon', mins: 90 })
    expect(dueState(new Date(2026, 10, 27, 16, 0).toISOString(), now).state).toBe('today')
    expect(dueState(new Date(2026, 10, 28, 10, 0).toISOString(), now).state).toBe('later')
    expect(dueState(undefined, now).state).toBe('none')
  })
  it('splits minutes into days, hours and minutes', () => {
    expect(splitMins(1565)).toEqual({ d: 1, h: 2, m: 5 })
  })
})

describe('priority filters', () => {
  const items = [item('uncalledNew', 'a'), item('visitSoon', 'b'), item('overdueTask', 'c'), item('postVisitCall', 'd'), item('stale', 'e')]
  it('groups items and counts them', () => {
    expect(filterCounts(items)).toEqual({ all: 5, new: 1, visits: 1, followUps: 2, leads: 1 })
    expect(filterItems(items, 'followUps').map((i) => i.ref.id)).toEqual(['c', 'd'])
    expect(filterItems(items, 'all')).toHaveLength(5)
    expect(itemKey(items[0])).toBe('uncalledNew-lead-a')
  })
})

describe('brief', () => {
  it('greets by the hour', () => {
    expect(greetingKey(new Date(2026, 0, 1, 9))).toBe('morning')
    expect(greetingKey(new Date(2026, 0, 1, 13))).toBe('afternoon')
    expect(greetingKey(new Date(2026, 0, 1, 19))).toBe('evening')
  })
  it('summarises the executive day and names where to start (hot first)', () => {
    const b = executiveBrief({ visits: 2, followUps: 5, overdue: 2, newLeads: 1, first: item('uncalledNew', 'a'), firstHot: true })
    expect(b.summary).toEqual({ key: 'brief.exec.summaryOverdue', params: { visits: 2, followUps: 5, overdue: 2, newLeads: 1 } })
    expect(b.start).toEqual({ key: 'brief.exec.startHot', params: { name: 'Priya Sharma' } })
    expect(executiveBrief({ visits: 0, followUps: 0, overdue: 0, newLeads: 0, firstHot: false })).toEqual({ summary: { key: 'brief.exec.clear', params: {} } })
  })
  it('adds the manager and admin follow-ups only when they apply', () => {
    expect(managerBrief({ unassigned: 3, overdue: 4, visits: 2, stalled: 1, onLeave: 1, escalations: 0 }).map((p) => p.key))
      .toEqual(['brief.manager.summary', 'brief.manager.onLeave', 'brief.manager.stalled'])
    expect(managerBrief({ unassigned: 0, overdue: 0, visits: 1, stalled: 0, onLeave: 0, escalations: 0 }).map((p) => p.key)).toContain('brief.manager.calm')
    expect(adminBrief({ newLeads: 1, visits: 2, bookings: 3, pipeline: '₹4 Cr', alerts: 0 })[1].key).toBe('brief.admin.noAlerts')
  })
  it('works out the daily pace to a monthly target', () => {
    const now = new Date(2026, 10, 27, 10) // 4 days left in November, today included
    expect(daysLeftInMonth(now)).toBe(4)
    expect(perDayNeeded(100, 140, now)).toBe(10)
    expect(perDayNeeded(150, 140, now)).toBe(0)
    expect(perDayNeeded(0, 0, now)).toBe(0)
  })
})

describe('reason age', () => {
  it('reads elapsed minutes as minutes, hours or days', () => {
    expect(agePhrase(25)).toEqual({ key: 'today:due.mins', params: { count: 25 } })
    expect(agePhrase(1200)).toEqual({ key: 'today:due.hours', params: { h: 20, m: 0 } })
    expect(agePhrase(3000)).toEqual({ key: 'today:due.days', params: { count: 2 } })
  })
  it('adds a formatted age only when the reason carries minutes', () => {
    const fmt = (k: string, p: Record<string, number>) => k + JSON.stringify(p)
    expect(reasonParams({ params: { name: 'A', mins: 90 } }, fmt)).toEqual({ name: 'A', mins: 90, age: 'today:due.hours{"h":1,"m":30}' })
    expect(reasonParams({ params: { name: 'A' } }, fmt)).toEqual({ name: 'A' })
  })
})
