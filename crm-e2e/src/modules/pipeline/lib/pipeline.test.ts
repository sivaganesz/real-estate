import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { leadScore } from '@/lib/scoring'
import { makeLead, settingsWith, T_NOW } from '@/test/factories'
import {
  activeFilterCount, boardStages, buildDeals, columnSummaries, dealValue, EMPTY_FILTERS, inBand, matchesDeal, pipelineTotals,
  sortColumn, sortDeals, stageAnalytics, UNASSIGNED, weeklySeries, type DealItem,
} from './pipeline'

const DAY = 86_400_000
const ago = (days: number) => new Date(T_NOW.getTime() - days * DAY).toISOString()

const deal = (p: Omit<Partial<DealItem>, 'lead'> & { lead?: Parameters<typeof makeLead>[0] }): DealItem => {
  const lead = makeLead(p.lead ?? {})
  return {
    value: dealValue(lead), days: 0, target: 3, aging: 'muted', stalled: false, score: 50, temperature: 'warm', probability: 0.3,
    ...p, lead,
  }
}

describe('pipeline: values and stages', () => {
  it('uses the deal value, else the top of the budget', () => {
    expect(dealValue(makeLead({ requirement: { budgetMax: 9_000_000 } }))).toBe(9_000_000)
    expect(dealValue(makeLead({ requirement: { budgetMax: 9_000_000 }, deal: { value: 8_500_000 } }))).toBe(8_500_000)
    expect(dealValue(makeLead({ requirement: { budgetMax: undefined } }))).toBe(0)
  })

  it('lists only the enabled stages, in the configured order', () => {
    const s = settingsWith()
    s.pipeline.stages = s.pipeline.stages.map((d) => (d.key === 'converted' ? { ...d, enabled: false } : d.key === 'new' ? { ...d, order: 99 } : d))
    const stages = boardStages(s)
    expect(stages).not.toContain('converted')
    expect(stages.at(-1)).toBe('new')
  })

  it('puts value bands on the right side of their edges', () => {
    expect(inBand(4_999_999, 'under50L')).toBe(true)
    expect(inBand(5_000_000, 'under50L')).toBe(false)
    expect(inBand(5_000_000, 'l50to1Cr')).toBe(true)
    expect(inBand(25_000_000, 'over2Cr')).toBe(true)
  })
})

describe('pipeline: deals from the seed', () => {
  const db = buildSeed(T_NOW)
  const ctx = { properties: db.properties, settings: db.settings, now: T_NOW }
  const deals = buildDeals(db.leads, { properties: db.properties, users: db.users, tasks: db.tasks, settings: db.settings, now: T_NOW, score: (l) => leadScore(l, ctx) })

  it('builds one deal per lead with ageing and a 0–1 prediction', () => {
    expect(deals).toHaveLength(db.leads.length)
    for (const d of deals) {
      expect(d.probability).toBeGreaterThanOrEqual(0)
      expect(d.probability).toBeLessThanOrEqual(1)
      if (d.stalled) expect(d.aging).toBe('danger')
    }
    expect(deals.filter((d) => d.lead.stage === 'lost').every((d) => d.probability === 0)).toBe(true)
  })

  it('has at least one stalled deal in the demo data', () => {
    expect(deals.some((d) => d.stalled)).toBe(true)
  })

  it('column totals add up and shares of the open value sum to 1', () => {
    const stages = boardStages(db.settings)
    const cols = columnSummaries(deals, stages)
    expect(cols.reduce((n, c) => n + c.count, 0)).toBe(deals.length)
    const share = cols.reduce((n, c) => n + c.share, 0)
    expect(share).toBeCloseTo(1, 5)
    expect(cols.find((c) => c.stage === 'lost')?.share).toBe(0)
  })

  it('analytics: reached never grows along the path and conversion + drop-off = 100', () => {
    const stages = boardStages(db.settings)
    const a = stageAnalytics(db.leads, stages, T_NOW)
    const path = a.filter((x) => x.stage !== 'lost')
    for (let i = 1; i < path.length; i++) expect(path[i].reached).toBeLessThanOrEqual(path[i - 1].reached)
    for (const x of path) if (x.conversionPct !== null) expect(x.conversionPct + (x.dropOffPct ?? 0)).toBe(100)
    expect(a.find((x) => x.stage === 'converted')?.conversionPct).toBeNull()
  })
})

