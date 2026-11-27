import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { useDbStore } from '@/store/db-store'
import { logContact } from '../activities'
import { assignLeads } from '../assignments'
import { clock, runAs } from '../core/actor'
import { getDb } from '../core/commit'
import { undo } from '../core/undo'
import { completeTask, createTask, rescheduleTask } from '../tasks'
import { completeAppointment, rescheduleAppointment } from '../appointments'
import { previewAssignments } from '@/lib/assignment'
import { adminToday, businessInsights, executiveBriefFacts, executiveToday, managerToday, priorityItems } from './today'
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

describe('Today reacts to one-click actions (M1)', () => {
  // the actions run through the real services on a live store, so the ranking is recomputed from the new data
  const fresh = () => {
    clock.now = () => now
    useDbStore.setState({ db: buildSeed(now) })
  }
  const arjun = () => getDb().users.find((u) => u.id === 'u-arjun')!

  it('logging a call on an uncalled new lead removes it from the top, and a no-answer plans the retry', () => {
    fresh()
    const before = priorityItems(getDb(), arjun(), now)
    expect(before[0]).toMatchObject({ kind: 'uncalledNew', leadId: 'LEAD-1005' })
    runAs(arjun(), () => logContact('LEAD-1005', { channel: 'call', result: 'notReachable' }))
    const after = priorityItems(getDb(), arjun(), now)
    expect(after.some((i) => i.kind === 'uncalledNew' && i.leadId === 'LEAD-1005')).toBe(false)
    expect(getDb().tasks.some((t) => t.leadId === 'LEAD-1005' && t.autoReason === 'noAnswerRetry' && t.status === 'open')).toBe(true)
  })

  it('Done on an overdue task removes it; Undo brings it back', () => {
    fresh()
    const overdue = priorityItems(getDb(), arjun(), now).find((i) => i.kind === 'overdueTask')!
    const { undoToken } = runAs(arjun(), () => completeTask(overdue.ref.id))
    expect(priorityItems(getDb(), arjun(), now).some((i) => i.ref.id === overdue.ref.id)).toBe(false)
    undo(undoToken)
    expect(priorityItems(getDb(), arjun(), now).some((i) => i.ref.id === overdue.ref.id)).toBe(true)
  })

  it('rescheduling an overdue task to tomorrow takes it off today; planning a follow-up handles a stale lead', () => {
    fresh()
    const items = priorityItems(getDb(), arjun(), now)
    const overdue = items.find((i) => i.kind === 'overdueTask')!
    runAs(arjun(), () => rescheduleTask(overdue.ref.id, new Date(now.getTime() + 86_400_000).toISOString()))
    expect(priorityItems(getDb(), arjun(), now).some((i) => i.ref.id === overdue.ref.id)).toBe(false)
    const idle = priorityItems(getDb(), arjun(), now).find((i) => i.kind === 'hotNoContact' || i.kind === 'stale')
    if (idle) {
      runAs(arjun(), () => createTask({ title: 'Follow up', type: 'followUp', leadId: idle.leadId, ownerId: 'u-arjun', dueAt: new Date(now.getTime() + 86_400_000).toISOString() }))
      expect(priorityItems(getDb(), arjun(), now).some((i) => i.kind === idle.kind && i.leadId === idle.leadId)).toBe(false)
    }
  })

  it('auto-assigning the manager queue empties it and the executive gets the first-call item', () => {
    fresh()
    const rohit = getDb().users.find((u) => u.id === 'u-rohit')!
    const ids = managerToday(getDb(), rohit, now).unassigned.map((u) => u.lead.id)
    const { result } = runAs(rohit, () => assignLeads(ids, 'auto'))
    expect(managerToday(getDb(), rohit, now).unassigned).toHaveLength(result.filter((r) => !r.to).length)
    const to = result.find((r) => r.to)!
    const owner = getDb().users.find((u) => u.id === to.to)!
    expect(priorityItems(getDb(), owner, now).some((i) => i.leadId === to.leadId)).toBe(true)
  })

  it('executive extras: brief facts, visited-not-booked within 14 days, rank and streak', () => {
    fresh()
    const t = executiveToday(getDb(), arjun(), now)
    const f = executiveBriefFacts(t, now)
    expect(f.first).toBe(t.items[0])
    expect(f.followUps).toBe(t.overdue.length + t.dueToday.length)
    expect(t.visitedNotBooked.every((v) => v.days <= 14)).toBe(true)
    expect(t.rank?.of).toBeGreaterThanOrEqual(3)
    expect(t.streak).toBeGreaterThanOrEqual(1)
  })

  it('an appointment that is over without an outcome is a priority; recording the outcome clears it (EXE-2)', () => {
    fresh()
    const pending = getDb().appointments.find((a) => a.ownerId === 'u-arjun' && a.type === 'siteVisit' && ['scheduled', 'confirmed'].includes(a.status) && new Date(a.start).getTime() + a.durationMin * 60_000 < now.getTime())!
    expect(pending).toBeDefined()
    const item = priorityItems(getDb(), arjun(), now).find((i) => i.kind === 'visitOutcome' && i.ref.id === pending.id)
    expect(item).toMatchObject({ reasonKey: 'outcome.siteVisit', leadId: pending.leadId, actions: expect.arrayContaining(['recordOutcome']) })
    runAs(arjun(), () => completeAppointment(pending.id, { result: 'thinking', likedPropertyIds: [] }))
    expect(priorityItems(getDb(), arjun(), now).some((i) => i.kind === 'visitOutcome' && i.ref.id === pending.id)).toBe(false)
  })

  it('a visit-soon reason uses the 12-hour clock like the rest of the app (EXE-3)', () => {
    fresh()
    const a = getDb().appointments.find((x) => x.ownerId === 'u-arjun' && x.start > now.toISOString())!
    runAs(arjun(), () => rescheduleAppointment(a.id, new Date(now.getTime() + 90 * 60_000).toISOString()))
    const item = priorityItems(getDb(), arjun(), now).find((i) => i.kind === 'visitSoon' && i.ref.id === a.id)!
    expect(String(item.params.time)).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/)
  })

  it('each unassigned row suggests the right owner for that lead on its own; accepting it keeps the reason (MGR-1, MGR-2)', () => {
    fresh()
    const rohit = getDb().users.find((u) => u.id === 'u-rohit')!
    const rows = managerToday(getDb(), rohit, now).unassigned
    expect(rows.length).toBeGreaterThan(2)
    for (const row of rows) expect(row.suggestion).toEqual(previewAssignments(getDb(), [row.lead.id], 'u-rohit')[0])
    // accepting the last row first goes where its label said
    const last = rows[rows.length - 1]
    const { result } = runAs(rohit, () => assignLeads([last.lead.id], 'auto'))
    expect(result[0].to).toBe(last.suggestion!.to)
    expect(getDb().assignments.at(-1)).toMatchObject({ leadId: last.lead.id, mode: 'auto', reason: { key: last.suggestion!.reasonKey } })
  })

  it('admin: KPI series and 3–5 insights with drill-down links', () => {
    fresh()
    const t = adminToday(getDb(), getDb().users.find((u) => u.id === 'u-admin')!, now)
    expect(t.series.newLeads).toHaveLength(14)
    expect(t.series.pipeline).toHaveLength(8)
    expect(t.insights.length).toBeGreaterThanOrEqual(3)
    expect(t.insights.length).toBeLessThanOrEqual(5)
    expect(t.insights.every((i) => i.link.to)).toBe(true)
    expect(businessInsights(getDb(), now).map((i) => i.key)).toContain('unassigned')
  })
})
