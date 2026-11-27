import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { buildSeed } from '@/data/seed'
import { visible } from '@/services/queries/visibility'
import { T_NOW, makeLead, makeProperty, settingsWith } from '@/test/factories'
import {
  MATCH_PARTS, bestMatchesToday, closeOnBudget, excludedForLead, leadsForProperty, matchScore, propertiesForLead, reasonText, summaryLine,
} from './matching'
import { shareMessage } from './whatsapp'

const t = i18n.getFixedT('en')
const S = settingsWith()
const texts = (m: ReturnType<typeof matchScore>) => m.reasons.map((r) => reasonText(r, t))
const base = makeProperty()

// ── Ported from origin/feat/estate-platform apps/api/test/matching.test.ts (scoreMatch cases) ──
describe('property matching (estate-platform cases)', () => {
  it('explains a fit in plain reasons and labels it', () => {
    const lead = makeLead({ requirement: { propertyTypes: ['apartment'], configurations: ['2BHK'], budgetMax: 7_500_000, localities: ['Porur'], mustHaves: ['Lift', 'East facing'] } })
    const m = matchScore(lead, { ...base, price: 6_800_000 }, S, T_NOW)
    expect(m.label).toBe('strong')
    expect(texts(m)).toEqual(expect.arrayContaining(['₹68 L, within budget (up to ₹75 L)', 'In Porur, a preferred area', '2 BHK as wanted', 'Lift', 'East facing']))
  })

  it('says how far over budget, and drops what is way over, wrong type, sold or rejected', () => {
    const over = matchScore(makeLead({ requirement: { propertyTypes: ['apartment'], budgetMax: 6_500_000, localities: ['Porur'] } }), { ...base, price: 6_900_000 }, S, T_NOW)
    expect(over.excluded).toBe(false)
    expect(reasonText(over.reasons.find((r) => r.ok === null)!, t)).toMatch(/₹4 L over budget \(6%\)/)
    expect(matchScore(makeLead({ requirement: { budgetMax: 5_000_000 } }), { ...base, price: 6_900_000 }, S, T_NOW).excluded).toBe(true)
    expect(matchScore(makeLead({ requirement: { propertyTypes: ['plot'] } }), { ...base, price: 1 }, S, T_NOW).excluded).toBe(true)
    expect(matchScore(makeLead(), { ...base, status: 'sold' }, S, T_NOW).excluded).toBe(true)
    const rejected = makeLead({ shortlist: [{ propertyId: 'p1', status: 'notInterested', at: T_NOW.toISOString(), by: 'u-arjun' }] })
    expect(matchScore(rejected, { ...base, price: 6_000_000 }, S, T_NOW).excluded).toBe(true)
    const fewer = matchScore(makeLead({ requirement: { configurations: ['3BHK'] } }), { ...base, price: 6_000_000 }, S, T_NOW)
    expect(fewer.excluded).toBe(true)
    expect(fewer.reasons[0].key).toBe('fail.bedrooms')
  })

  it('finds properties for a customer, best first, without a project flooding the list', () => {
    const lead = makeLead({ requirement: { propertyTypes: ['apartment'], configurations: ['2BHK'], budgetMax: 7_500_000, cities: ['Chennai'], localities: ['Porur'] } })
    const props = [
      ...[1, 2, 3, 4].map((i) => makeProperty({ id: `lv${i}`, projectName: 'Lakeview', price: 6_500_000 + i * 100_000 })),
      makeProperty({ id: 'o1', projectName: 'Orchid', price: 7_000_000 }),
      makeProperty({ id: 'o2', projectName: 'Palm Grove', price: 7_200_000, location: { city: 'Chennai', locality: 'OMR' } }),
      makeProperty({ id: 'pl', type: 'plot', configuration: undefined, price: 3_000_000 }),
    ]
    const list = propertiesForLead(lead, props, S, T_NOW)
    expect(list.length).toBeGreaterThan(1)
    expect(list[0].label).not.toBe('weak')
    for (const m of list) {
      expect(m.property.type).toBe('apartment')
      expect(m.property.price).toBeLessThanOrEqual(7_500_000 * 1.2)
    }
    const perProject = new Map<string, number>()
    for (const m of list) if (m.property.projectName) perProject.set(m.property.projectName, (perProject.get(m.property.projectName) ?? 0) + 1)
    expect(Math.max(...perProject.values())).toBeLessThanOrEqual(S.matching.perProjectCap)
    for (let i = 1; i < list.length; i++) {
      if (list[i - 1].label !== 'conditional' && list[i].label !== 'conditional') expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score)
    }
  })

  it('finds buyers for a property, only among the customers you can see', () => {
    const db = buildSeed(T_NOW)
    const manager = db.users.find((u) => u.id === 'u-rohit')!
    const arjun = db.users.find((u) => u.id === 'u-arjun')!
    const counts = db.properties.map((p) => ({ p, n: leadsForProperty(p, visible.leads(db, manager), db.settings, T_NOW).length }))
    const popular = counts.sort((a, b) => b.n - a.n)[0]
    expect(popular.n).toBeGreaterThan(0)
    const mine = leadsForProperty(popular.p, visible.leads(db, arjun), db.settings, T_NOW)
    expect(mine.every((m) => m.lead.ownerId === 'u-arjun')).toBe(true)
  })

  it('remembers the shortlist: rejected never comes back, shared says when, and the share message reads naturally', () => {
    const two = new Date(T_NOW.getTime() - 2 * 86_400_000).toISOString()
    const lead = makeLead({
      name: 'Mohammed Irfan',
      requirement: { propertyTypes: ['apartment'], budgetMax: 7_500_000, cities: ['Chennai'] },
      shortlist: [
        { propertyId: 'a', status: 'notInterested', at: two, by: 'u-arjun' },
        { propertyId: 'b', status: 'shared', at: two, by: 'u-arjun' },
      ],
    })
    const props = [makeProperty({ id: 'a' }), makeProperty({ id: 'b', price: 7_000_000 })]
    const ids = propertiesForLead(lead, props, S, T_NOW).map((m) => m.property.id)
    expect(ids).not.toContain('a')
    const b = propertiesForLead(lead, props, S, T_NOW).find((m) => m.property.id === 'b')!
    expect(texts(b).some((x) => /Already shared 2 days ago/.test(x))).toBe(true)
    expect(propertiesForLead(lead, props, S, T_NOW, { includeShared: false })).toHaveLength(0)
    expect(shareMessage(lead, props)).toMatch(/^Hi Mohammed, as discussed, here are 2 options/)
  })

  it('suggests fresh best matches for Today, and explains a match in one line', () => {
    const db = buildSeed(T_NOW)
    const arjun = db.users.find((u) => u.id === 'u-arjun')!
    const today = bestMatchesToday(db, arjun, T_NOW)
    expect(today.length).toBeGreaterThan(0)
    for (const m of today) {
      expect(['strong', 'good']).toContain(m.label)
      expect(m.memory === undefined || m.memory === 'suggested').toBe(true)
    }
    const lead = makeLead({ requirement: { propertyTypes: ['apartment'], budgetMax: 7_500_000, localities: ['Porur'], parking: 'required' } })
    const line = summaryLine(matchScore(lead, makeProperty({ parking: { covered: 0, open: 1 } }), S, T_NOW), t)
    expect(line).toMatch(/within budget/)
    expect(line).toMatch(/Gaps: No covered parking/)
  })
})

