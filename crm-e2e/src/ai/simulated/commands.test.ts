/**
 * The global assistant on varied phrasings (master prompt §12.1 / §12.5, plan §8.3 M7): English, Hinglish, arrows,
 * possessives, typos, the selected record, and every role chip from ROLE_RESEARCH §5. Nothing here writes data.
 */
import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import type { AIContext, CommandPlan } from '../types'
import { parseCommandSim, readUpdateSim } from './commands'
import { fromHinglish } from './hinglish'
import { detectIntent } from './intents'

const now = new Date(2026, 10, 27, 10, 0, 0)
const db = buildSeed(now)
const ctx = (id = 'u-arjun', selection?: AIContext['selection']): AIContext => {
  const actor = db.users.find((u) => u.id === id)!
  return { actor, role: actor.role, route: '/today', now, db: () => db, selection }
}
const lead = (name: string) => db.leads.find((l) => l.name === name)!
const payload = <T>(plan: CommandPlan, i = 0) => plan.proposals[i]?.payload as T
const before = JSON.stringify(db)

describe('Hinglish is rewritten into English the readers understand', () => {
  it.each([
    ['3bhk chahiye Whitefield mein 1.2 cr tak', /3bhk wants Whitefield in up to 1\.2 cr/i],
    ['Priya ka site visit kal 11 baje fix karo', /schedule Priya's site visit tomorrow at 11/i],
    ['Sanjay ki lead Sneha ko de do', /assign Sanjay's lead to Sneha/i],
    ['aaj ke tasks dikhao', /show today tasks/i],
    ['Priya ko negotiation mein daalo', /move Priya to negotiation/i],
    ['kal shaam 5 baje Karthik ko call karna yaad dilana', /remind me to tomorrow at 5 pm Karthik call/i],
  ])('%s', (input, out) => {
    expect(fromHinglish(input)).toMatch(out)
  })

  it('leaves plain English alone', () => {
    expect(fromHinglish('Schedule a site visit with Priya tomorrow 11am')).toBe('Schedule a site visit with Priya tomorrow 11am')
  })
})

describe('intent detection over varied phrasings', () => {
  it.each([
    ["Show today's pending tasks", 'todayTasks'],
    ['what should I do today?', 'todayTasks'],
    ['Who should I call next?', 'nextCall'],
    ['Add lead from this WhatsApp message', 'createLead'],
    ['Draft visit confirmation for my 11 AM', 'draftMessage'],
    ['Match properties for Rahul under 1.2 Cr', 'findMatches'],
    ["Reschedule Priya's follow-up to tomorrow 5 PM", 'reschedule'],
    ['Summarise this lead before my call', 'summarizeLead'],
    ["What's left for my target this month?", 'targetLeft'],
    ['Assign new leads', 'bulkAssign'],
    ['Who is overloaded today?', 'workload'],
    ['Show stalled deals over 10 days', 'stalledDeals'],
    ["Reassign Arjun's leads, he's on leave", 'reassignFrom'],
    ['Summarise team performance this week', 'teamPerformance'],
    ['Which source converts best to visits?', 'sourceConversion'],
    ['Leads with no contact in 5 days', 'followUpLeads'],
    ['Import this CSV from 99acres', 'importHelp'],
    ['How many leads did we lose to budget mismatch this month?', 'lostReasons'],
    ['Deactivate Kavya and redistribute her leads', 'manageUsers'],
    ['Which project has most unsold inventory?', 'unsoldInventory'],
    ['Business summary for today', 'businessSummary'],
    ['Find duplicate leads', 'duplicates'],
    ["give Sanjay's lead to Sneha", 'assignLead'],
    ['reassign Sanjay Gupta → Sneha', 'assignLead'],
    ['move Priya to negotiation', 'moveStage'],
    ['mark Deepak as lost, bought elsewhere', 'moveStage'],
    ['Called Priya, no answer, try again tomorrow', 'updateLead'],
    ["Karthik's budget is now 2 Cr", 'updateLead'],
    ['potential conversions this month', 'conversions'],
    ['summarize my sales performance', 'performance'],
    ['3 bhk flats in Whitefield under 1.5 cr', 'propertySearch'],
    ['book a site visit for Neha on 3rd Dec at 11', 'createAppointment'],
    ['schedule a follow-up call with Ananya on Friday', 'createTask'],
    ['share Prestige with Priya on WhatsApp', 'shareProperties'],
  ])('%s → %s', (input, intent) => {
    expect(detectIntent(fromHinglish(input))).toBe(intent)
  })
})

describe('write requests become proposals (nothing is saved)', () => {
  it('the Rahul Verma enquiry becomes a createLead proposal with every detail', () => {
    const plan = parseCommandSim("Hi, I'm Rahul Verma, 9845012345. Looking for a 3BHK in Whitefield or Sarjapur, budget around 1.2 Cr, ready to move, need it in 2–3 months. Wife will also decide.", ctx())
    expect(plan.intent).toBe('createLead')
    const input = payload<{ input: { name: string; phone: string; requirement: { configurations: string[]; localities: string[]; budgetMax: number; possession: string }; qualification: { timeline: string; decisionMakers: string[] } } }>(plan).input
    expect(input).toMatchObject({ name: 'Rahul Verma', phone: '+919845012345' })
    expect(input.requirement.configurations).toEqual(['3BHK'])
    expect(input.requirement.localities).toEqual(expect.arrayContaining(['Whitefield']))
    expect(input.requirement.budgetMax).toBe(12_000_000)
    expect(input.requirement.possession).toBe('ready')
    expect(input.qualification.timeline).toBe('m1to3')
    expect(input.qualification.decisionMakers).toContain('spouse')
  })

  it('a site visit in Hinglish for a named lead', () => {
    const plan = parseCommandSim('Priya ka site visit kal 11 baje fix karo', ctx())
    expect(plan.readAs).toMatch(/schedule/i)
    expect(plan.intent).toBe('createAppointment')
    const input = payload<{ input: { leadId: string; start: string; type: string } }>(plan).input
    expect(input.leadId).toBe(lead('Priya Sharma').id)
    expect(input.type).toBe('siteVisit')
    expect(new Date(input.start).getDate()).toBe(28)
    expect(new Date(input.start).getHours()).toBe(11)
  })

  it('"on 3rd Dec at 11" and "next Saturday morning"', () => {
    const a = parseCommandSim(`book a site visit for ${lead('Neha Kulkarni').name} on 3rd Dec at 11`, ctx('u-admin'))
    const start = new Date(payload<{ input: { start: string } }>(a).input.start)
    expect([start.getMonth(), start.getDate(), start.getHours()]).toEqual([11, 3, 11])
    const b = parseCommandSim('schedule a meeting with Neha next Saturday morning', ctx('u-admin'))
    const s2 = new Date(payload<{ input: { start: string } }>(b).input.start)
    expect([s2.getDay(), s2.getHours()]).toEqual([6, 10])
  })

  it.each([
    ["give Sanjay's lead to Vikram"],
    ['reassign Sanjay Gupta → Vikram'],
    ['Sanjay ki lead Vikram ko de do'],
    ['assign sanjay gupta -> vikram singh'],
    ['hand over Sanjay to Vikram'],
  ])('%s → assign Sanjay Gupta to Vikram (manager)', (input) => {
    const plan = parseCommandSim(input, ctx('u-rohit'))
    expect(plan.proposals[0]?.kind).toBe('assignLead')
    expect(payload(plan)).toMatchObject({ leadId: lead('Sanjay Gupta').id, to: 'u-vikram' })
  })

  it('assigning a lead to its current owner says so instead of proposing', () => {
    const plan = parseCommandSim("give Sanjay's lead to Sneha", ctx('u-rohit'))
    expect(lead('Sanjay Gupta').ownerId).toBe('u-sneha')
    expect(plan.proposals).toEqual([])
    expect(plan.reply.links?.[0]).toEqual({ kind: 'lead', id: lead('Sanjay Gupta').id })
  })

  it('an executive is refused assignment with the reason and offered a reassignment request', () => {
    const plan = parseCommandSim("give Sanjay's lead to Sneha", ctx('u-arjun'))
    expect(plan.refusal?.action).toBe('lead.assign')
    expect(plan.proposals).toEqual([])
  })

  it('move Priya to negotiation', () => {
    const plan = parseCommandSim('move Priya to negotiation', ctx('u-rohit'))
    expect(plan.proposals[0]?.kind).toBe('moveStage')
    expect(payload(plan)).toMatchObject({ leadId: lead('Priya Sharma').id, to: 'negotiation' })
  })

  it('"Called Priya, no answer, try again tomorrow 5pm" logs the call and plans the retry', () => {
    const plan = parseCommandSim('Called Priya, no answer, try again tomorrow 5pm', ctx('u-rohit'))
    const kinds = plan.proposals.map((p) => p.kind)
    expect(kinds).toEqual(expect.arrayContaining(['logActivity', 'createTask']))
    expect(plan.proposals.find((p) => p.kind === 'logActivity')?.payload).toMatchObject({ channel: 'call', result: 'notReachable' })
  })

  it('a budget change on the open lead needs no name', () => {
    const l = db.leads.find((x) => x.ownerId === 'u-arjun' && x.stage !== 'lost')!
    const plan = parseCommandSim('budget is now 2.5 Cr and she wants 4BHK', ctx('u-arjun', { kind: 'lead', id: l.id }))
    const p = plan.proposals.find((x) => x.kind === 'updateLead')
    expect(p?.payload).toMatchObject({ leadId: l.id, patch: { requirement: { budgetMax: 25_000_000, configurations: ['4BHK+'] } } })
  })

  it('reschedules a follow-up with a new day and time', () => {
    const withTask = db.leads.find((l) => db.tasks.some((t) => t.leadId === l.id && t.status === 'open') && l.ownerId === 'u-arjun')!
    const plan = parseCommandSim(`Reschedule ${withTask.name}'s follow-up to tomorrow 5 PM`, ctx('u-arjun'))
    expect(plan.proposals[0]?.kind).toBe('rescheduleTask')
    const due = new Date(payload<{ dueAt: string }>(plan).dueAt)
    expect([due.getDate(), due.getHours()]).toEqual([28, 17])
  })

  it('"Assign new leads" previews auto-assignment for every unassigned lead', () => {
    const plan = parseCommandSim('Assign new leads', ctx('u-rohit'))
    expect(plan.proposals[0]?.kind).toBe('assignLeads')
    expect(payload<{ leadIds: string[]; to: string }>(plan).to).toBe('auto')
    expect(payload<{ leadIds: string[] }>(plan).leadIds.length).toBeGreaterThan(0)
  })

  it('"Reassign Farhan\'s leads, he\'s on leave" moves his open leads (auto)', () => {
    const plan = parseCommandSim("Reassign Farhan's leads, he's on leave", ctx('u-rohit'))
    expect(plan.intent).toBe('reassignFrom')
    if (plan.proposals[0]) expect(payload<{ to: string }>(plan).to).toBe('auto')
  })

  it('draft a visit confirmation for the lead', () => {
    const plan = parseCommandSim('Draft visit confirmation for Priya', ctx('u-arjun'))
    expect(plan.draft?.purpose).toBe('visitConfirm')
    expect(plan.draft?.text.length).toBeGreaterThan(10)
  })

  it('the property editing assistant reads a price cut and a status', () => {
    const p = db.properties.find((x) => x.status === 'available' && x.listing === 'live' && x.createdBy === 'u-admin') ?? db.properties[0]
    const plan = readUpdateSim({ kind: 'property', id: p.id }, 'Price reduced to 95 lakhs, now on hold', ctx('u-admin'))
    expect(plan.proposals[0]?.kind).toBe('updateProperty')
    expect(payload<{ patch: { price: number; status: string } }>(plan).patch).toMatchObject({ price: 9_500_000, status: 'onHold' })
  })
})

describe('questions answer from the data with links', () => {
  it.each([
    ["Show today's pending tasks", 'task'],
    ['My highest-priority leads', 'lead'],
    ['Leads with no contact in 5 days', 'lead'],
    ["Summarise today's appointments", 'appointment'],
  ])('%s', (q, kind) => {
    const plan = parseCommandSim(q, ctx())
    expect(plan.results?.kind).toBe(kind)
    expect(plan.mode).toBe('simulated')
  })

  it('who to call next names a real lead', () => {
    const plan = parseCommandSim('Who should I call next?', ctx())
    expect(plan.reply.links?.[0]?.kind ?? plan.results?.kind).toBeTruthy()
  })

  it('properties within a client\'s budget never exceed it', () => {
    const l = lead('Priya Sharma')
    const plan = parseCommandSim(`properties within ${l.name}'s budget`, ctx('u-admin'))
    for (const id of plan.results?.ids ?? []) expect(db.properties.find((p) => p.id === id)!.price).toBeLessThanOrEqual(l.requirement.budgetMax!)
  })

  it('target, workload, sources, lost reasons, inventory and business answers carry stats', () => {
    expect(parseCommandSim("What's left for my target this month?", ctx()).stats?.length).toBe(3)
    expect(parseCommandSim('Who is overloaded today?', ctx('u-rohit')).stats?.length).toBeGreaterThan(0)
    expect(parseCommandSim('Which source converts best to visits?', ctx('u-rohit')).stats?.length).toBeGreaterThan(0)
    expect(parseCommandSim('Which project has most unsold inventory?', ctx('u-admin')).stats?.length).toBeGreaterThan(0)
    expect(parseCommandSim('Business summary for today', ctx('u-admin')).stats?.length).toBe(4)
    expect(parseCommandSim('How many leads did we lose to budget mismatch this month?', ctx('u-admin')).intent).toBe('lostReasons')
  })

  it('an executive asking for team numbers is refused and offered their own', () => {
    const plan = parseCommandSim('Summarise team performance this week', ctx('u-arjun'))
    expect(plan.refusal?.action).toBe('team.view')
    expect(plan.followUps?.length).toBe(1)
  })

  it('a manager cannot deactivate users; the admin is sent to Team', () => {
    expect(parseCommandSim('Deactivate Kavya and redistribute her leads', ctx('u-rohit')).refusal?.action).toBe('user.manage')
    expect(parseCommandSim('Deactivate Kavya and redistribute her leads', ctx('u-admin')).reply.nav?.[0]?.to).toBe('/team')
  })

  it('an unknown request still answers, and a bare lead name summarises it', () => {
    expect(parseCommandSim('blah blah', ctx()).intent).toBe('unknown')
    expect(parseCommandSim('Priya Sharma', ctx('u-admin')).reply.links?.[0]).toEqual({ kind: 'lead', id: lead('Priya Sharma').id })
  })

  it('reading never changed the database', () => {
    expect(JSON.stringify(db)).toBe(before)
  })
})
