import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { adminToday, executiveToday, managerToday } from './today'
import { activityCounts, funnel, monthlyTrend, summaryKpis } from './stats'

const now = new Date(2026, 10, 27, 10, 30)
const db = buildSeed(now)
const user = (id: string) => db.users.find((u) => u.id === id)!

describe('Today (first version)', () => {
  it('ranks an executive\'s day: uncalled new lead first, then overdue work; with visits, hot leads and targets', () => {
    const t = executiveToday(db, user('u-arjun'), now)
    expect(t.items[0]).toMatchObject({ kind: 'uncalledNew', leadId: 'LEAD-1005' })
    const ranks = t.items.map((i) => i.rank)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    expect(t.items.some((i) => i.kind === 'overdueTask')).toBe(true)
    expect(t.appointments.length).toBe(2)
    expect(t.hot.map((l) => l.id)).toEqual(expect.arrayContaining(['LEAD-1001', 'LEAD-1002']))
    expect(t.targets.calls.target).toBe(600)
    expect(t.today.calls).toBeGreaterThanOrEqual(7)
  })

  it('shows the manager the unassigned queue with a suggested executive, the team board and stalled deals', () => {
    const t = managerToday(db, user('u-rohit'), now)
    expect(t.unassigned.length).toBe(5)
    expect(t.unassigned.every((u) => u.suggestion)).toBe(true)
    expect(t.unassigned.map((u) => u.suggestion!.reasonKey)).toEqual(expect.arrayContaining(['ruleLocation']))
    expect(t.team.map((r) => r.user.id)).toEqual(expect.arrayContaining(['u-arjun', 'u-sneha', 'u-vikram', 'u-farhan']))
    expect(t.stalled.some((l) => l.id === 'LEAD-1008')).toBe(true)
    expect(t.attention.onLeave.map((r) => r.user.id)).toContain('u-farhan')
  })

  it('gives the admin KPIs and alerts (duplicates, deactivated owner, unassigned age)', () => {
    const t = adminToday(db, user('u-admin'), now)
    expect(t.kpis.openLeads).toBe(23)
    expect(t.alerts.duplicates.map((d) => d.lead.id)).toContain('LEAD-1023')
    expect(t.alerts.deactivatedOwners.map((d) => d.user.id)).toContain('u-kavya')
    expect(t.alerts.unassigned).toBe(5)
  })

  it('stats: funnel never grows down the stages, trends cover six months', () => {
    const f = funnel(db.leads)
    for (let i = 1; i < f.length; i++) expect(f[i].reached).toBeLessThanOrEqual(f[i - 1].reached)
    const trend = monthlyTrend(db.leads, now)
    expect(trend).toHaveLength(6)
    expect(trend.reduce((n, m) => n + m.bookings, 0)).toBeGreaterThan(0)
    expect(activityCounts(db, ['u-sneha'], 'today', now).calls).toBeGreaterThanOrEqual(5)
    expect(summaryKpis(db, user('u-arjun'), now).openLeads).toBe(6)
  })
})
