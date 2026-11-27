import { describe, expect, it } from 'vitest'
import type { Appointment, Lead, Property, VisitOutcome } from '@/domain/types'
import { confirmationMessage } from './messages'
import { prepPoints, readOutcomeNotes, suggestAfterOutcome, summaryPoints, summaryText } from './visit-ai'

const now = new Date(2026, 10, 27, 12, 0)
const lead = (p: Partial<Lead> = {}): Lead => ({
  id: 'LEAD-1', name: 'Priya Sharma', phone: '+919845012345', source: 'website', isNri: false, ownerId: 'u1', createdBy: 'u1',
  createdAt: '', updatedAt: '', createdVia: 'manual', stage: 'siteVisitScheduled', stageSince: '', stageHistory: [],
  requirement: {
    propertyTypes: ['apartment'], configurations: ['3BHK'], cities: ['Bengaluru'], localities: ['Whitefield'], budgetMax: 10_000_000, budgetFlexPct: 10,
    possession: 'ready', facing: ['E'], amenities: [], mustHaves: ['covered parking'], purpose: 'sale',
  },
  qualification: { decisionMakers: ['self', 'spouse'], loan: 'needed', authority: 'joint', timeline: 'immediate' },
  engagement: { responded: true, docsRequested: false, siteVisited: false }, shortlist: [], tags: [], ...p,
})
const prop = (p: Partial<Property> = {}): Property => ({
  id: 'PRP-1', title: 'Aranya Greens 3BHK', type: 'apartment', category: 'residential', purpose: 'sale', transaction: 'newBooking',
  location: { city: 'Bengaluru', locality: 'Whitefield' }, price: 12_000_000, area: {}, parking: { covered: 1, open: 0 }, amenities: [],
  possession: { status: 'underConstruction' }, approvals: [], bankApprovals: ['SBI', 'HDFC Bank'], specs: {}, status: 'available', listing: 'live',
  media: [], createdBy: 'u1', createdAt: '', updatedAt: '', facing: 'E', ...p,
})
const appt = (p: Partial<Appointment> = {}): Appointment => ({
  id: 'APT-1', type: 'siteVisit', status: 'scheduled', leadId: 'LEAD-1', propertyIds: ['PRP-1'], ownerId: 'u1',
  start: new Date(2026, 10, 28, 11, 0).toISOString(), durationMin: 60, reminderMins: 60, createdBy: 'u1', createdAt: '', updatedAt: '', ...p,
})

describe('prepPoints', () => {
  it('warns first: unconfirmed, over budget, possession; then tips; at most six', () => {
    const pts = prepPoints({ appointment: appt(), lead: lead(), properties: [prop()], history: [], now })
    const keys = pts.map((p) => p.key)
    expect(keys[0]).toBe('prep.confirm')
    expect(keys).toContain('prep.overBudget')
    expect(keys).toContain('prep.possession')
    expect(pts.find((p) => p.key === 'prep.overBudget')?.params).toMatchObject({ pct: 20 })
    expect(pts.length).toBeLessThanOrEqual(6)
    const firstTip = pts.findIndex((p) => p.tone !== 'warn')
    expect(pts.slice(firstTip).every((p) => p.tone !== 'warn')).toBe(true)
  })
  it('mentions the decision maker, the loan banks and past objections', () => {
    const history = [appt({ id: 'APT-0', status: 'completed', outcome: { result: 'thinking', likedPropertyIds: [], objections: 'Kitchen too small', at: '', by: 'u1' } })]
    const pts = prepPoints({ appointment: appt({ status: 'confirmed', propertyIds: [] }), lead: lead(), properties: [], history, now, limit: 20 })
    const keys = pts.map((p) => p.key)
    expect(keys).toEqual(expect.arrayContaining(['prep.decisionMakers', 'prep.loan', 'prep.revisit', 'prep.objections', 'prep.urgent']))
    expect(pts.find((p) => p.key === 'prep.objections')?.params?.text).toBe('Kitchen too small')
    expect(pts.find((p) => p.key === 'prep.decisionMakers')?.params?.who).toBe('spouse')
  })
  it('says so when no lead is linked', () => {
    expect(prepPoints({ appointment: appt({ leadId: undefined, status: 'confirmed' }), properties: [], history: [], now }).map((p) => p.key)).toEqual(['prep.noLead'])
  })
  it('flags a property that is no longer available', () => {
    const pts = prepPoints({ appointment: appt({ status: 'confirmed' }), lead: lead(), properties: [prop({ status: 'booked' })], history: [], now })
    expect(pts[0].key).toBe('prep.unavailable')
  })
})

