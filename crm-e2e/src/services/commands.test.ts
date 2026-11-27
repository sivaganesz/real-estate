/**
 * Assistant proposals really change the data after confirmation (plan §8.3 M7): with `via: 'ai'`, links to the changed
 * records, a 10 s undo for every applied change, and a refusal when the role may not do it.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import '@/i18n'
import { buildSeed } from '@/data/seed'
import type { AIContext } from '@/ai/types'
import { parseCommandSim } from '@/ai/simulated/commands'
import { reviseProposal } from '@/ai/revise'
import type { ID } from '@/domain/types'
import { PermissionError } from '@/lib/permissions'
import { useDbStore } from '@/store/db-store'
import { clock, runAs } from './core/actor'
import { getDb } from './core/commit'
import { undo } from './core/undo'
import { executeProposal } from './commands'

const NOW = new Date(2026, 10, 27, 10, 0)
const user = (id: ID) => getDb().users.find((u) => u.id === id)!
const ctx = (id: ID, selection?: AIContext['selection']): AIContext => ({ actor: user(id), role: user(id).role, route: '/today', now: NOW, db: getDb, selection })
const plan = (id: ID, text: string, selection?: AIContext['selection']) => parseCommandSim(text, ctx(id, selection))
const run = (id: ID, text: string, i = 0) => runAs(user(id), () => executeProposal(plan(id, text).proposals[i]))
const leadByName = (name: string) => getDb().leads.find((l) => l.name === name)!

beforeEach(() => {
  clock.now = () => NOW
  useDbStore.setState({ db: buildSeed(NOW) })
})

describe('executeProposal', () => {
  it('creates the Rahul Verma lead with via ai, links to it, and undo removes it', () => {
    const before = getDb().leads.length
    const out = run('u-arjun', "Hi, I'm Rahul Verma, 9845012345. Looking for a 3BHK in Whitefield or Sarjapur, budget around 1.2 Cr, ready to move, need it in 2–3 months. Wife will also decide.")
    expect(getDb().leads.length).toBe(before + 1)
    const lead = getDb().leads.find((l) => l.id === out.links[0].id)!
    expect(lead).toMatchObject({ name: 'Rahul Verma', createdVia: 'ai' })
    expect(lead.fieldMeta?.['requirement.budgetMax']?.origin).toBe('ai')
    expect(getDb().activities.some((a) => a.via === 'ai' && a.refs.some((r) => r.id === lead.id))).toBe(true)
    expect(undo(out.undoToken)).toBe(true)
    expect(getDb().leads.length).toBe(before)
  })

  it('books a site visit for the named lead and links to the appointment', () => {
    const before = getDb().appointments.length
    const out = run('u-arjun', 'Priya ka site visit kal 11 baje fix karo')
    expect(getDb().appointments.length).toBe(before + 1)
    expect(out.links[0].kind).toBe('appointment')
    const a = getDb().appointments.find((x) => x.id === out.links[0].id)!
    expect(a.leadId).toBe(leadByName('Priya Sharma').id)
    expect(new Date(a.start).getHours()).toBe(11)
    expect(out.undoToken).toBeTruthy()
  })

  it('a manager reassigns with an arrow; undo puts the owner back', () => {
    const sanjay = leadByName('Sanjay Gupta')
    const out = run('u-rohit', 'reassign Sanjay Gupta → Vikram')
    expect(getDb().leads.find((l) => l.id === sanjay.id)!.ownerId).toBe('u-vikram')
    expect(undo(out.undoToken)).toBe(true)
    expect(getDb().leads.find((l) => l.id === sanjay.id)!.ownerId).toBe(sanjay.ownerId)
  })

  it('an edited proposal runs with the edits (assign to someone else)', () => {
    const sanjay = leadByName('Sanjay Gupta')
    const p = plan('u-rohit', 'reassign Sanjay Gupta → Vikram').proposals[0]
    const edited = reviseProposal(p, { to: 'u-arjun' }, getDb())
    runAs(user('u-rohit'), () => executeProposal(edited))
    expect(getDb().leads.find((l) => l.id === sanjay.id)!.ownerId).toBe('u-arjun')
  })

  it('an executive cannot run an assignment, even if one reaches the service', () => {
    const p = plan('u-rohit', 'reassign Sanjay Gupta → Vikram').proposals[0]
    expect(() => runAs(user('u-arjun'), () => executeProposal(p))).toThrow(PermissionError)
  })

  it('"Assign new leads" assigns every unassigned lead in one undoable step', () => {
    const open = () => getDb().leads.filter((l) => l.ownerId === null && !['converted', 'lost'].includes(l.stage)).length
    const before = open()
    expect(before).toBeGreaterThan(0)
    const out = run('u-rohit', 'Assign new leads')
    expect(open()).toBeLessThan(before)
    expect(getDb().assignments.some((a) => a.mode === 'auto')).toBe(true)
    expect(undo(out.undoToken)).toBe(true)
    expect(open()).toBe(before)
  })

  it('logs a call with no answer and plans the retry from one sentence', () => {
    const priya = leadByName('Priya Sharma')
    const p = plan('u-rohit', 'Called Priya, no answer, try again tomorrow 5pm')
    const tasksBefore = getDb().tasks.filter((t) => t.leadId === priya.id).length
    for (const x of p.proposals) runAs(user('u-rohit'), () => executeProposal(x))
    expect(getDb().activities.some((a) => a.kind === 'comm.call' && a.via === 'ai' && a.refs.some((r) => r.id === priya.id))).toBe(true)
    expect(getDb().tasks.filter((t) => t.leadId === priya.id).length).toBeGreaterThan(tasksBefore)
  })

  it('moves a stage and updates a budget, both undoable', () => {
    const priya = leadByName('Priya Sharma')
    const moved = run('u-rohit', 'move Priya to negotiation')
    expect(getDb().leads.find((l) => l.id === priya.id)!.stage).toBe('negotiation')
    expect(moved.undoToken).toBeTruthy()
    const p = plan('u-admin', "Priya's budget is now 2.5 Cr").proposals.find((x) => x.kind === 'updateLead')!
    runAs(user('u-admin'), () => executeProposal(p))
    expect(getDb().leads.find((l) => l.id === priya.id)!.requirement.budgetMax).toBe(25_000_000)
  })

  it('an executive can request a reassignment of their own lead (the manager is notified)', () => {
    const mine = getDb().leads.find((l) => l.ownerId === 'u-arjun' && !['converted', 'lost'].includes(l.stage))!
    const before = getDb().notifications.filter((n) => n.userId === 'u-rohit').length
    run('u-arjun', `Request reassignment of ${mine.name}`)
    expect(getDb().notifications.filter((n) => n.userId === 'u-rohit').length).toBe(before + 1)
  })
})

describe('M6 R1: stage moves that need a dialog never run silently', () => {
  it('Lost without a reason and Booked are refused by executeProposal', async () => {
    const { propose } = await import('@/ai/proposals')
    const priya = leadByName('Priya Sharma')
    const lost = propose({ kind: 'moveStage', permission: 'lead.moveStage', summary: [], payload: { leadId: priya.id, to: 'lost' } })
    expect(() => runAs(user('u-admin'), () => executeProposal(lost))).toThrow(/lostReason/)
    const booked = propose({ kind: 'moveStage', permission: 'lead.moveStage', summary: [], payload: { leadId: priya.id, to: 'booked' } })
    expect(() => runAs(user('u-admin'), () => executeProposal(booked))).toThrow()
    expect(getDb().leads.find((l) => l.id === priya.id)!.stage).toBe(priya.stage)
  })
})
