import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { addDaysToDay, localDay } from '@/lib/dates'
import { DATE_PATHS, rebaseDates, shiftDb } from './rebase'

const NOW = new Date(2026, 10, 27, 9, 0)
const db = buildSeed(NOW)

describe('rebaseDates', () => {
  it('does nothing when the anchor is today', () => {
    expect(rebaseDates(db, localDay(NOW))).toBe(db)
  })

  it('moves every date forward by the whole-day gap and keeps wall-clock times', () => {
    const today = addDaysToDay(db.meta.anchorDate, 3)
    const out = rebaseDates(db, today)
    expect(out.meta.anchorDate).toBe(today)
    const a0 = db.appointments[0]
    const a1 = out.appointments.find((a) => a.id === a0.id)!
    expect(localDay(a1.start)).toBe(addDaysToDay(localDay(a0.start), 3))
    expect(new Date(a1.start).getHours()).toBe(new Date(a0.start).getHours())
    expect(new Date(a1.start).getMinutes()).toBe(new Date(a0.start).getMinutes())
  })

  it('shifts nested and day-only fields', () => {
    const out = shiftDb(db, 2)
    const lead = db.leads.find((l) => l.stageHistory.length > 2)!
    const moved = out.leads.find((l) => l.id === lead.id)!
    expect(localDay(moved.stageHistory[1].at)).toBe(addDaysToDay(localDay(lead.stageHistory[1].at), 2))
    const farhan = db.users.find((u) => u.leaveUntil)!
    expect(out.users.find((u) => u.id === farhan.id)!.leaveUntil).toBe(addDaysToDay(farhan.leaveUntil!, 2))
    const withOutcome = db.appointments.find((a) => a.outcome)!
    expect(localDay(out.appointments.find((a) => a.id === withOutcome.id)!.outcome!.at)).toBe(addDaysToDay(localDay(withOutcome.outcome!.at), 2))
    const uc = db.properties.find((p) => p.possession.date)!
    expect(out.properties.find((p) => p.id === uc.id)!.possession.date).toBe(addDaysToDay(uc.possession.date!, 2))
  })

  it('also works backwards and leaves the input untouched', () => {
    const before = JSON.stringify(db)
    const out = shiftDb(db, -4)
    expect(JSON.stringify(db)).toBe(before)
    expect(out.meta.anchorDate).toBe(addDaysToDay(db.meta.anchorDate, -4))
    expect(localDay(out.tasks[0].dueAt)).toBe(addDaysToDay(localDay(db.tasks[0].dueAt), -4))
  })

  it('covers every ISO-looking string in the seed (registry is complete)', () => {
    const shifted = shiftDb(db, 1)
    const iso = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/
    const unshifted: string[] = []
    const walk = (a: unknown, b: unknown, path: string) => {
      if (typeof a === 'string' && iso.test(a)) {
        if (a === b) unshifted.push(path)
        return
      }
      if (a && typeof a === 'object') for (const k of Object.keys(a)) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`)
    }
    for (const collection of Object.keys(DATE_PATHS)) walk(db[collection as keyof typeof DATE_PATHS], shifted[collection as keyof typeof DATE_PATHS], collection)
    expect(unshifted).toEqual([])
  })
})
