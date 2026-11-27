/**
 * Regressions from the QA round on the assistants: a request naming another executive's lead on a lead page, questions
 * read as updates, explicit "create a lead" / "create task" / "add note" requests, match questions phrased with "suit" /
 * "fits budget", the 99acres portal read as an area, Hinglish reschedules and loan words, the manager's import refusal,
 * the workload answer, the admin's "deactivate and redistribute" and the offer message's empty date clause.
 */
import { describe, expect, it } from 'vitest'
import '@/i18n'
import { buildSeed } from '@/data/seed'
import type { AIContext, CommandPlan } from '../types'
import { parseCommandSim } from './commands'
import { extractLeadFields } from './extract-lead'
import { generateMessageSim } from './messages'
import { areaIn, loanIn, nameIn } from './parse'

const now = new Date(2026, 10, 27, 10, 0, 0)
const db = buildSeed(now)
const ctx = (id: string, selection?: AIContext['selection']): AIContext => {
  const actor = db.users.find((u) => u.id === id)!
  return { actor, role: actor.role, route: '/today', now, db: () => db, selection }
}
const lead = (name: string) => db.leads.find((l) => l.name === name)!
const payload = <T>(plan: CommandPlan, i = 0) => plan.proposals[i]?.payload as T
const before = JSON.stringify(db)

