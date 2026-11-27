import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import type { Lead, Settings } from '@/domain/types'
import { T_NOW, makeLead, makeUser } from '@/test/factories'
import { pickAssignee, previewAssignments, roundRobin, ruleMatches } from './assignment'

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