describe('suggestAfterOutcome', () => {
  const base = { likedPropertyIds: [] as string[] }
  it('ready to book: call back within two hours and move to negotiation', () => {
    const s = suggestAfterOutcome({ outcome: { ...base, result: 'readyToBook' }, type: 'siteVisit', stage: 'siteVisitScheduled', now })
    expect(s.stage).toBe('negotiation')
    expect(new Date(s.followUpAt).getTime() - now.getTime()).toBeLessThanOrEqual(2.25 * 3_600_000)
    expect(s.reasonKey).toBe('after.readyToBook')
  })
  it('strong interest with the decision maker present → negotiation tomorrow 11:00', () => {
    const s = suggestAfterOutcome({ outcome: { result: 'interested', interest: 'high', likedPropertyIds: ['PRP-1'], decisionMakerPresent: true }, type: 'siteVisit', stage: 'siteVisitScheduled', now })
    expect(s.stage).toBe('negotiation')
    expect(new Date(s.followUpAt)).toEqual(new Date(2026, 10, 28, 11, 0))
  })
  it('decision maker absent → revisit with the family, stage only to visit done', () => {
    const s = suggestAfterOutcome({ outcome: { result: 'thinking', likedPropertyIds: [], decisionMakerPresent: false }, type: 'siteVisit', stage: 'siteVisitScheduled', now })
    expect(s.stage).toBe('siteVisitDone')
    expect(s.nextStepKey).toBe('next.revisitFamily')
  })
  it('never moves a lead backwards or out of a closed stage', () => {
    expect(suggestAfterOutcome({ outcome: { ...base, result: 'interested' }, type: 'siteVisit', stage: 'negotiation', now }).stage).toBeUndefined()
    expect(suggestAfterOutcome({ outcome: { ...base, result: 'readyToBook' }, type: 'phoneCall', stage: 'lost', now }).stage).toBeUndefined()
  })
  it('a late ready-to-book moves the call to the next morning', () => {
    const late = new Date(2026, 10, 27, 18, 30)
    const s = suggestAfterOutcome({ outcome: { ...base, result: 'readyToBook' }, type: 'siteVisit', stage: 'siteVisitDone', now: late })
    expect(new Date(s.followUpAt)).toEqual(new Date(2026, 10, 28, 10, 30))
  })
  it('not interested: check in a week later', () => {
    const s = suggestAfterOutcome({ outcome: { ...base, result: 'notInterested' }, type: 'officeMeeting', stage: 'qualified', now })
    expect(new Date(s.followUpAt)).toEqual(new Date(2026, 11, 4, 11, 0))
    expect(s.stage).toBeUndefined()
  })
})

describe('summary', () => {
  const o: VisitOutcome = { result: 'interested', interest: 'high', likedPropertyIds: ['PRP-1'], objections: 'Maintenance is high', decisionMakerPresent: false, nextStep: 'Revisit on Sunday', at: '', by: 'u1' }
  it('builds the headline and the facts', () => {
    const s = summaryPoints({ outcome: o, properties: [prop()], leadName: 'Priya Sharma', durationMin: 60, type: 'siteVisit' })
    expect(s.headline).toMatchObject({ key: 'summary.headline.interested', params: { name: 'Priya' } })
    expect(s.points.map((p) => p.key)).toEqual(['summary.interest', 'summary.liked', 'summary.objections', 'summary.dmAbsent', 'summary.nextStep'])
  })
  it('writes a plain-text summary', () => {
    expect(summaryText(o, ['Aranya Greens'], 'Priya Sharma')).toBe('Priya: interested (high interest). Liked Aranya Greens. Concerns: Maintenance is high. Decision maker was not present. Next: Revisit on Sunday.')
  })
})

describe('readOutcomeNotes', () => {
  const props = [prop(), prop({ id: 'PRP-2', title: 'Lakeview Villas', projectName: 'Lakeview' })]
  it('reads result, interest, liked property, decision maker, concern and next step', () => {
    const r = readOutcomeNotes('They loved Aranya Greens, his wife came too. Worried about the maintenance charge. Will decide by Sunday.', props)
    expect(r.fields).toMatchObject({ result: 'thinking', interest: 'high', likedPropertyIds: ['PRP-1'], decisionMakerPresent: true })
    expect(r.fields.objections).toMatch(/maintenance/i)
    expect(r.fields.nextStep).toMatch(/decide by sunday/i)
    expect(r.confidence.result).toBeGreaterThan(0)
  })
  it('reads ready to book and an absent spouse', () => {
    const r = readOutcomeNotes('Wants to book the unit at Lakeview, ready to pay the token. Wife was not there.', props)
    expect(r.fields.result).toBe('readyToBook')
    expect(r.fields.likedPropertyIds).toEqual(['PRP-2'])
    expect(r.fields.decisionMakerPresent).toBe(false)
  })
  it('reads not interested and returns nothing for empty text', () => {
    expect(readOutcomeNotes('Did not like the location, not interested.', props).fields.result).toBe('notInterested')
    expect(readOutcomeNotes('   ', props).fields).toEqual({})
  })
})

describe('confirmationMessage', () => {
  it('includes the time, the venue and the map link', () => {
    const m = confirmationMessage({ appointment: { type: 'officeMeeting', location: { text: 'RealSpec office, Koramangala', mapUrl: 'https://maps.example/x' } }, leadName: 'Priya Sharma', agent: 'Arjun Mehta', when: '28 Nov 2026, 11:00 AM' })
    expect(m).toContain('Hi Priya, this is Arjun from RealSpec.')
    expect(m).toContain('meeting at our office on 28 Nov 2026, 11:00 AM')
    expect(m).toContain('Venue: RealSpec office, Koramangala')
    expect(m).toContain('Location: https://maps.example/x')
  })
  it('writes Hinglish when asked', () => {
    expect(confirmationMessage({ appointment: { type: 'phoneCall' }, leadName: 'Rohan', agent: 'Sneha', when: 'kal 5 baje', tone: 'hinglish' })).toContain('main Sneha RealSpec se')
  })
})
