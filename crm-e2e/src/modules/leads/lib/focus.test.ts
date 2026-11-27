import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { classificationOf } from '@/lib/classification'
import { leadItems } from '@/lib/lead-queries'
import { leadScore } from '@/lib/scoring'
import { FOCUS_GROUPS, groupFocus } from './focus'

const now = new Date(2026, 10, 27, 10, 30)
const db = buildSeed(now)
const ctx = { properties: db.properties, settings: db.settings, now }
const items = leadItems(db.leads, { score: (l) => leadScore(l, ctx), cls: (l) => classificationOf(l, ctx), tasks: db.tasks, appointments: db.appointments })

describe('Today design grouping', () => {
  it('puts each open lead in at most one group, overdue first, and never closed leads', () => {
    const g = groupFocus(items, now)
    const ids = FOCUS_GROUPS.flatMap((k) => g[k].map((x) => x.lead.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(g.overdue.map((x) => x.lead.name)).toContain('Mohammed Irfan')
    expect([...g.overdue, ...g.uncontacted].map((x) => x.lead.name)).toContain('Neha Kulkarni') // her SLA first-call task is already overdue
    expect(ids.every((id) => !['converted', 'lost'].includes(db.leads.find((l) => l.id === id)!.stage))).toBe(true)
  })
})

describe('list header numbers', () => {
  it('buckets new leads by week and counts the headline numbers', async () => {
    const { weeklyNew, headline } = await import('./list-stats')
    const { contactAging } = await import('@/lib/lead-queries')
    const w = weeklyNew(db.leads, now)
    expect(w).toHaveLength(8)
    expect(w.at(-1)).toBeGreaterThan(0)
    const h = headline(items.map((x) => ({ ...x, aging: contactAging(x.lead, db.settings.sla, now) })), now)
    expect(h.unassigned).toBeGreaterThanOrEqual(3)
    expect(h.sla).toBeGreaterThanOrEqual(1)
    expect(h.open).toBeGreaterThan(h.hot)
  })
})
