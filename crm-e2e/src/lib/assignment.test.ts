import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import type { Lead, Settings } from '@/domain/types'
import { T_NOW, makeLead, makeUser } from '@/test/factories'
import { assigneeStats, assigneeStatsFromDb, openLeadsOf, pickAssignee, previewAssignments, previewRedistribution, previewTotals, roundRobin, ruleMatches } from './assignment'

const db = buildSeed(T_NOW)
const settings = db.settings.assignment
const pune = makeLead({ id: 'NEW-1', ownerId: null, stage: 'new', source: 'acres99', requirement: { cities: ['Pune'], localities: ['Wakad'] } })
const chennai = makeLead({ id: 'NEW-2', ownerId: null, stage: 'new', source: 'magicbricks', requirement: { cities: ['Chennai'], localities: ['OMR'] } })
const pick = (lead: Lead, over: Partial<{ leads: Lead[]; settings: Settings['assignment']; managerId: string }> = {}) =>
  pickAssignee({ lead, users: db.users, leads: over.leads ?? db.leads, settings: over.settings ?? settings, managerId: over.managerId })

describe('assignment engine', () => {
  it('gives the lead to the executive with the lowest workload (seed: Sneha with 4)', () => {
    const r = pick(pune)
    expect(r.userId).toBe('u-sneha')
    expect(r.reason.key).toBe('lowestWorkload')
    expect(r.workload).toMatchObject({ 'u-arjun': 6, 'u-vikram': 5, 'u-sneha': 4 })
  })

  it('breaks a tie with round-robin after the cursor, wrapping around', () => {
    const plusOne = [...db.leads, { ...pune, ownerId: 'u-sneha', stage: 'contacted' as const }]
    const r = pick(pune, { leads: plusOne, settings: { ...settings, rrCursor: 'u-sneha' } })
    expect(r.userId).toBe('u-vikram')
    expect(r.reason.key).toBe('roundRobinTie')
    const wrapped = pick(pune, { leads: plusOne, settings: { ...settings, rrCursor: 'u-vikram' } })
    expect(wrapped.userId).toBe('u-sneha')
    expect(roundRobin(['b', 'a', 'c'], 'c')).toBe('a')
    expect(roundRobin(['b', 'a', 'c'], null)).toBe('a')
  })

  it('skips executives on leave and deactivated ones (Farhan has 2, Kavya 1, yet neither is picked)', () => {
    const r = pick(pune)
    expect(r.candidates).not.toContain('u-farhan')
    expect(r.candidates).not.toContain('u-kavya')
    const allOnLeave = db.users.map((u) => (u.role === 'executive' ? { ...u, availability: 'onLeave' as const } : u))
    expect(pickAssignee({ lead: pune, users: allOnLeave, leads: db.leads, settings }).userId).toBeNull()
  })

  it('keeps in-visit executives in the pool', () => {
    expect(pick(pune).candidates).toContain('u-vikram')
  })

  it('narrows the pool with a matching rule and names it (Chennai → Sneha), even when she is busier', () => {
    const busy = [...db.leads, ...[1, 2, 3, 4].map((i) => ({ ...pune, id: `X${i}`, ownerId: 'u-sneha', stage: 'qualified' as const }))]
    const r = pick(chennai, { leads: busy })
    expect(r.userId).toBe('u-sneha')
    expect(r.reason.key).toBe('ruleLocation')
    expect(ruleMatches(settings.rules[0], chennai)).toBe(true)
  })

  it('ignores disabled rules and rules that would empty the pool', () => {
    const cp = makeLead({ ...pune, source: 'channelPartner' })
    expect(pick(cp).reason.key).toBe('lowestWorkload') // the channel-partner rule is disabled in the seed
    const toFarhan: Settings['assignment'] = { ...settings, rules: [{ id: 'r', kind: 'location', values: ['Pune'], userIds: ['u-farhan'], enabled: true, scope: 'global' }] }
    expect(pick(pune, { settings: toFarhan }).userId).toBe('u-sneha')
  })

  it('returns nobody (reason unassigned) when the pool is empty', () => {
    const r = pickAssignee({ lead: pune, users: db.users.filter((u) => u.role !== 'executive'), leads: db.leads, settings })
    expect(r).toMatchObject({ userId: null, reason: { key: 'unassigned' } })
  })

  it('drops users at the cap unless that empties the pool', () => {
    const capped = pick(pune, { settings: { ...settings, maxActivePerExec: 5 } })
    expect(capped.userId).toBe('u-sneha')
    const allCapped = pick(pune, { settings: { ...settings, maxActivePerExec: 1 } })
    expect(allCapped.userId).toBe('u-sneha')
  })

  it('stays within a manager\'s team when a manager assigns', () => {
    const other = makeUser({ id: 'u-zed', managerId: 'u-other' })
    const r = pickAssignee({ lead: pune, users: [...db.users, other], leads: db.leads, settings, managerId: 'u-rohit' })
    expect(r.candidates).not.toContain('u-zed')
    const free = pickAssignee({ lead: pune, users: [...db.users, other], leads: db.leads, settings })
    expect(free.userId).toBe('u-zed')
  })

  it('previews a batch the same way the service assigns: Sneha, then Vikram on the tie, then Sneha again', () => {
    const fresh = ['A', 'B', 'C'].map((id) => ({ ...pune, id }))
    const out = previewAssignments({ ...db, leads: [...db.leads, ...fresh] }, ['A', 'B', 'C'])
    expect(out.map((o) => o.to)).toEqual(['u-sneha', 'u-vikram', 'u-sneha'])
    expect(out[1].reasonKey).toBe('roundRobinTie')
  })
})