// ── Rebuild rules (wireframe-rebuild/src/lib/matching.ts) ──
describe('property matching (rebuild rules)', () => {
  const lead = makeLead({ requirement: { propertyTypes: ['apartment'], configurations: ['2BHK'], budgetMax: 10_000_000, cities: ['Chennai'] } })

  it('weights add up to 1 and the score is the weighted sum of the parts', () => {
    const w = S.matching.weights
    expect(w.budget + w.location + w.size + w.amenities + w.preferences).toBeCloseTo(1, 5)
    const m = matchScore(lead, base, S, T_NOW)
    const sum = MATCH_PARTS.reduce((n, p) => n + w[p] * m.parts[p], 0)
    expect(Math.abs(m.score - sum)).toBeLessThanOrEqual(1)
  })

  it('is conditional when an approval document is pending', () => {
    const m = matchScore(lead, makeProperty({ approvals: [{ authority: 'CMDA', docStatus: 'pending' }] }), S, T_NOW)
    expect(m.label).toBe('conditional')
    expect(texts(m)).toContain('CMDA claimed; document pending')
  })

  it('flags a budget mismatch within 15% as worth a call, and excludes far over', () => {
    const mk = (price: number) => makeProperty({ price })
    // ceiling = 1 Cr × 1.10 = 1.1 Cr
    expect(matchScore(lead, mk(12_000_000), S, T_NOW).label).toBe('budgetMismatch')
    expect(closeOnBudget(mk(12_000_000), [lead], S, T_NOW)).toHaveLength(1)
    expect(matchScore(lead, mk(13_000_000), S, T_NOW).label).toBe('budgetMismatch')
    expect(closeOnBudget(mk(13_000_000), [lead], S, T_NOW)).toHaveLength(0)
    expect(matchScore(lead, mk(14_000_000), S, T_NOW).excluded).toBe(true)
    expect(propertiesForLead(lead, [mk(12_000_000)], S, T_NOW)).toHaveLength(0)
    expect(excludedForLead(lead, [mk(14_000_000), mk(12_000_000)], S, T_NOW)[0].label).toBe('budgetMismatch')
  })

  it('never offers booked or sold properties, in either direction', () => {
    for (const status of ['booked', 'sold'] as const) {
      const p = makeProperty({ status })
      expect(propertiesForLead(lead, [p], S, T_NOW)).toHaveLength(0)
      expect(leadsForProperty(p, [lead], S, T_NOW)).toHaveLength(0)
      expect(closeOnBudget(p, [lead], S, T_NOW)).toHaveLength(0)
    }
    expect(leadsForProperty(base, [lead], S, T_NOW)).toHaveLength(1)
    const held = matchScore(lead, makeProperty({ status: 'onHold' }), S, T_NOW)
    expect(held.excluded).toBe(false)
    expect(held.score).toBeLessThan(matchScore(lead, base, S, T_NOW).score)
  })

  it('changing the weights in settings changes the order', () => {
    const l = makeLead({ requirement: { propertyTypes: ['apartment'], budgetPreferred: 6_000_000, budgetMax: 8_000_000, cities: ['Bengaluru'], localities: ['Whitefield'] } })
    const inArea = makeProperty({ id: 'wf', price: 7_800_000, location: { city: 'Bengaluru', locality: 'Whitefield' } })
    const cheaper = makeProperty({ id: 'hb', price: 6_000_000, location: { city: 'Bengaluru', locality: 'Hebbal' } })
    const order = (weights: typeof S.matching.weights) =>
      propertiesForLead(l, [inArea, cheaper], settingsWith({ weights, minScore: 0 }), T_NOW).map((m) => m.property.id)
    expect(order({ budget: 0.1, location: 0.6, size: 0.1, amenities: 0.1, preferences: 0.1 })).toEqual(['wf', 'hb'])
    expect(order({ budget: 0.6, location: 0.1, size: 0.1, amenities: 0.1, preferences: 0.1 })).toEqual(['hb', 'wf'])
  })

  it('hides matches below the minimum score but lists them under "not shown"', () => {
    const strict = settingsWith({ minScore: 99 })
    expect(propertiesForLead(lead, [base], strict, T_NOW)).toHaveLength(0)
    expect(excludedForLead(lead, [base], strict, T_NOW)).toHaveLength(1)
  })

  it('every reason key has an English and Tamil text', () => {
    const db = buildSeed(T_NOW)
    const keys = new Set<string>()
    for (const l of db.leads) for (const p of db.properties) for (const r of matchScore(l, p, db.settings, T_NOW).reasons) keys.add(r.key)
    for (const k of keys) {
      expect(i18n.exists(`matching:reason.${k}`, { lng: 'en' }), k).toBe(true)
      expect(i18n.exists(`matching:reason.${k}`, { lng: 'ta' }), k).toBe(true)
    }
  })
})
