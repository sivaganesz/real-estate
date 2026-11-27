/**
 * Relative-date helpers for the seed (foundation-plan §6.1). Every seeded date is built from `now`,
 * so "today", "overdue" and "upcoming" are always true on the day the demo runs. Local time (IST on the demo machine).
 */
import { addDays, addHours, addMinutes, format, setHours, setMinutes, startOfDay, subDays, subHours, subMinutes } from 'date-fns'
import type { ISODate, ISODateTime } from '@/domain/types'

export type Unit = 'minutes' | 'hours' | 'days'

export const makeClock = (now: Date) => ({
  now: now.toISOString() as ISODateTime,
  /** Local day start + offset days + 'HH:mm'. */
  at: (dayOffset: number, hhmm = '10:00'): ISODateTime => {
    const [h, m] = hhmm.split(':').map(Number)
    return setMinutes(setHours(addDays(startOfDay(now), dayOffset), h), m).toISOString()
  },
  ago: (amount: number, unit: Unit): ISODateTime =>
    (unit === 'minutes' ? subMinutes(now, amount) : unit === 'hours' ? subHours(now, amount) : subDays(now, amount)).toISOString(),
  in: (amount: number, unit: Unit): ISODateTime =>
    (unit === 'minutes' ? addMinutes(now, amount) : unit === 'hours' ? addHours(now, amount) : addDays(now, amount)).toISOString(),
  /**
   * A moment earlier today: `fraction` (0–1) of the way from local midnight to now. Always today and never in the
   * future, whatever time the demo starts (use it for things that "already happened today").
   */
  earlier: (fraction: number): ISODateTime => {
    const start = startOfDay(now).getTime()
    return new Date(start + (now.getTime() - start) * Math.min(1, Math.max(0, fraction))).toISOString()
  },
  /** Local YYYY-MM-DD, offset days from today. */
  day: (dayOffset: number): ISODate => format(addDays(now, dayOffset), 'yyyy-MM-dd'),
})

export type Clock = ReturnType<typeof makeClock>