describe('pipeline: analytics on a small set', () => {
  it('computes conversion, drop-off and average days per stage', () => {
    const leads = [
      makeLead({ stage: 'contacted', stageSince: ago(2), stageHistory: [{ stage: 'new', at: ago(4), by: 'u' }, { stage: 'contacted', at: ago(2), by: 'u' }] }),
      makeLead({ stage: 'new', stageSince: ago(1), stageHistory: [{ stage: 'new', at: ago(1), by: 'u' }] }),
    ]
    const a = stageAnalytics(leads, ['new', 'contacted', 'qualified', 'lost'], T_NOW)
    const n = a.find((x) => x.stage === 'new')!
    expect(n.reached).toBe(2)
    expect(n.conversionPct).toBe(50)
    expect(n.dropOffPct).toBe(50)
    expect(n.avgDays).toBe(1.5) // 2 days (finished) and 1 day (current)
    expect(a.find((x) => x.stage === 'contacted')!.avgDays).toBe(2)
    expect(a.find((x) => x.stage === 'qualified')!.reached).toBe(0)
    expect(a.find((x) => x.stage === 'lost')!.conversionPct).toBeNull()
  })
})

describe('pipeline: filters and sorting', () => {
  const a = deal({ lead: { name: 'Asha Rao', ownerId: 'u-a', source: 'referral' }, value: 4_000_000, temperature: 'hot', days: 9, stalled: true })
  const b = deal({ lead: { name: 'Bala K', ownerId: null, source: 'website', phone: '+919845012345' }, value: 15_000_000, temperature: 'cold', days: 2 })
  const c = deal({ lead: { name: 'Chitra M', ownerId: 'u-b', source: 'website' }, value: 8_000_000, temperature: 'warm', days: 9 })

  it('filters by owner (including unassigned), source, temperature, value and stalled', () => {
    const f = (p: Partial<typeof EMPTY_FILTERS>) => [a, b, c].filter((d) => matchesDeal(d, { ...EMPTY_FILTERS, ...p })).map((d) => d.lead.name)
    expect(f({ owners: [UNASSIGNED] })).toEqual(['Bala K'])
    expect(f({ sources: ['website'] })).toEqual(['Bala K', 'Chitra M'])
    expect(f({ temperatures: ['hot', 'warm'] })).toEqual(['Asha Rao', 'Chitra M'])
    expect(f({ values: ['l50to1Cr'] })).toEqual(['Chitra M'])
    expect(f({ stalledOnly: true })).toEqual(['Asha Rao'])
    expect(f({ q: 'chit' })).toEqual(['Chitra M'])
    expect(f({ q: '98450' })).toEqual(['Bala K'])
    expect(activeFilterCount({ ...EMPTY_FILTERS, owners: ['x', 'y'], stalledOnly: true })).toBe(3)
  })

  it('orders a column stalled first, then oldest, then biggest', () => {
    expect(sortColumn([b, c, a]).map((d) => d.lead.name)).toEqual(['Asha Rao', 'Chitra M', 'Bala K'])
  })

  it('sorts the list by value and by name', () => {
    expect(sortDeals([a, b, c], { key: 'value', dir: 'desc' }, []).map((d) => d.value)).toEqual([15_000_000, 8_000_000, 4_000_000])
    expect(sortDeals([c, b, a], { key: 'name', dir: 'asc' }, []).map((d) => d.lead.name)).toEqual(['Asha Rao', 'Bala K', 'Chitra M'])
  })

  it('totals: weighted forecast, win rate and stalled count', () => {
    const won = deal({ lead: { stage: 'converted' }, value: 10_000_000 })
    const lost = deal({ lead: { stage: 'lost' }, value: 5_000_000 })
    const t = pipelineTotals([a, b, c, won, lost])
    expect(t.openCount).toBe(3)
    expect(t.openValue).toBe(27_000_000)
    expect(t.weighted).toBe(Math.round(27_000_000 * 0.3))
    expect(t.winRate).toBe(50)
    expect(t.stalled).toBe(1)
  })

  it('buckets dates into weekly counts, oldest first', () => {
    expect(weeklySeries([ago(1), ago(2), ago(8), ago(100), undefined], T_NOW, 4)).toEqual([0, 0, 1, 2])
  })
})
