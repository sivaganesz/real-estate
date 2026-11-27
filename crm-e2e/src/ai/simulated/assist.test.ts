/**
 * Module-assistant helpers and the simulated readers on varied, realistic input (plan §8.3 M7: at least 25 varied
 * inputs incl. Hinglish, Indian amounts and phones, owner listings and appointment phrases).
 */
import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { classifyImport, classifyPaste, guessImportKind, parseTable, patchFromPath, propertyInputFrom, purposeForStage, suggestFollowUpTime } from './assist'
import { extractAppointmentFields } from './extract-appointment'
import { extractLeadFields } from './extract-lead'
import { extractPropertyFields } from './extract-property'
import { hinglishWords } from './hinglish'
import { readLeadUpdate } from './lead-update'
import { readPropertyUpdate } from './property-update'

const now = new Date(2026, 10, 27, 10, 0, 0) // a Friday
const db = buildSeed(now)
const lead = (text: string) => extractLeadFields(hinglishWords(text), { now, db })

describe('lead extraction: Indian formats and Hinglish', () => {
  it.each([
    ['3bhk chahiye Whitefield mein 1.2 cr tak', { configurations: ['3BHK'], localities: ['Whitefield'], budgetMax: 12_000_000 }],
    ['Need 2BHK in Wakad, budget 85 lakhs', { configurations: ['2BHK'], budgetMax: 8_500_000 }],
    ['looking for villa, 1.2Cr max, Sarjapur', { budgetMax: 12_000_000 }],
    ['2.5BHK east facing flat around 95 L', { configurations: ['2.5BHK'], facing: ['E'], budgetMax: 9_500_000 }],
    ['Need 1200 sqft 3 bhk under 1.5 crore in Gachibowli', { configurations: ['3BHK'], budgetMax: 15_000_000 }],
    ['budget 60-80 L, 2 BHK, ready to move', { budgetMin: 6_000_000, budgetMax: 8_000_000, possession: 'ready' }],
  ])('%s', (text, want) => {
    const r = lead(text).fields.requirement!
    for (const [k, v] of Object.entries(want)) expect(r[k as keyof typeof r]).toEqual(v)
  })

  it('reads +91 98450 12345 and an e-mail', () => {
    const x = lead('Name: Kavitha Rao, +91 98450 12345, kavitha.rao@example.com, wants 3BHK in Anna Nagar')
    expect(x.fields.phone).toBe('+919845012345')
    expect(x.fields.email).toBe('kavitha.rao@example.com')
    expect(x.fields.name).toBe('Kavitha Rao')
  })

  it('Hinglish name, timeline and decision maker', () => {
    const x = lead('mera naam Arvind Kumar hai, 9876512345, 2bhk chahiye Hinjewadi mein, 70 lakh tak, papa bhi decide karenge, turant')
    expect(x.fields.name).toBe('Arvind Kumar')
    expect(x.fields.requirement?.budgetMax).toBe(7_000_000)
    expect(x.fields.qualification?.timeline).toBe('immediate')
  })
})

describe('owner listings', () => {
  it('a WhatsApp listing in shorthand', () => {
    const x = extractPropertyFields('Resale 2 BHK in Wakad Pune, 1050 sqft carpet, 3rd floor, east facing, 1 covered parking, asking 78 L slightly negotiable, RTM. Owner Mahesh 9822012345', { now })
    expect(x.fields).toMatchObject({ type: 'apartment', configuration: '2BHK', price: 7_800_000, facing: 'E', floor: 3, priceNegotiable: true })
    expect(x.fields.possession?.status).toBe('ready')
    const input = propertyInputFrom(x)
    expect(input?.listing).toBe('live')
    expect(input?.status).toBe('available')
  })

  it('stays undefined while essentials are missing', () => {
    expect(propertyInputFrom(extractPropertyFields('Nice villa with garden, call me', { now }))).toBeUndefined()
  })
})

describe('appointment phrases', () => {
  const leads = db.leads
  const props = db.properties.filter((p) => p.listing === 'live')
  it.each([
    ['Site visit with Priya Sharma tomorrow 5pm', '2026-11-28', '17:00'],
    ['meeting with Neha next Saturday morning', '2026-11-28', '10:00'],
    ['site visit for Karthik on 3rd Dec at 11', '2026-12-03', '11:00'],
    ['Priya ka visit kal shaam 6 baje', '2026-11-28', '18:00'],
    ['video call with Ananya on Monday 4:30 pm', '2026-11-30', '16:30'],
  ])('%s', (text, date, time) => {
    const x = extractAppointmentFields(hinglishWords(text), { now, leads, properties: props })
    expect(x.date).toBe(date)
    expect(x.time).toBe(time)
    expect(x.fields.leadId).toBeTruthy()
  })
})

