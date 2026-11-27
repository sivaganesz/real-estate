import { describe, expect, it } from 'vitest'
import { INTENDED_TEMPERATURE, buildSeed } from '@/data/seed'
import { T_NOW, makeLead, makeProperty } from '@/test/factories'
import { suggestedClassification } from './classification'
import { suggestNext } from './next-action'
import { qualificationCard, readiness } from './qualification'
import { leadScore, priorityFor, probabilityFor } from './scoring'

const db = buildSeed(new Date(2026, 10, 27, 10, 30))
const now = new Date(2026, 10, 27, 10, 30)
const ctx = { properties: db.properties, settings: db.settings, now }

describe('lead score (0–100, explained)', () => {
  it('is the sum of five factors with fixed maxima', () => {
    for (const l of db.leads) {
      const s = leadScore(l, ctx)
      expect(s.factors.map((f) => f.max)).toEqual([40, 20, 15, 10, 15])
      expect(s.score).toBe(s.factors.reduce((n, f) => n + f.points, 0))
      expect(s.score).toBeGreaterThanOrEqual(0)
      expect(s.score).toBeLessThanOrEqual(100)
      for (const f of s.factors) expect(f.points).toBeLessThanOrEqual(f.max)
    }
  })

  it('reproduces the seed\'s designed temperatures: every hot lead is hot, and most others agree', () => {
    const entries = Object.entries(INTENDED_TEMPERATURE)
    let agree = 0
    for (const [id, want] of entries) {
      const got = leadScore(db.leads.find((l) => l.id === id)!, ctx).temperature
      if (want === 'hot') expect(got, id).toBe('hot')
      if (got === want) agree++
    }
    expect(agree / entries.length).toBeGreaterThanOrEqual(0.75)
  })

  it('an override wins; probability blends stage and score; lost is 0 and converted 1', () => {
    const l = makeLead({ temperatureOverride: 'cold', stage: 'negotiation' })
    const s = leadScore(l, { properties: [], settings: db.settings, now })
    expect(s.temperature).toBe('cold')
    expect(probabilityFor({ stage: 'negotiation' }, 80, db.settings)).toBe(0.73)
    expect(probabilityFor({ stage: 'lost' }, 99, db.settings)).toBe(0)
    expect(probabilityFor({ stage: 'converted' }, 1, db.settings)).toBe(1)
  })

  it('priority is high for hot leads, a visit today or something overdue', () => {
    const l = makeLead({ id: 'X' })
    expect(priorityFor(l, 'hot', { appointments: [], tasks: [], now })).toBe('high')
    expect(priorityFor(l, 'warm', { appointments: [], tasks: [], now })).toBe('medium')
    const overdue = { id: 't', title: 'x', type: 'call' as const, status: 'open' as const, priority: 'low' as const, leadId: 'X', ownerId: 'u', dueAt: new Date(now.getTime() - 1000).toISOString(), createdBy: 'u', createdAt: now.toISOString(), origin: 'manual' as const }
    expect(priorityFor(l, 'cold', { appointments: [], tasks: [overdue], now })).toBe('high')
    expect(priorityFor({ ...l, priorityOverride: 'low' }, 'hot', { appointments: [], tasks: [], now })).toBe('low')
  })
})

describe('qualification', () => {
  it('shows the four checks and asks only for what is missing, with chips', () => {
    const card = qualificationCard(makeLead({ requirement: { budgetMax: 12_000_000, propertyTypes: ['apartment'], cities: ['Bengaluru'], configurations: ['3BHK'] }, qualification: { decisionMakers: ['spouse'], loan: 'unknown' } }))
    expect(card.known).toEqual(['budget', 'authority', 'need'])
    expect(card.missing).toEqual(['timeline'])
    expect(card.questions[0].prompt).toBe('leads:qualify.question.timeline')
    expect(card.questions[0].chips?.map((c) => c.value)).toEqual(['immediate', 'm1to3', 'm3to6', 'exploring'])
  })

  it('readiness adds up to 100 points over six parts', () => {
    const r = readiness(makeLead({ requirement: { budgetMax: 7_500_000 }, qualification: { need: 'clear', timeline: 'immediate', fundingReady: 'ready', authority: 'sole', decisionMakers: [], loan: 'preApproved' }, engagement: { responded: true, docsRequested: true, siteVisited: true } }), { properties: [makeProperty()], settings: db.settings, now: T_NOW })
    expect(r.rows.reduce((n, x) => n + x.max, 0)).toBe(100)
    expect(r.total).toBe(100)
    expect(r.band).toBe('high')
  })
})

describe('classification and next action', () => {
  it('suggests high value from ₹1.5 Cr and never HNI from budget alone', () => {
    expect(suggestedClassification(makeLead({ requirement: { budgetMax: 32_000_000 } }), ctx)).toBe('highValue')
    expect(suggestedClassification(makeLead({ hni: { status: 'verified' } }), ctx)).toBe('verifiedHni')
    expect(suggestedClassification(makeLead({ qualification: { decisionMakers: [], loan: 'unknown', buyerPurpose: 'investment' } }), ctx)).toBe('investor')
  })

  it('picks the next best action from the record', () => {
    const next = (id: string) => suggestNext(db.leads.find((l) => l.id === id)!, { ...ctx, appointments: db.appointments, tasks: db.tasks })
    expect(next('LEAD-1019')?.action).toBe('assignLead') // unassigned
    expect(next('LEAD-1004')?.key).toBe('overdueTask') // Mohammed: overdue call
    expect(next('LEAD-1007')?.action).toBe('openAppointment') // Lakshmi: visit today 16:00
    const pastVisit = db.appointments.find((a) => a.leadId && ['scheduled', 'confirmed'].includes(a.status) && new Date(a.start).getTime() < now.getTime() - 3 * 3_600_000)
    if (pastVisit) expect(next(pastVisit.leadId!)?.action).toBe('logOutcome') // a visit that still needs its outcome comes first
    const booked = makeLead({ id: 'B1', stage: 'booked', deal: { propertyId: 'PRP-1013', bookingAmount: 500_000 } })
    expect(suggestNext(booked, { ...ctx, appointments: [], tasks: [] })?.key).toBe('collectDocs')
    expect(suggestNext(db.leads.find((l) => l.stage === 'lost')!, { ...ctx, appointments: db.appointments, tasks: db.tasks })).toBeNull()
  })
})
