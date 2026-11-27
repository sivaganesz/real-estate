import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { classificationOf } from './classification'
import { attentionOf, contactAging, filterCount, filtersFromView, inTab, leadItems, matchesLead, parseLeadSentence, sameFilters, sortLeads, tabCounts, toCsv, viewFromFilters } from './lead-queries'
import { leadScore, priorityFor } from './scoring'

const now = new Date(2026, 10, 27, 10, 30)
const db = buildSeed(now)
const ctx = { properties: db.properties, settings: db.settings, now }
const items = leadItems(db.leads, {
  score: (l) => leadScore(l, ctx), cls: (l) => classificationOf(l, ctx), tasks: db.tasks, appointments: db.appointments,
})
const byName = (n: string) => items.find((x) => x.lead.name === n)!

describe('lead-queries', () => {
  it('derives the next follow-up from the earliest open task', () => {
    const irfan = byName('Mohammed Irfan')
    expect(irfan.nextFollowUpAt).toBeDefined()
    expect(inTab(irfan, 'overdue', now)).toBe(true)
    expect(attentionOf(irfan, now)).toContain('overdue')
  })

  it('counts every lead exactly once across overdue / today / upcoming / no follow-up / closed', () => {
    const c = tabCounts(items, now)
    expect(c.all).toBe(db.leads.length)
    expect(c.closed).toBe(db.leads.filter((l) => ['converted', 'lost'].includes(l.stage)).length)
    expect(c.overdue).toBeGreaterThan(0)
  })

  it('flags the uncalled new lead', () => {
    expect(attentionOf(byName('Neha Kulkarni'), now)).toContain('uncontacted')
  })

  it('reads a sentence into filters and applies them', () => {
    const f = parseLeadSentence('hot NRI leads in Gurugram under 4 cr')
    expect(f).toMatchObject({ cities: ['NCR'], nri: true, temperatures: ['hot'], maxBudget: 40_000_000 })
    expect(filterCount(f)).toBe(4)
    const f2 = parseLeadSentence('unassigned leads in Whitefield')
    expect(f2.cities).toEqual(['Bengaluru'])
    expect(f2.owners).toEqual(['__none'])
    const unassigned = items.filter((x) => matchesLead(x, { owners: ['__none'], stages: ['new'] }, now))
    expect(unassigned.length).toBeGreaterThanOrEqual(3)
  })

  it('sorts by score, highest first', () => {
    const s = sortLeads(items.filter((x) => x.lead.ownerId === 'u-arjun'))
    expect(s[0].score).toBeGreaterThanOrEqual(s[s.length - 1].score)
  })
})

describe('lead-queries: aging, saved views, CSV, extra filters', () => {
  it('ages leads by days since contact and flags the SLA breach', () => {
    const neha = byName('Neha Kulkarni').lead
    const a = contactAging(neha, db.settings.sla, now)
    expect(a.breached).toBe(true)
    expect(a.tone).toBe('danger')
    const sanjay = contactAging(byName('Sanjay Gupta').lead, db.settings.sla, now)
    expect(sanjay.days).toBeGreaterThanOrEqual(7)
    expect(sanjay.tone).toBe('danger')
    const closed = db.leads.find((l) => l.stage === 'converted')!
    expect(contactAging(closed, db.settings.sla, now).tone).toBe('muted')
  })

  it('reads the seed saved views and round-trips filters', () => {
    expect(filtersFromView({ filters: { temperature: ['hot'] }, sort: { key: 'score', dir: 'desc' } })).toEqual({ temperatures: ['hot'], sort: 'score' })
    expect(filtersFromView({ filters: { owner: 'unassigned' }, sort: { key: 'createdAt', dir: 'asc' } })).toEqual({ owners: ['__none'], sort: 'newest' })
    const f = { stages: ['new', 'contacted'] as const, q: '', cities: [], maxBudget: 8_000_000, sort: 'name' as const }
    const v = viewFromFilters({ ...f, stages: [...f.stages] })
    expect(v.filters).toEqual({ stages: ['new', 'contacted'], maxBudget: 8_000_000 })
    expect(sameFilters(filtersFromView(v), { stages: ['contacted', 'new'], maxBudget: 8_000_000, sort: 'name' })).toBe(true)
    expect(sameFilters(filtersFromView(v), { stages: ['new'], maxBudget: 8_000_000, sort: 'name' })).toBe(false)
  })

  it('filters by priority, locality and creation date', () => {
    const withPriority = leadItems(db.leads, {
      score: (l) => leadScore(l, ctx), cls: (l) => classificationOf(l, ctx), tasks: db.tasks, appointments: db.appointments,
      priority: (l, temp) => priorityFor(l, temp, { appointments: db.appointments, tasks: db.tasks, now }),
    })
    const high = withPriority.filter((x) => matchesLead(x, { priorities: ['high'] }, now))
    expect(high.length).toBeGreaterThan(0)
    expect(high.every((x) => x.priority === 'high')).toBe(true)
    expect(items.filter((x) => matchesLead(x, { localities: ['Whitefield'] }, now)).every((x) => x.lead.requirement.localities.includes('Whitefield'))).toBe(true)
    const today = items.filter((x) => matchesLead(x, { createdWithin: 1 }, now))
    expect(today.map((x) => x.lead.name)).toContain('Neha Kulkarni')
    expect(filterCount({ priorities: ['high'], createdWithin: 7 })).toBe(2)
  })

  it('writes safe CSV', () => {
    expect(toCsv(['Name', 'Note'], [['Rahul, V', 'said "hi"'], ['=SUM(A1)', -5]])).toBe('Name,Note\r\n"Rahul, V","said ""hi"""\r\n\'=SUM(A1),-5')
  })
})
