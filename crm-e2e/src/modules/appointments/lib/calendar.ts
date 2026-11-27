/**
 * Calendar maths for the appointments module (master prompt §16, DESIGN_SYSTEM §11.6). Pure: no React, no store and
 * no Date.now(); every function that needs "now" takes it. Weeks start on Monday (Indian business convention).
 */
import type { Appointment, AppointmentStatus, AppointmentType, ID, ISODate, ISODateTime } from '@/domain/types'
import { UPCOMING_APPOINTMENT_STATUSES } from '@/domain/catalogue'
import { addDaysToDay, ISO_DATE_RE, localDay, parseLocalDay } from '@/lib/dates'

export type CalView = 'day' | 'week' | 'month' | 'list'
export const CAL_VIEWS: CalView[] = ['day', 'week', 'month', 'list']

export const parseView = (v: string | null | undefined, fallback: CalView): CalView =>
  CAL_VIEWS.includes(v as CalView) ? (v as CalView) : fallback

/** A valid `?date=` value, else today. */
export const parseDay = (v: string | null | undefined, today: ISODate): ISODate =>
  v && ISO_DATE_RE.test(v) && !Number.isNaN(parseLocalDay(v).getTime()) ? v : today

/** Monday of the week that holds `day`. */
export function weekStart(day: ISODate): ISODate {
  const dow = parseLocalDay(day).getDay() // 0 = Sunday
  return addDaysToDay(day, dow === 0 ? -6 : 1 - dow)
}

export const weekDays = (day: ISODate): ISODate[] => {
  const start = weekStart(day)
  return Array.from({ length: 7 }, (_, i) => addDaysToDay(start, i))
}

/** The month as whole Monday-first weeks (5 or 6 rows), including the spill-over days of the next/previous month. */
export function monthGrid(day: ISODate): ISODate[][] {
  const first = `${day.slice(0, 7)}-01`
  let cursor = weekStart(first)
  const rows: ISODate[][] = []
  const month = day.slice(0, 7)
  do {
    rows.push(Array.from({ length: 7 }, (_, i) => addDaysToDay(cursor, i)))
    cursor = addDaysToDay(cursor, 7)
  } while (cursor.slice(0, 7) === month)
  return rows
}

/** Previous / next page of the calendar for a view. */
export function shiftAnchor(day: ISODate, view: CalView, dir: -1 | 1): ISODate {
  if (view === 'day') return addDaysToDay(day, dir)
  if (view === 'week' || view === 'list') return addDaysToDay(day, 7 * dir)
  const d = parseLocalDay(`${day.slice(0, 7)}-01`)
  d.setMonth(d.getMonth() + dir)
  return localDay(d)
}

/** The inclusive day range a view shows (the list view shows the week of the anchor plus the next one). */
export function rangeFor(day: ISODate, view: CalView): { from: ISODate; to: ISODate } {
  if (view === 'day') return { from: day, to: day }
  if (view === 'week') { const w = weekDays(day); return { from: w[0], to: w[6] } }
  if (view === 'list') { const s = weekStart(day); return { from: s, to: addDaysToDay(s, 13) } }
  const g = monthGrid(day)
  return { from: g[0][0], to: g[g.length - 1][6] }
}

export type CalFilters = { types: AppointmentType[]; statuses: AppointmentStatus[]; ownerIds: ID[] }
export const EMPTY_FILTERS: CalFilters = { types: [], statuses: [], ownerIds: [] }
export const activeFilterCount = (f: CalFilters) => f.types.length + f.statuses.length + f.ownerIds.length

export function filterAppointments(list: Appointment[], f: CalFilters): Appointment[] {
  return list.filter((a) =>
    (!f.types.length || f.types.includes(a.type)) &&
    (!f.statuses.length || f.statuses.includes(a.status)) &&
    (!f.ownerIds.length || f.ownerIds.includes(a.ownerId)))
}

export const inRange = (a: Pick<Appointment, 'start'>, r: { from: ISODate; to: ISODate }) => {
  const d = localDay(a.start)
  return d >= r.from && d <= r.to
}

const byStart = (a: Pick<Appointment, 'start'>, b: Pick<Appointment, 'start'>) => a.start.localeCompare(b.start)

export const itemsOnDay = (list: Appointment[], day: ISODate): Appointment[] =>
  list.filter((a) => localDay(a.start) === day).sort(byStart)

/** Appointments grouped by local day, in order (list view). */
export function groupByDay(list: Appointment[]): { day: ISODate; items: Appointment[] }[] {
  const map = new Map<ISODate, Appointment[]>()
  for (const a of [...list].sort(byStart)) {
    const d = localDay(a.start)
    map.set(d, [...(map.get(d) ?? []), a])
  }
  return [...map.entries()].map(([day, items]) => ({ day, items }))
}

