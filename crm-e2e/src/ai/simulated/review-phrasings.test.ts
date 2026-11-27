/**
 * Varied phrasings written by the foundation reviewer (master prompt §12.1: the simulated provider must work on any
 * reasonable input, not only the demo strings). Each case was a gap before the review.
 */
import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import type { AIContext } from '../types'
import { parseCommandSim } from './commands'
import { extractAppointmentFields } from './extract-appointment'
import { extractLeadFields } from './extract-lead'
import { extractPropertyFields } from './extract-property'

const now = new Date(2026, 10, 27, 10, 30, 0)
const db = buildSeed(now)
const ctx = (id: string): AIContext => {
  const actor = db.users.find((u) => u.id === id)!
  return { actor, role: actor.role, route: '/today', now, db: () => db }
}

describe('lead names before a labelled phone', () => {
  it('"new enquiry - Suresh Kumar, ph 98765 43210, …"', () => {
    const x = extractLeadFields('new enquiry - Suresh Kumar, ph 98765 43210, wants 2bhk flat near Hinjewadi pune, max 75 lakh, investment purpose, came via magicbricks', { now, db })
    expect(x.fields.name).toBe('Suresh Kumar')
    expect(x.fields.phone).toBe('+919876543210')
    expect(x.fields.source).toBe('magicbricks')
    expect(x.fields.requirement?.budgetMax).toBe(7_500_000)
    expect(x.fields.qualification?.buyerPurpose).toBe('investment')
    expect(x.missing).toEqual([])
  })

  it('"NRI from USA, Priyanka Rao, whatsapp +1 415 …"', () => {
    const x = extractLeadFields('NRI from USA, Priyanka Rao, whatsapp +1 415 555 0101 / india 9844556677, wants a 4BHK in Gurugram sector 65 for parents, 3.5 Cr, exploring options', { now, db })
    expect(x.fields.name).toBe('Priyanka Rao')
    expect(x.fields.phone).toBe('+919844556677')
    expect(x.fields.isNri).toBe(true)
    expect(x.fields.requirement?.budgetMax).toBe(35_000_000)
  })

  it('a city before a phone is not a name', () => {
    expect(extractLeadFields('2bhk in Pune, 9876543210', { now, db }).fields.name).toBeUndefined()
  })
})

describe('appointments', () => {
  const leads = db.leads.filter((l) => l.ownerId === 'u-arjun')
  it('"video call with neha in 2 hours" starts two hours from now, not a 2-hour call', () => {
    const x = extractAppointmentFields('video call with neha in 2 hours', { now, leads, properties: db.properties })
    expect(x.fields.type).toBe('videoCall')
    expect(x.date).toBe('2026-11-27')
    expect(x.time).toBe('12:30')
    expect(x.fields.durationMin).toBe(30)
    expect(x.missing).toEqual([])
  })

  it('"meet karthik day after tomorrow 3:30 pm" is an office meeting', () => {
    const x = extractAppointmentFields('meet karthik day after tomorrow 3:30 pm', { now, leads, properties: db.properties })
    expect(x.fields.type).toBe('officeMeeting')
    expect(x.date).toBe('2026-11-29')
    expect(x.time).toBe('15:30')
  })
})

describe('properties', () => {
  it('reads approval authorities and patta', () => {
    const x = extractPropertyFields('Owner selling independent house in Anna Nagar Chennai, 2400 sq ft plot, 3.2 crore negotiable, CMDA approved, patta available', { now })
    expect(x.fields.approvals).toEqual([{ authority: 'CMDA', docStatus: 'pending' }])
    expect(x.fields.pattaAvailable).toBe(true)
    expect(extractPropertyFields('plot 30x40 in Tambaram DTCP approved 45 lakhs corner plot', { now }).fields.approvals?.map((a) => a.authority)).toEqual(['DTCP'])
  })
})

describe('the assistant refuses what the role cannot do', () => {
  it('an executive or a manager cannot delete a property; the admin is sent to the record', () => {
    expect(parseCommandSim('delete property Aranya Greens', ctx('u-arjun')).refusal?.action).toBe('property.delete')
    expect(parseCommandSim('remove the Kokapet villa listing', ctx('u-rohit')).refusal?.action).toBe('property.delete')
    const admin = parseCommandSim('delete property Aranya Greens', ctx('u-admin'))
    expect(admin.refusal).toBeUndefined()
    expect(admin.proposals).toEqual([])
  })

  it('an executive cannot delete a lead or deactivate a user', () => {
    expect(parseCommandSim('delete lead Mohammed Irfan', ctx('u-sneha')).refusal?.action).toBe('lead.delete')
    expect(parseCommandSim('deactivate user Vikram', ctx('u-rohit')).refusal?.action).toBe('user.manage')
  })
})
