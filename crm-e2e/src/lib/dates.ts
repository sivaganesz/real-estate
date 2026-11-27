/**
 * Local-calendar date helpers. An ISODate ('YYYY-MM-DD') is always the LOCAL day (IST on the demo machine).
 * Never build one with toISOString().slice(0, 10): that converts to UTC, which in India turns local midnight into
 * the previous day, so "tomorrow" would come out as today.
 */
import { addDays, differenceInCalendarDays, format, parse, startOfDay } from 'date-fns'
import type { ISODate, ISODateTime } from '@/domain/types'

/** The local calendar day of a Date or ISO timestamp, as 'YYYY-MM-DD'. */
export function localDay(d: Date | ISODateTime): ISODate {
  return format(typeof d === 'string' ? new Date(d) : d, 'yyyy-MM-dd')
}

/** Local midnight of an ISODate. */
export function parseLocalDay(day: ISODate): Date {
  return parse(day, 'yyyy-MM-dd', new Date(0))
}

/** The ISODate n days after `day`, in local time. */
export function addDaysToDay(day: ISODate, n: number): ISODate {
  return format(addDays(parseLocalDay(day), n), 'yyyy-MM-dd')
}

/** Whole local calendar days from `from` to `to` (positive when `to` is later). */
export function dayDiff(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseLocalDay(to), parseLocalDay(from))
}

/** Shifts a full timestamp by whole local days, keeping its wall-clock time. */
export function shiftDateTime(iso: ISODateTime, days: number): ISODateTime {
  return addDays(new Date(iso), days).toISOString()
}

export const isSameLocalDay = (a: Date | ISODateTime, b: Date | ISODateTime) => localDay(a) === localDay(b)

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** "5 minutes ago", "in 2 hours", "3 days ago": locale-aware (Intl), for timestamps on cards and lists. */
export function fmtRelative(iso: ISODateTime, now: Date, lang = 'en'): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diffSec)
  const rtf = new Intl.RelativeTimeFormat(lang === 'ta' ? 'ta-IN' : 'en-IN', { numeric: 'auto' })
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86_400 * 30) return rtf.format(Math.round(diffSec / 86_400), 'day')
  return rtf.format(Math.round(diffSec / (86_400 * 30)), 'month')
}

/** `iso` plus a number of minutes, as a full timestamp. */
export function addMinutesIso(iso: ISODateTime | Date, minutes: number): ISODateTime {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Date(d.getTime() + minutes * 60_000).toISOString()
}

/** A local wall-clock time `dayOffset` days from `now` ('HH:mm'). */
export function localAt(now: Date, dayOffset: number, hhmm: string): ISODateTime {
  const [h, m] = hhmm.split(':').map(Number)
  const d = startOfDay(addDays(now, dayOffset))
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** Whole minutes from `from` to `to` (positive when `to` is later). */
export const minutesBetween = (from: ISODateTime | Date, to: ISODateTime | Date) =>
  Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60_000)

/** Whole local calendar days since `iso` (0 = today). */
export const daysSince = (iso: ISODateTime | ISODate, now: Date) => dayDiff(localDay(iso.length === 10 ? parseLocalDay(iso) : new Date(iso)), localDay(now))

/**
 * When to try a call again: in 2 hours, unless that falls after 19:00 local time, then 10:00 the next morning
 * (foundation-plan §5.3 E4).
 */
export function retrySlot(now: Date): ISODateTime {
  const later = new Date(now.getTime() + 2 * 3_600_000)
  const late = later.getHours() >= 19 || localDay(later) !== localDay(now)
  return late ? localAt(now, 1, '10:00') : later.toISOString()
}

/** The start of the local day of `d`. */
export const dayStart = (d: Date) => startOfDay(d)

/** 24-hour wall-clock time of a timestamp ('16:00'), for notification params. */
export const clockTime = (iso: ISODateTime) => format(new Date(iso), 'HH:mm')