/** Minutes after local midnight. */
export function minutesOfDay(iso: ISODateTime | Date): number {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.getHours() * 60 + d.getMinutes()
}

export const endMs = (a: Pick<Appointment, 'start' | 'durationMin'>) => new Date(a.start).getTime() + a.durationMin * 60_000

/** The hours the time grid shows: 08:00–20:00 by default, stretched to fit anything earlier or later. */
export function hourRange(items: Pick<Appointment, 'start' | 'durationMin'>[], def: [number, number] = [8, 20]): [number, number] {
  let [from, to] = def
  for (const a of items) {
    const s = minutesOfDay(a.start)
    const e = s + a.durationMin
    from = Math.min(from, Math.floor(s / 60))
    to = Math.max(to, Math.min(24, Math.ceil(e / 60)))
  }
  return [from, to]
}

export type Placed = { a: Appointment; top: number; height: number; lane: number; lanes: number }

/**
 * Positions one day's appointments in a time grid. Overlapping ones share the width side by side (lanes); `top` and
 * `height` are minutes from the grid start, with a 20-minute minimum height so short calls stay readable.
 */
export function layoutDay(items: Appointment[], startHour: number, minHeight = 20): Placed[] {
  const sorted = [...items].sort((x, y) => byStart(x, y) || y.durationMin - x.durationMin)
  const placed: Placed[] = []
  let cluster: Placed[] = []
  let clusterEnd = -Infinity
  const laneEnds: number[] = []
  const close = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1))
    for (const p of cluster) p.lanes = lanes
    cluster = []
    laneEnds.length = 0
  }
  for (const a of sorted) {
    const top = minutesOfDay(a.start) - startHour * 60
    const height = Math.max(minHeight, a.durationMin)
    const bottom = top + height
    if (top >= clusterEnd) close()
    let lane = laneEnds.findIndex((end) => end <= top)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(bottom) } else laneEnds[lane] = bottom
    const p: Placed = { a, top, height, lane, lanes: 1 }
    cluster.push(p)
    placed.push(p)
    clusterEnd = Math.max(clusterEnd, bottom)
  }
  close()
  return placed
}

/** Ids of booked appointments that overlap another booked appointment of the same executive (the clash overlay). */
export function conflictIds(list: Appointment[]): Set<ID> {
  const out = new Set<ID>()
  const live = list.filter((a) => UPCOMING_APPOINTMENT_STATUSES.includes(a.status)).sort(byStart)
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]
      const b = live[j]
      if (new Date(b.start).getTime() >= endMs(a)) break
      if (a.ownerId === b.ownerId) { out.add(a.id); out.add(b.id) }
    }
  }
  return out
}

/** Where the current-time line sits, in minutes from the grid start; null when now is outside the visible hours. */
export function nowOffset(now: Date, startHour: number, endHour: number): number | null {
  const m = minutesOfDay(now)
  return m < startHour * 60 || m > endHour * 60 ? null : m - startHour * 60
}

/** A local wall-clock time on a day, as a full ISO timestamp. */
export function atMinutes(day: ISODate, minutes: number): ISODateTime {
  const d = parseLocalDay(day)
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return d.toISOString()
}

/** The grid slot (rounded down to `step` minutes) under a vertical offset in a day column. */
export const slotAt = (offsetMin: number, startHour: number, step = 30) =>
  startHour * 60 + Math.max(0, Math.floor(offsetMin / step) * step)

/** Counts per type in a set (legend chips). */
export function countByType(list: Appointment[]): Record<AppointmentType, number> {
  const out = { siteVisit: 0, officeMeeting: 0, phoneCall: 0, videoCall: 0, documentation: 0 }
  for (const a of list) out[a.type]++
  return out
}

/** What can still happen to an appointment: upcoming, started (15 min grace), and which actions make sense now. */
export function appointmentState(a: Appointment, now: Date) {
  const upcoming = UPCOMING_APPOINTMENT_STATUSES.includes(a.status)
  const started = new Date(a.start).getTime() <= now.getTime() + 15 * 60_000
  return { upcoming, started, canComplete: upcoming && started, canNoShow: upcoming && started, canConfirm: upcoming && a.status !== 'confirmed' && !started }
}

export const APPOINTMENT_STATUSES_ORDER: AppointmentStatus[] = ['scheduled', 'confirmed', 'rescheduled', 'completed', 'noShow', 'cancelled']

/** The legend: every type with its count in the visible range (types always listed so the filter is discoverable). */
export function typeLegend(list: Appointment[]): { type: AppointmentType; count: number }[] {
  const counts = countByType(list)
  return (['siteVisit', 'officeMeeting', 'phoneCall', 'videoCall', 'documentation'] as const).map((type) => ({ type, count: counts[type] }))
}
