import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { classificationOf } from './classification'
import { attentionOf, filterCount, inTab, leadItems, matchesLead, parseLeadSentence, sortLeads, tabCounts } from './lead-queries'
import { leadScore } from './scoring'

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
