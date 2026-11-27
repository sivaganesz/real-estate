/**
 * Task buckets, filters and groups for the Tasks page (master prompt §17): Overdue / Today / Upcoming / Done tabs,
 * group by due date or by lead, and the 7-day completion series for the KPI sparkline. Pure: `now` is a parameter.
 */
import type { ID, ISODate, Priority, Task, TaskType } from '@/domain/types'
import { addDaysToDay, localDay } from '@/lib/dates'

export type TaskTab = 'overdue' | 'today' | 'upcoming' | 'done'
export const TASK_TABS: TaskTab[] = ['overdue', 'today', 'upcoming', 'done']

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

/** Which tab a task belongs to (cancelled tasks are in none). */
export function tabOf(t: Pick<Task, 'status' | 'dueAt'>, now: Date): TaskTab | null {
  if (t.status === 'done') return 'done'
  if (t.status !== 'open') return null
  if (t.dueAt < now.toISOString()) return 'overdue'
  return localDay(t.dueAt) === localDay(now) ? 'today' : 'upcoming'
}

const byDue = (a: Task, b: Task) => a.dueAt.localeCompare(b.dueAt) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
const byDone = (a: Task, b: Task) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')

export function bucketTasks(tasks: Task[], now: Date): Record<TaskTab, Task[]> {
  const out: Record<TaskTab, Task[]> = { overdue: [], today: [], upcoming: [], done: [] }
  for (const t of tasks) {
    const tab = tabOf(t, now)
    if (tab) out[tab].push(t)
  }
  out.overdue.sort(byDue)
  out.today.sort(byDue)
  out.upcoming.sort(byDue)
  out.done.sort(byDone)
  return out
}

export type TaskFilters = { ownerIds: ID[]; types: TaskType[]; priorities: Priority[]; search: string }
export const EMPTY_TASK_FILTERS: TaskFilters = { ownerIds: [], types: [], priorities: [], search: '' }
export const taskFilterCount = (f: TaskFilters) => f.ownerIds.length + f.types.length + f.priorities.length

export function filterTasks(tasks: Task[], f: TaskFilters, leadName: (id: ID | undefined) => string | undefined): Task[] {
  const q = f.search.trim().toLowerCase()
  return tasks.filter((t) =>
    (!f.ownerIds.length || f.ownerIds.includes(t.ownerId)) &&
    (!f.types.length || f.types.includes(t.type)) &&
    (!f.priorities.length || f.priorities.includes(t.priority)) &&
    (!q || t.title.toLowerCase().includes(q) || (leadName(t.leadId) ?? '').toLowerCase().includes(q) || (t.leadId ?? '').toLowerCase().includes(q)))
}

export type GroupBy = 'due' | 'lead'
/** One group: `key` is an ISODate (due), a lead id, or '' (no lead). */
export type TaskGroup = { key: string; items: Task[] }

/** Groups keep the order of the incoming (already sorted) list. Done tasks group by the day they were completed. */
export function groupTasks(tasks: Task[], by: GroupBy): TaskGroup[] {
  const map = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = by === 'lead' ? t.leadId ?? '' : localDay(t.status === 'done' && t.completedAt ? t.completedAt : t.dueAt)
    map.set(key, [...(map.get(key) ?? []), t])
  }
  const groups = [...map.entries()].map(([key, items]) => ({ key, items }))
  // tasks without a lead go last
  return by === 'lead' ? [...groups.filter((g) => g.key), ...groups.filter((g) => !g.key)] : groups
}

/** How a due-day group is labelled: relative words near today, else the date. */
export function dayLabelKind(day: ISODate, now: Date): 'today' | 'tomorrow' | 'yesterday' | 'date' {
  const today = localDay(now)
  if (day === today) return 'today'
  if (day === addDaysToDay(today, 1)) return 'tomorrow'
  if (day === addDaysToDay(today, -1)) return 'yesterday'
  return 'date'
}

/** Tasks completed on each of the last `days` days (oldest first), for the sparkline. */
export function completionsByDay(tasks: Pick<Task, 'status' | 'completedAt'>[], now: Date, days = 7): number[] {
  const today = localDay(now)
  const keys = Array.from({ length: days }, (_, i) => addDaysToDay(today, i - days + 1))
  const counts = new Map(keys.map((k) => [k, 0]))
  for (const t of tasks) {
    if (t.status !== 'done' || !t.completedAt) continue
    const d = localDay(t.completedAt)
    if (counts.has(d)) counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  return keys.map((k) => counts.get(k) ?? 0)
}

/** Open tasks due in each of the next `days` days (today first). */
export function dueByDay(tasks: Pick<Task, 'status' | 'dueAt'>[], now: Date, days = 7): number[] {
  const today = localDay(now)
  return Array.from({ length: days }, (_, i) => {
    const d = addDaysToDay(today, i)
    return tasks.filter((t) => t.status === 'open' && localDay(t.dueAt) === d).length
  })
}

/** A due time `days` from today keeping the task's wall-clock time (the reschedule chips). */
export function moveDue(dueAt: string, now: Date, days: number): string {
  const d = new Date(dueAt)
  const [y, m, dd] = addDaysToDay(localDay(now), days).split('-').map(Number)
  return new Date(y, m - 1, dd, d.getHours(), d.getMinutes()).toISOString()
}

/** Quick-add due presets: later today (at least an hour away, on the half hour), tomorrow 10:00, next Monday 10:00. */
export function quickDue(preset: 'today' | 'tomorrow' | 'nextWeek', now: Date): string {
  if (preset === 'today') {
    const t = new Date(now.getTime() + 60 * 60_000)
    t.setMinutes(t.getMinutes() <= 30 ? 30 : 60, 0, 0)
    if (localDay(t) !== localDay(now) || t.getHours() >= 21) return quickDue('tomorrow', now)
    return t.toISOString()
  }
  const day = preset === 'tomorrow' ? addDaysToDay(localDay(now), 1) : addDaysToDay(localDay(now), ((8 - now.getDay()) % 7) || 7)
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 10, 0).toISOString()
}
