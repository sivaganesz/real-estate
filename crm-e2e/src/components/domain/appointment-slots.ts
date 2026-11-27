/**
 * Scheduling help for the appointment form (master prompt §16 "conflict warning when an executive is double-booked";
 * "AI: scheduling suggestions"). Pure: no React, no store, `now` is a parameter. Owned by M4 (see
 * notes/requests-m4-appointments-tasks.md); used by the form dialog and the appointments module.
 */
import type { Appointment, AppointmentType, ID, ISODate, ISODateTime } from '@/domain/types'
import { UPCOMING_APPOINTMENT_STATUSES } from '@/domain/catalogue'
import { localDay, parseLocalDay } from '@/lib/dates'

const minutesOfDay = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

const atMinutes = (day: ISODate, minutes: number): ISODateTime => {
  const d = parseLocalDay(day)
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return d.toISOString()
}

/**
 * The first free slots for an executive on a day, in working hours, never in the past, with a 15-minute buffer around
 * their other bookings. Site visits prefer daylight hours (10:00–13:00 and 15:00–17:30) because buyers judge light and
 * traffic then; other types use 09:30–19:00.
 */
export function suggestSlots(
  appointments: Pick<Appointment, 'id' | 'ownerId' | 'start' | 'durationMin' | 'status'>[],
  input: { ownerId: ID; day: ISODate; durationMin: number; type: AppointmentType; now: Date; excludeId?: ID; count?: number },
): ISODateTime[] {
  const { ownerId, day, durationMin, type, now, excludeId, count = 3 } = input
  const buffer = 15
  const busy = appointments
    .filter((a) => a.id !== excludeId && a.ownerId === ownerId && UPCOMING_APPOINTMENT_STATUSES.includes(a.status) && localDay(a.start) === day)
    .map((a) => [minutesOfDay(a.start) - buffer, minutesOfDay(a.start) + a.durationMin + buffer] as const)
  const windows: [number, number][] = type === 'siteVisit' ? [[600, 780], [900, 1050]] : [[570, 1140]]
  const today = localDay(now)
  const earliest = day === today ? minutesOfDay(now.toISOString()) + 30 : day < today ? Infinity : -Infinity
  const out: ISODateTime[] = []
  for (const [from, to] of windows) {
    for (let m = from; m <= to; m += 30) {
      if (m < earliest) continue
      if (busy.some(([s, e]) => m < e && m + durationMin > s)) continue
      out.push(atMinutes(day, m))
      if (out.length >= count) return out
    }
  }
  return out
}

/** The next days (from `from`, at most `days` ahead) that still have a free slot, with their first slots. */
export function nextFreeSlots(
  appointments: Pick<Appointment, 'id' | 'ownerId' | 'start' | 'durationMin' | 'status'>[],
  input: { ownerId: ID; from: ISODate; durationMin: number; type: AppointmentType; now: Date; excludeId?: ID; count?: number; days?: number },
): ISODateTime[] {
  const out: ISODateTime[] = []
  const count = input.count ?? 3
  const start = parseLocalDay(input.from)
  for (let i = 0; i < (input.days ?? 7) && out.length < count; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    out.push(...suggestSlots(appointments, { ...input, day: localDay(d), count: count - out.length }))
  }
  return out
}
