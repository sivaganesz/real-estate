import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { selectProvider } from '@/ai'
import type { AIContext } from '../types'
import { mapColumnsSim } from './columns'
import { parseCommandSim } from './commands'
import { extractAppointmentFields } from './extract-appointment'
import { extractPropertyFields } from './extract-property'
import { createSimulatedProvider } from './provider'

const now = new Date(2026, 10, 27, 10, 0, 0)
const db = buildSeed(now)
const user = (id: string) => db.users.find((u) => u.id === id)!
const ctx = (id = 'u-arjun', selection?: AIContext['selection']): AIContext => {
  const actor = user(id)
  return { actor, role: actor.role, route: '/today', now, db: () => db, selection }
}

describe('extractProperty (simulated)', () => {
  it('reads an owner listing with Indian formats', () => {
    const x = extractPropertyFields('Selling my 3 BHK flat in Gachibowli, Hyderabad. 1,450 sq.ft carpet, 5th floor of 12, east facing, 2 covered parking, gym and pool. Asking 1.25 Cr negotiable. Ready to move. RERA P02400001234. Call Suresh 9849012345', { now })
    expect(x.fields.type).toBe('apartment')
    expect(x.fields.configuration).toBe('3BHK')
    expect(x.fields.location).toMatchObject({ city: 'Hyderabad', locality: 'Gachibowli' })
    expect(x.fields.price).toBe(12_500_000)
    expect(x.fields.priceNegotiable).toBe(true)
    expect(x.fields.area?.carpet).toBe(1450)
    expect(x.fields.floor).toBe(5)
    expect(x.fields.totalFloors).toBe(12)
    expect(x.fields.facing).toBe('E')
    expect(x.fields.parking).toEqual({ covered: 2, open: 0 })
    expect(x.fields.amenities).toEqual(expect.arrayContaining(['gym', 'swimmingPool']))
    expect(x.fields.possession?.status).toBe('ready')
    expect(x.fields.rera?.number).toBe('P02400001234')
    expect(x.fields.owner?.phone).toBe('+919849012345')
    expect(x.fields.title).toBe('3 BHK Apartment in Gachibowli')
    expect(x.missing).toEqual([])
  })

  it('reads a plot in acres / cents and asks for the price when missing', () => {
    const x = extractPropertyFields('Corner plot 30x40 in Tellapur, 40 ft road, east facing', { now })
    expect(x.fields.type).toBe('plot')
    expect(x.fields.area?.plot).toBe(1200)
    expect(x.fields.corner).toBe(true)
    expect(x.fields.roadWidthFt).toBe(40)
    expect(x.missing).toEqual(['price'])
  })
})

describe('extractAppointment (simulated)', () => {
  it('finds the lead by name, the type, day and time', () => {
    const lead = db.leads.find((l) => l.ownerId === 'u-arjun')!
    const x = extractAppointmentFields(`Site visit with ${lead.name} tomorrow 11am`, { now, leads: db.leads, properties: db.properties })
    expect(x.fields.leadId).toBe(lead.id)
    expect(x.fields.type).toBe('siteVisit')
    expect(x.date).toBe('2026-11-28')
    expect(x.time).toBe('11:00')
    expect(new Date(x.fields.start!).getHours()).toBe(11)
  })
})

describe('parseCommand (simulated)', () => {
  it('turns a pasted enquiry into a createLead proposal without saving anything', () => {
    const before = db.leads.length
    const plan = parseCommandSim('Add lead Rahul Verma 9845012345, 3BHK Whitefield, budget 1.2 Cr', ctx())
    expect(plan.intent).toBe('createLead')
    expect(plan.proposals).toHaveLength(1)
    expect(plan.proposals[0].kind).toBe('createLead')
    expect(plan.proposals[0].permission).toBe('lead.create')
    // the phone's last digit is never read as a BHK count
    expect((plan.proposals[0].payload as { input: { requirement: { configurations: string[] } } }).input.requirement.configurations).toEqual(['3BHK'])
    expect(db.leads.length).toBe(before)
  })

  it("lists today's tasks for the executive", () => {
    const plan = parseCommandSim("Show today's pending tasks", ctx())
    expect(plan.intent).toBe('todayTasks')
    expect(plan.results?.kind).toBe('task')
  })

  it('refuses assignment for an executive, proposes it for the manager', () => {
    const lead = db.leads.find((l) => l.stage === 'new')!
    expect(parseCommandSim(`Assign ${lead.name} to Sneha Reddy`, ctx('u-arjun')).refusal?.action).toBe('lead.assign')
    const plan = parseCommandSim(`Assign ${lead.name} to Sneha Reddy`, ctx('u-rohit'))
    expect(plan.proposals[0]?.kind).toBe('assignLead')
    expect(plan.proposals[0]?.payload).toMatchObject({ leadId: lead.id, to: 'u-sneha' })
  })

  it('uses the selected record for "schedule a visit tomorrow 11am"', () => {
    const lead = db.leads.find((l) => l.ownerId === 'u-arjun' && l.stage !== 'lost')!
    const plan = parseCommandSim('Schedule a site visit tomorrow at 11am', ctx('u-arjun', { kind: 'lead', id: lead.id }))
    expect(plan.intent).toBe('createAppointment')
    expect(plan.proposals[0]?.kind).toBe('createAppointment')
  })
})

describe('provider selection and column mapping', () => {
  it('is simulated unless live mode and an endpoint are both set', () => {
    expect(selectProvider({}).mode).toBe('simulated')
    expect(selectProvider({ VITE_AI_PROVIDER: 'live' }).mode).toBe('simulated')
    expect(selectProvider({ VITE_AI_PROVIDER: 'live', VITE_AI_ENDPOINT: 'https://proxy.example/ai' }).mode).toBe('live')
  })

  it('every simulated result says mode simulated', async () => {
    const ai = createSimulatedProvider({ delayMs: 0 })
    const x = await ai.extractLead("Hi, I'm Rahul Verma, 9845012345", ctx())
    expect(x.mode).toBe('simulated')
    const plan = await ai.parseCommand('help', ctx())
    expect(plan.mode).toBe('simulated')
  })

  it('maps messy headers by synonym and by sample values', () => {
    const m = mapColumnsSim(['Customer Name', 'Contact', 'Pref. Location', 'Budget'], [['Priya', '98450 12345', 'Whitefield', '1.2 Cr']], 'leads')
    expect(m.map((x) => x.field)).toEqual(['name', 'phone', 'requirement.localities', 'requirement.budgetMax'])
  })
})
