/**
 * Small pure helpers for the Today screen: reschedule slots, how a due time reads, and the filter groups of the
 * priority list. The Reschedule slots carry over the wireframe-rebuild chips (Tomorrow · In 3 days · Next week, plus
 * "Pick a date"), widened with "In 2 hours" and a morning / evening choice for tomorrow (ported from
 * wireframe-rebuild/src/features/leads/reschedule-button.tsx).
 */
import type { TodayItem, TodayKind } from '@/services/queries/today'
import { localAt } from '@/lib/dates'

export type SlotKey = 'in2h' | 'tomorrowMorning' | 'tomorrowEvening' | 'in3days' | 'nextWeek'
export type Slot = { key: SlotKey; at: string }

/** The quick reschedule choices from `now`. "In 2 hours" is offered only while it still lands before 19:00 today. */
export function rescheduleSlots(now: Date): Slot[] {
  const out: Slot[] = []
  const later = new Date(now.getTime() + 2 * 3_600_000)
  if (later.getHours() < 19 && later.getDate() === now.getDate()) {
    later.setSeconds(0, 0)
    // round up to the next quarter hour, so the time reads cleanly (11:15, not 11:07)
    later.setMinutes(Math.ceil(later.getMinutes() / 15) * 15)
    out.push({ key: 'in2h', at: later.toISOString() })
  }
  out.push({ key: 'tomorrowMorning', at: localAt(now, 1, '10:00') })
  out.push({ key: 'tomorrowEvening', at: localAt(now, 1, '17:00') })
  out.push({ key: 'in3days', at: localAt(now, 3, '10:00') })
  const toMonday = ((8 - now.getDay()) % 7) || 7
  out.push({ key: 'nextWeek', at: localAt(now, toMonday, '10:00') })
  return out
}

/** A picked calendar day (YYYY-MM-DD) at 10:00 local time. */
export function dayAt10(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 10, 0).toISOString()
}

export type DueState = { state: 'overdue' | 'soon' | 'today' | 'later' | 'none'; mins: number }

/** How a due time reads next to an item: overdue by N, due in N minutes (within 2 h), later today, or another day. */
export function dueState(dueAt: string | undefined, now: Date): DueState {
  if (!dueAt) return { state: 'none', mins: 0 }
  const mins = Math.round((new Date(dueAt).getTime() - now.getTime()) / 60_000)
  if (mins < 0) return { state: 'overdue', mins: -mins }
  if (mins <= 120) return { state: 'soon', mins }
  const d = new Date(dueAt)
  return { state: d.toDateString() === now.toDateString() ? 'today' : 'later', mins }
}

/** "2 h 05 min" style split of a minute count, for the overdue and countdown chips. */
export function splitMins(mins: number): { d: number; h: number; m: number } {
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  return { d, h, m: mins % 60 }
}

/** An elapsed time as one i18n phrase: "25 min", "2 h 5 min" or "3 days" (keys under `today:due`). */
export function agePhrase(mins: number): { key: 'today:due.mins' | 'today:due.hours' | 'today:due.days'; params: Record<string, number> } {
  const { d, h, m } = splitMins(Math.max(0, Math.round(mins)))
  if (d) return { key: 'today:due.days', params: { count: d } }
  if (h) return { key: 'today:due.hours', params: { h, m } }
  return { key: 'today:due.mins', params: { count: m } }
}

/** The reason params with a readable `age` added when the reason carries elapsed minutes ("1200 min" → "20 h 0 min"). */
export function reasonParams(item: Pick<TodayItem, 'params'>, format: (key: string, params: Record<string, number>) => string): Record<string, unknown> {
  const mins = item.params.mins
  if (typeof mins !== 'number') return item.params
  const a = agePhrase(mins)
  return { ...item.params, age: format(a.key, a.params) }
}

export type PriorityFilter = 'all' | 'new' | 'visits' | 'followUps' | 'leads'
export const PRIORITY_FILTERS: PriorityFilter[] = ['all', 'new', 'visits', 'followUps', 'leads']
const GROUP: Record<TodayKind, Exclude<PriorityFilter, 'all'>> = {
  uncalledNew: 'new', visitSoon: 'visits', overdueTask: 'followUps', postVisitCall: 'followUps', dueToday: 'followUps', hotNoContact: 'leads', stale: 'leads',
}
export const groupOf = (kind: TodayKind) => GROUP[kind]

export function filterItems(items: TodayItem[], f: PriorityFilter): TodayItem[] {
  return f === 'all' ? items : items.filter((i) => GROUP[i.kind] === f)
}

export function filterCounts(items: TodayItem[]): Record<PriorityFilter, number> {
  const out: Record<PriorityFilter, number> = { all: items.length, new: 0, visits: 0, followUps: 0, leads: 0 }
  for (const i of items) out[GROUP[i.kind]]++
  return out
}

/** A stable key for a priority item (React key, and the scroll target of the hero's "Start here" chips). */
export const itemKey = (it: Pick<TodayItem, 'kind' | 'ref'>) => `${it.kind}-${it.ref.kind}-${it.ref.id}`