describe('assignee stats and redistribution (M8)', () => {
  const fixed = { temperatureOf: (l: Lead) => (l.id.endsWith('h') ? 'hot' as const : 'cold' as const), localDayOf: (d: string | Date) => new Date(d).toISOString().slice(0, 10) }
  const now = new Date('2026-11-27T10:00:00.000Z')
  const leads = [
    makeLead({ id: 'a1h', ownerId: 'x', stage: 'contacted' }),
    makeLead({ id: 'a2', ownerId: 'x', stage: 'negotiation' }),
    makeLead({ id: 'a3', ownerId: 'x', stage: 'booked' }),
    makeLead({ id: 'a4', ownerId: 'x', stage: 'lost' }),
    makeLead({ id: 'a5', ownerId: null, firstOwnerId: 'x', stage: 'lost' }),
    makeLead({ id: 'b1', ownerId: 'y', stage: 'new' }),
  ]
  const tasks = [
    { id: 't1', ownerId: 'x', status: 'open', dueAt: '2026-11-26T10:00:00.000Z' },
    { id: 't2', ownerId: 'x', status: 'open', dueAt: '2026-11-28T10:00:00.000Z' },
    { id: 't3', ownerId: 'x', status: 'done', dueAt: '2026-11-20T10:00:00.000Z' },
  ] as never[]
  const appointments = [
    { id: 'p1', ownerId: 'x', status: 'scheduled', start: '2026-11-27T12:00:00.000Z' },
    { id: 'p2', ownerId: 'x', status: 'cancelled', start: '2026-11-27T13:00:00.000Z' },
    { id: 'p3', ownerId: 'y', status: 'confirmed', start: '2026-11-28T13:00:00.000Z' },
  ] as never[]

  it('counts open leads by temperature, follow-ups, overdue, today\'s appointments and conversion', () => {
    const s = assigneeStats({ leads, tasks, appointments }, ['x', 'y'], now, fixed)
    expect(s.x).toMatchObject({ active: 3, hot: 1, cold: 2, warm: 0, pendingFollowUps: 2, overdue: 1, todayAppointments: 1 })
    // closed: a3 booked, a4 lost, a5 lost (first owner) → 1 of 3
    expect(s.x.conversionPct).toBe(33)
    expect(s.y).toMatchObject({ active: 1, todayAppointments: 0, conversionPct: null })
  })

  it('works on the seed through the scoring wrapper (hot + warm + cold = active)', () => {
    const ids = ['u-arjun', 'u-sneha', 'u-vikram']
    const s = assigneeStatsFromDb(db, ids, T_NOW)
    for (const id of ids) expect(s[id].hot + s[id].warm + s[id].cold).toBe(s[id].active)
    expect(s['u-arjun'].active).toBe(6)
  })

  it('lists a user\'s open leads oldest first', () => {
    expect(openLeadsOf(leads, 'x').map((l) => l.id)).toEqual(['a1h', 'a2', 'a3'])
  })

  it('previews a deactivation: unassign, to one person, or auto without the leaver', () => {
    expect(previewRedistribution(db, 'u-arjun', 'unassign').every((p) => p.to === null)).toBe(true)
    expect(previewRedistribution(db, 'u-arjun', { toUserId: 'u-sneha' }).every((p) => p.to === 'u-sneha')).toBe(true)
    const auto = previewRedistribution(db, 'u-arjun', 'auto')
    expect(auto).toHaveLength(6)
    expect(auto.some((p) => p.to === 'u-arjun')).toBe(false)
    // spread between the two remaining available executives as their workloads change
    const totals = previewTotals(auto)
    expect(totals.reduce((n, x) => n + x.count, 0)).toBe(6)
    expect(new Set(totals.map((x) => x.to))).toEqual(new Set(['u-sneha', 'u-vikram']))
  })

  it('a rule does not apply when its only user is the one leaving', () => {
    const user = makeUser({ id: 'u-zed' })
    expect(previewRedistribution({ ...db, users: [...db.users, user] }, 'u-zed', 'auto')).toEqual([])
  })
})