describe("a lead named on another lead's page is never replaced by the open lead (XAI-8)", () => {
  it.each([
    ['u-arjun', 'Ananya Iyer', 'move Harish Reddy to negotiation'],
    ['u-vikram', 'Rohan Deshpande', 'update Harish Reddy budget to 2 Cr'],
    ['u-vikram', 'Rohan Deshpande', 'schedule a site visit for Karthik tomorrow 4pm'],
    ['u-vikram', 'Rohan Deshpande', 'create task: call Karthik tomorrow'],
  ])('%s on %s: "%s"', (user, open, text) => {
    expect(lead('Harish Reddy').ownerId).not.toBe(user)
    const plan = parseCommandSim(text, ctx(user, { kind: 'lead', id: lead(open).id }))
    expect(plan.proposals).toEqual([])
    expect(plan.reply.text).not.toContain(open)
  })

  it('a bare command on the lead page still means the open lead', () => {
    const plan = parseCommandSim('move to negotiation', ctx('u-arjun', { kind: 'lead', id: lead('Ananya Iyer').id }))
    expect(payload(plan)).toMatchObject({ leadId: lead('Ananya Iyer').id, to: 'negotiation' })
  })

  it('"summarise Divya Menon" as Arjun says she is not on his list instead of summarising his day (EXE-9)', () => {
    const plan = parseCommandSim('summarise Divya Menon', ctx('u-arjun'))
    expect(plan.reply.text).toMatch(/Divya Menon/)
    expect(plan.reply.links ?? []).toEqual([])
    expect(parseCommandSim('summarise Ramesh Babu', ctx('u-arjun')).reply.text).toMatch(/Ramesh Babu/)
    expect(parseCommandSim('summarise my day', ctx('u-arjun')).reply.text).not.toMatch(/can't find/)
  })
})

describe('intents that were misread', () => {
  it('"show me leads I have not called in a week" on a lead page is a question, not a call log (XAI-9)', () => {
    const plan = parseCommandSim('show me leads I have not called in a week', ctx('u-arjun', { kind: 'lead', id: lead('Ananya Iyer').id }))
    expect(plan.intent).toBe('followUpLeads')
    expect(plan.proposals).toEqual([])
  })

  it.each(['u-arjun', 'u-rohit', 'u-admin'])('"create a lead for Sanjay Mehra …" is a new lead for %s (XAI-1)', (user) => {
    const plan = parseCommandSim('create a lead for Sanjay Mehra 9988776655 looking for villa in Sarjapur under 2 Cr', ctx(user))
    expect(plan.proposals[0]?.kind).toBe('createLead')
    const input = payload<{ input: { name: string; phone: string; requirement: { propertyTypes: string[]; budgetMax: number } } }>(plan).input
    expect(input).toMatchObject({ name: 'Sanjay Mehra', phone: '+919988776655' })
    expect(input.requirement.propertyTypes).toEqual(['villa'])
    expect(input.requirement.budgetMax).toBe(20_000_000)
  })

  it('"new enquiry: Meena Pillai, +91 98450 33221, …" reads the name (XAI-3)', () => {
    const plan = parseCommandSim('new enquiry: Meena Pillai, +91 98450 33221, wants 3 BHK in HSR Layout, 1.5 Cr', ctx('u-arjun'))
    expect(payload<{ input: { name: string } }>(plan).input.name).toBe('Meena Pillai')
    expect(nameIn('Add lead from this WhatsApp message')).toBeUndefined()
  })

  it('"which properties suit Ananya Iyer?" and "what fits Ananya budget?" list her matches (XAI-4, XAI-5)', () => {
    for (const q of ['which properties suit Ananya Iyer?', 'what fits Ananya budget?']) {
      const plan = parseCommandSim(q, ctx('u-arjun'))
      expect(plan.intent).toBe('findMatches')
      expect(plan.reply.links?.[0]).toEqual({ kind: 'lead', id: lead('Ananya Iyer').id })
      expect(plan.results?.kind).toBe('property')
      for (const id of plan.results?.ids ?? []) expect(db.properties.find((p) => p.id === id)!.price).toBeLessThanOrEqual(lead('Ananya Iyer').requirement.budgetMax!)
    }
  })

  it('"create task: send brochure to Deepak tomorrow" is a task, not a share (XAI-6)', () => {
    const plan = parseCommandSim('create task: send brochure to Deepak tomorrow', ctx('u-arjun'))
    expect(plan.proposals[0]?.kind).toBe('createTask')
    const input = payload<{ input: { title: string; leadId: string; dueAt: string } }>(plan).input
    expect(input.title).toBe('Send brochure to Deepak')
    expect(input.leadId).toBe(lead('Deepak Verma').id)
    expect(new Date(input.dueAt).getDate()).toBe(28)
  })

  it('"add note for Priya: wants east facing" adds a note and leaves her facing alone (XAI-7)', () => {
    const plan = parseCommandSim('add note for Priya: wants east facing', ctx('u-arjun'))
    expect(plan.proposals.map((p) => p.kind)).toEqual(['logActivity'])
    expect(payload(plan)).toMatchObject({ leadId: lead('Priya Sharma').id, channel: 'note', text: 'wants east facing' })
  })
})

describe('more phrasings from the QA command matrix', () => {
  it.each([
    ['which leads are hot', 'priorityLeads', 'u-arjun'],
    ['what should I focus on', 'priorityLeads', 'u-arjun'],
    ['which deals are close to closing?', 'conversions', 'u-arjun'],
    ['which executive has the best conversion?', 'teamPerformance', 'u-rohit'],
  ])('%s → %s', (q, intent, user) => {
    expect(parseCommandSim(q, ctx(user)).intent).toBe(intent)
  })

  it('"Priya ko kal shaam 5 baje call karna hai" is a call follow-up for Priya tomorrow 5 PM', () => {
    const plan = parseCommandSim('Priya ko kal shaam 5 baje call karna hai', ctx('u-arjun'))
    expect(plan.proposals[0]?.kind).toBe('createTask')
    const input = payload<{ input: { leadId: string; dueAt: string; type: string } }>(plan).input
    expect(input).toMatchObject({ leadId: lead('Priya Sharma').id, type: 'call' })
    expect(new Date(input.dueAt).getHours()).toBe(17)
  })

  it('an admin without targets never sees "49 of 0"', () => {
    const plan = parseCommandSim('summarize my sales performance', ctx('u-admin'))
    for (const s of plan.stats ?? []) expect(s.display ?? '').not.toMatch(/of 0(?!\d)/)
  })
})

describe('the 99acres portal is a source, not an area (XAI-2)', () => {
  it('"… budget 90 L from 99acres" has no area requirement', () => {
    const plan = parseCommandSim('add lead Kiran Rao 9876501234 2BHK Whitefield budget 90 L from 99acres', ctx('u-rohit'))
    const input = payload<{ input: { source: string; requirement: { areaMinSqft?: number; areaMaxSqft?: number } } }>(plan).input
    expect(input.source).toBe('acres99')
    expect(input.requirement.areaMinSqft).toBeUndefined()
    expect(input.requirement.areaMaxSqft).toBeUndefined()
  })

  it.each(['saw it on 99acres', 'via 99 acres', '99acres.com enquiry', '99 acres lead'])('%s → no area', (text) => {
    expect(areaIn(text)).toBeUndefined()
  })

  it('a real acreage still reads', () => {
    expect(areaIn('farm land 2.5 acres near Hoskote')?.sqftMin).toBe(108_900)
  })
})

describe('Hinglish', () => {
  it('"Rohan ka follow-up kal shaam 6 baje karo" reschedules his follow-up to tomorrow 6 PM (EXE-10)', () => {
    const plan = parseCommandSim('Rohan ka follow-up kal shaam 6 baje karo', ctx('u-vikram'))
    expect(plan.proposals[0]?.kind).toBe('rescheduleTask')
    const due = new Date(payload<{ dueAt: string }>(plan).dueAt)
    expect([due.getDate(), due.getHours()]).toEqual([28, 18])
  })

  it('"loan lagega" means a home loan is needed (EXE-5)', () => {
    expect(loanIn('loan lagega')).toBe('needed')
    expect(loanIn('loan chahiye')).toBe('needed')
    expect(loanIn('loan nahi chahiye, full cash')).toBe('notNeeded')
    const x = extractLeadFields('Sir mera naam Anjali Desai hai, number 98861 23456. 2bhk chahiye Hebbal ya Yelahanka mein, budget 75 lakhs tak, loan lagega, 6 mahine mein lena hai', { now })
    expect(x.fields.qualification?.loan).toBe('needed')
  })
})

describe('team and admin answers', () => {
  it("a manager asking to import a property list hears it is the admin's, and that leads can be imported (MGR-7)", () => {
    const plan = parseCommandSim('import this property price list', ctx('u-rohit'))
    expect(plan.refusal?.action).toBe('import.properties')
    expect(plan.reply.bullets?.join(' ')).toMatch(/leads/i)
  })

  it('"Who is overloaded today?" never names the lightest executive and pluralises counts (MGR-8)', () => {
    const plan = parseCommandSim('Who is overloaded today?', ctx('u-rohit'))
    const lightest = plan.reply.bullets?.find((b) => b.startsWith('Lightest'))
    const lightName = lightest ? /Lightest load: (.+?) \(/.exec(lightest)?.[1] : undefined
    if (lightName) expect(plan.reply.text).not.toContain(lightName)
    expect(plan.reply.bullets?.join(' ')).not.toMatch(/\b1 visits\b|\b1 open leads\b/)
  })

  it('"Deactivate Kavya and redistribute her leads" proposes the hand-over (ADM-2)', () => {
    const plan = parseCommandSim('Deactivate Kavya and redistribute her leads', ctx('u-admin'))
    expect(plan.proposals[0]?.kind).toBe('assignLeads')
    expect(plan.reply.bullets?.[0]).toMatch(/already deactivated/)
    const v = parseCommandSim('deactivate Vikram and give his leads to Sneha', ctx('u-admin'))
    expect(payload<{ to: string }>(v).to).toBe('u-sneha')
  })
})

describe('messages', () => {
  it('the offer message leaves out the validity clause when there is no date (ADM-4)', () => {
    const admin = db.users.find((u) => u.id === 'u-admin')!
    const msg = generateMessageSim({ leadId: lead('Karthik Subramanian').id, purpose: 'offer', channel: 'whatsapp', tone: 'english' }, db, admin)
    expect(msg.text).not.toMatch(/until\s*\./)
    expect(msg.text).toMatch(/Shall we block the unit\?/)
    const hi = generateMessageSim({ leadId: lead('Karthik Subramanian').id, purpose: 'offer', channel: 'whatsapp', tone: 'hinglish' }, db, admin)
    expect(hi.text).not.toMatch(/Offer\s+tak/)
  })
})

it('nothing here wrote data', () => {
  expect(JSON.stringify(db)).toBe(before)
})
