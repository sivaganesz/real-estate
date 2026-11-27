import { describe, expect, it } from 'vitest'
import type { Task } from '@/domain/types'
import {
  bucketTasks, completionsByDay, dayLabelKind, dueByDay, filterTasks, groupTasks, moveDue, quickDue, tabOf, taskFilterCount,
} from './task-lists'

const now = new Date(2026, 10, 27, 12, 0)
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString()
let n = 0
const task = (p: Partial<Task> = {}): Task => ({
  id: `T${++n}`, title: 'Call', type: 'call', status: 'open', priority: 'medium', ownerId: 'u1', dueAt: at(27, 15),
  createdBy: 'u1', createdAt: '', origin: 'manual', ...p,
})

describe('tabs', () => {
  it('puts each task in exactly one tab (cancelled in none)', () => {
    expect(tabOf(task({ dueAt: at(27, 10) }), now)).toBe('overdue')
    expect(tabOf(task({ dueAt: at(26, 18) }), now)).toBe('overdue')
    expect(tabOf(task({ dueAt: at(27, 18) }), now)).toBe('today')
    expect(tabOf(task({ dueAt: at(28, 10) }), now)).toBe('upcoming')
    expect(tabOf(task({ status: 'done' }), now)).toBe('done')
    expect(tabOf(task({ status: 'cancelled' }), now)).toBeNull()
  })
  it('sorts by due time then priority, and done by completion (newest first)', () => {
    const a = task({ id: 'a', dueAt: at(27, 15), priority: 'low' })
    const b = task({ id: 'b', dueAt: at(27, 15), priority: 'high' })
    const c = task({ id: 'c', dueAt: at(27, 13) })
    const d1 = task({ id: 'd1', status: 'done', completedAt: at(26, 10) })
    const d2 = task({ id: 'd2', status: 'done', completedAt: at(27, 9) })
    const r = bucketTasks([a, b, c, d1, d2], now)
    expect(r.today.map((x) => x.id)).toEqual(['c', 'b', 'a'])
    expect(r.done.map((x) => x.id)).toEqual(['d2', 'd1'])
  })
})

describe('filters and groups', () => {
  const list = [
    task({ id: 'p', title: 'Send brochure', type: 'whatsapp', leadId: 'L1', priority: 'high', ownerId: 'x' }),
    task({ id: 'q', title: 'Call back', leadId: 'L2', ownerId: 'y', dueAt: at(28, 10) }),
    task({ id: 'r', title: 'Pay office rent', type: 'other' }),
  ]
  const names: Record<string, string> = { L1: 'Priya Sharma', L2: 'Rohan Deshpande' }
  const name = (id?: string) => (id ? names[id] : undefined)
  it('searches the title and the lead name, and combines filters', () => {
    expect(filterTasks(list, { ownerIds: [], types: [], priorities: [], search: 'priya' }, name).map((t) => t.id)).toEqual(['p'])
    expect(filterTasks(list, { ownerIds: ['y'], types: [], priorities: [], search: '' }, name).map((t) => t.id)).toEqual(['q'])
    expect(filterTasks(list, { ownerIds: [], types: ['call', 'other'], priorities: ['medium'], search: '' }, name).map((t) => t.id)).toEqual(['q', 'r'])
    expect(taskFilterCount({ ownerIds: ['y'], types: ['call'], priorities: [], search: 'x' })).toBe(2)
  })
  it('groups by lead (no lead last) or by due day', () => {
    expect(groupTasks(list, 'lead').map((g) => g.key)).toEqual(['L1', 'L2', ''])
    expect(groupTasks(list, 'due').map((g) => g.key)).toEqual(['2026-11-27', '2026-11-28'])
  })
  it('labels days relative to today', () => {
    expect(dayLabelKind('2026-11-27', now)).toBe('today')
    expect(dayLabelKind('2026-11-28', now)).toBe('tomorrow')
    expect(dayLabelKind('2026-11-26', now)).toBe('yesterday')
    expect(dayLabelKind('2026-12-02', now)).toBe('date')
  })
})

describe('series and dates', () => {
  it('counts completions per day for the last week and open tasks due per day ahead', () => {
    const list = [task({ status: 'done', completedAt: at(27, 9) }), task({ status: 'done', completedAt: at(25, 9) }), task({ status: 'done', completedAt: at(10, 9) }), task({ dueAt: at(29, 10) })]
    expect(completionsByDay(list, now, 7)).toEqual([0, 0, 0, 0, 1, 0, 1])
    expect(dueByDay(list, now, 3)).toEqual([0, 0, 1])
  })
  it('moves a due date by whole days and keeps the time', () => {
    expect(moveDue(at(20, 16, 30), now, 1)).toBe(at(28, 16, 30))
  })
  it('quick-add presets land in working hours', () => {
    expect(quickDue('today', now)).toBe(at(27, 13, 30))
    expect(quickDue('today', new Date(2026, 10, 27, 12, 40))).toBe(at(27, 14, 0))
    expect(quickDue('today', new Date(2026, 10, 27, 20, 30))).toBe(at(28, 10))
    expect(quickDue('tomorrow', now)).toBe(at(28, 10))
    expect(quickDue('nextWeek', now)).toBe(at(30, 10)) // 27 Nov 2026 is a Friday → Monday 30 Nov
  })
})