describe('record updates read only real changes', () => {
  it('lead: budget, configuration, timeline, a call and the next follow-up', () => {
    const l = db.leads.find((x) => x.name === 'Karthik Subramanian')!
    const r = readLeadUpdate('Spoke to him, budget can go up to 2.2 Cr, now wants 4BHK, wants to close in 2 months, call again Monday 6pm', l, { now })
    expect(r.contact).toMatchObject({ channel: 'call', result: 'connected' })
    expect(r.patch.requirement?.budgetMax).toBe(22_000_000)
    expect(r.patch.requirement?.configurations).toEqual(['4BHK+'])
    expect(r.patch.qualification?.timeline).toBe('m1to3')
    expect(r.followUp?.day).toBe('2026-11-30')
  })

  it('lead: lost to a competitor', () => {
    const l = db.leads.find((x) => x.stage !== 'lost')!
    expect(readLeadUpdate('not interested, bought elsewhere', l, { now }).lost).toBe('boughtElsewhere')
  })

  it('property: a sold status and nothing else', () => {
    const p = db.properties.find((x) => x.status === 'available')!
    const r = readPropertyUpdate('sold last week', p, { now })
    expect(r.patch).toEqual({ status: 'sold' })
  })
})

describe('module-assistant helpers', () => {
  it('reads a pasted CSV with quotes and guesses the import kind', () => {
    const t = parseTable('Customer Name,Mobile,Budget,Location\n"Rao, Priya",9845012345,1.2 Cr,Whitefield\nAmit,9876543210,85 L,Wakad')
    expect(t?.headers).toEqual(['Customer Name', 'Mobile', 'Budget', 'Location'])
    expect(t?.rows[0][0]).toBe('Rao, Priya')
    expect(guessImportKind(t!.headers)).toBe('leads')
    expect(guessImportKind(['Project', 'BHK', 'Carpet Sqft', 'Price', 'Facing'])).toBe('apartments')
    expect(guessImportKind(['Survey No', 'Plot Area', 'Price', 'DTCP'])).toBe('plots')
  })

  it('classifies a paste as table, listing, appointment or enquiry', () => {
    expect(classifyPaste('Name\tPhone\tBudget\nA\t9845012345\t1 Cr\nB\t9845012346\t2 Cr')).toBe('table')
    expect(classifyPaste('Selling my 3 BHK flat, 1450 sqft carpet, asking 1.25 Cr negotiable')).toBe('property')
    expect(classifyPaste('Site visit with Priya tomorrow 11am')).toBe('appointment')
    expect(classifyPaste('Hi, looking for a 2BHK under 80 L in Wakad, 9845012345')).toBe('lead')
    expect(classifyImport('Hi, looking for a 2BHK').type).toBe('lead')
  })

  it('suggests a follow-up time and a message that fit the lead', () => {
    const base = { firstContactAt: undefined, lastContactAt: undefined }
    expect(suggestFollowUpTime({ ...base, stage: 'new' }, 'warm', now).reasonKey).toBe('ai:followUpTime.newLead')
    expect(new Date(suggestFollowUpTime({ ...base, stage: 'qualified', firstContactAt: 'x' }, 'hot', now).at).getHours()).toBe(12)
    const cold = new Date(suggestFollowUpTime({ ...base, stage: 'contacted', firstContactAt: 'x' }, 'cold', now).at)
    expect(cold.getDay()).toBe(1) // three days from Friday is Monday
    expect(purposeForStage({ stage: 'siteVisitScheduled', firstContactAt: 'x' })).toBe('visitConfirm')
    expect(purposeForStage({ stage: 'new', firstContactAt: undefined })).toBe('intro')
  })

  it('turns a field path and an answer into a patch', () => {
    expect(patchFromPath('qualification.timeline', 'm1to3')).toEqual({ qualification: { timeline: 'm1to3' } })
    expect(patchFromPath('source', 'walkIn')).toEqual({ source: 'walkIn' })
  })
})

describe('requests from other modules', () => {
  it('M3 R2: "owner Ramesh 98450 12345" fills the owner name', () => {
    const x = extractPropertyFields('2BHK flat for sale in Wakad Pune, 980 sqft, 78 L, owner Ramesh 98450 12345', { now })
    expect(x.fields.owner).toMatchObject({ name: 'Ramesh', phone: '+919845012345' })
  })
})
