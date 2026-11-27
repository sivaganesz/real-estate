import { beforeEach, describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import type { DB, User } from '@/domain/types'
import { periodBounds, periodBuckets, subjectLeads, subjectOptions, subjectKey, parseSubject, dailySeries, pctChange, streakDays } from '@/services/queries/stats'
import { useDbStore } from '@/store/db-store'
import { clock, runAs } from '@/services/core/actor'
import { getDb } from '@/services/core/commit'
import { changeStage } from '@/services/leads'
import { bucketLabel, buildReport, drillLeads, drillProperties, reportSummary } from './report-data'
import { csvCell, csvFileName, toCsv, toCsvSections } from './csv'

const now = new Date(2026, 10, 27, 10, 30)
let db: DB
const user = (id: string): User => db.users.find((u) => u.id === id)!

beforeEach(() => {
  clock.now = () => now
  useDbStore.setState({ db: buildSeed(now) })
  db = getDb()
})

describe('report scope', () => {
  it('offers everyone + teams + people to an admin, the team + its people to a manager, only self to an executive', () => {
    expect(subjectOptions(db, user('u-admin')).map(subjectKey).slice(0, 2)).toEqual(['all', 'team:u-rohit'])
    expect(subjectOptions(db, user('u-rohit'))[0]).toEqual({ kind: 'team', managerId: 'u-rohit' })
    expect(subjectOptions(db, user('u-rohit')).map(subjectKey)).toContain('user:u-sneha')
    expect(subjectOptions(db, user('u-arjun'))).toEqual([{ kind: 'user', userId: 'u-arjun' }])
    expect(parseSubject('team:u-rohit')).toEqual({ kind: 'team', managerId: 'u-rohit' })
    expect(parseSubject('nonsense')).toBeNull()
  })

  it('a person\'s leads include the ones they first owned (attribution survives reassignment), within what the viewer may see', () => {
    const mine = subjectLeads(db, user('u-admin'), { kind: 'user', userId: 'u-arjun' })
    expect(mine.every((l) => l.ownerId === 'u-arjun' || l.firstOwnerId === 'u-arjun')).toBe(true)
    expect(subjectLeads(db, user('u-arjun'), { kind: 'all' }).every((l) => l.ownerId === 'u-arjun')).toBe(true)
  })
})

describe('periods', () => {
  it('compares with the same elapsed time in the previous period', () => {
    const b = periodBounds('month', now)
    expect(b.from.getDate()).toBe(1)
    expect(b.prevFrom.getMonth()).toBe(9)
    expect(b.prevTo.getTime() - b.prevFrom.getTime()).toBe(now.getTime() - b.from.getTime())
  })
  it('buckets by day, week or month', () => {
    expect(periodBuckets('half', now).map((b) => b.key)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(periodBuckets('month', now)).toHaveLength(27)
    expect(periodBuckets('quarter', now).every((b) => b.unit === 'week' && new Date(b.key).getDay() !== undefined)).toBe(true)
    expect(bucketLabel('2026-11', 'en')).toBe('Nov')
    expect(bucketLabel('2026-11-03', 'en')).toBe('03 Nov')
  })
  it('daily series, percent change and streaks', () => {
    expect(dailySeries([now.toISOString(), now.toISOString(), new Date(2026, 10, 26).toISOString()], now, 3)).toEqual([0, 1, 2])
    expect(pctChange(15, 10)).toBe(50)
    expect(pctChange(3, 0)).toBeNull()
    const a = (d: number) => ({ actorId: 'u', kind: 'comm.call' as const, at: new Date(2026, 10, d, 12).toISOString() })
    expect(streakDays([a(24), a(25), a(26)], 'u', now)).toBe(3)
    expect(streakDays([a(23), a(25), a(26), a(27)], 'u', new Date(2026, 10, 27, 13))).toBe(3)
  })
})

describe('buildReport', () => {
  it('builds every dataset for the admin over six months, with a monotonic funnel and drill-downs that match the numbers', () => {
    const r = buildReport(db, user('u-admin'), { kind: 'all' }, 'half', now)
    expect(r.trend).toHaveLength(6)
    expect(r.kpis.leads).toBe(r.cohort.length)
    for (let i = 1; i < r.funnel.length; i++) expect(r.funnel[i].count).toBeLessThanOrEqual(r.funnel[i - 1].count)
    expect(r.funnel[0].dropOffPct).toBeUndefined()
    const src = r.sources[0]
    expect(drillLeads(r, { kind: 'source', source: src.source }, { settings: db.settings, now })).toHaveLength(src.count)
    const stage = r.funnel[2]
    expect(drillLeads(r, { kind: 'stage', stage: stage.stage, scope: 'reached' }, { settings: db.settings, now })).toHaveLength(stage.count)
    expect(drillLeads(r, { kind: 'booked' }, { settings: db.settings, now })).toHaveLength(r.kpis.bookings)
    const st = r.inventoryStatus[0]
    expect(drillProperties(db.properties, { kind: 'propertyStatus', status: st.status })).toHaveLength(st.count)
    expect(r.execs.map((e) => e.userId)).toEqual(expect.arrayContaining(['u-arjun', 'u-sneha', 'u-vikram']))
    expect(r.heat.length).toBeGreaterThan(0)
  })

  it('moves the funnel at once when a stage changes', () => {
    const before = buildReport(getDb(), user('u-admin'), { kind: 'all' }, 'half', now)
    const lead = before.cohort.find((l) => l.stage === 'contacted')!
    const reachedQualified = before.funnel.find((f) => f.stage === 'qualified')!.count
    runAs(user('u-admin'), () => changeStage(lead.id, 'qualified'))
    const after = buildReport(getDb(), user('u-admin'), { kind: 'all' }, 'half', now)
    expect(after.funnel.find((f) => f.stage === 'qualified')!.count).toBe(reachedQualified + 1)
  })

  it('an executive\'s report covers only their own work and has a summary with drill-downs', () => {
    const r = buildReport(db, user('u-arjun'), { kind: 'user', userId: 'u-arjun' }, 'half', now)
    expect(r.leads.every((l) => l.ownerId === 'u-arjun' || l.firstOwnerId === 'u-arjun')).toBe(true)
    expect(r.execs.map((e) => e.userId)).toEqual(['u-arjun'])
    const lines = reportSummary(r, db.users)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines.length).toBeLessThanOrEqual(5)
    expect(lines[0].drill).toEqual({ kind: 'cohort' })
  })
})

describe('period conversion', () => {
  it('is booked-in-period over booked-or-lost-in-period, and null when nothing closed in the period', () => {
    for (const period of ['week', 'month', 'quarter', 'half'] as const) {
      const r = buildReport(db, user('u-admin'), { kind: 'all' }, period, now)
      const lost = r.lost.reduce((n, x) => n + x.count, 0)
      const closed = r.kpis.bookings + lost
      expect(r.kpis.conversion).toBe(closed ? Math.round((r.kpis.bookings / closed) * 100) : null)
    }
    // a person with nothing closed this week shows no rate rather than the all-time one
    const quiet = buildReport(db, user('u-admin'), { kind: 'user', userId: 'u-farhan' }, 'week', now)
    if (quiet.kpis.bookings === 0 && quiet.lost.length === 0) expect(quiet.kpis.conversion).toBeNull()
  })
})

describe('csv', () => {
  it('quotes commas, quotes and line breaks, and joins sections', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(null)).toBe('')
    expect(toCsv(['A', 'B'], [[1, 'x\ny']])).toBe('A,B\r\n1,"x\ny"')
    expect(toCsvSections([{ title: 'T', header: ['A'], rows: [[1]] }, { title: 'U', header: ['B'], rows: [] }])).toBe('T\r\nA\r\n1\r\n\r\nU\r\nB')
    expect(csvFileName('overview', 'half', 'team:u-rohit', now)).toBe('report-overview-half-team-u-rohit-2026-11-27.csv')
  })
})
