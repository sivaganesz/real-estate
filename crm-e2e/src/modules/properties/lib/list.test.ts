import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { EMPTY_PROPERTY_FILTERS, parsePropertyQuery } from '@/lib/search'
import { EMPTY_PILLS, combineFilters, filterList, groupByLocality, inTab, pillCount, propertyCsvColumns, tabCounts, toCsv, weeklyAdds, withoutCriterion } from './list'

const now = new Date('2026-11-27T10:00:00+05:30')
const db = buildSeed(now)

describe('properties list', () => {
  it('counts tabs; archived stays out of All', () => {
    const counts = tabCounts(db.properties)
    expect(counts.available + counts.onHold + counts.booked + counts.sold).toBeGreaterThanOrEqual(counts.all)
    expect(counts.all).toBe(db.properties.filter((p) => p.listing !== 'archived').length)
    expect(inTab({ status: 'available', listing: 'archived' }, 'all')).toBe(false)
    expect(inTab({ status: 'available', listing: 'archived' }, 'archived')).toBe(true)
    expect(inTab({ status: 'sold', listing: 'live' }, 'sold')).toBe(true)
  })

  it('combines pills with the sentence; the budget pill wins', () => {
    const parsed = parsePropertyQuery('3bhk whitefield under 1.5 cr')
    const f = combineFilters({ ...EMPTY_PILLS, types: ['villa'], budget: '50to100' }, parsed)
    expect(f.types.sort()).toEqual(['apartment', 'villa'])
    expect(f.localities).toEqual(['Whitefield'])
    expect(f.maxPrice).toBe(10_000_000)
    expect(f.minPrice).toBe(5_000_000)
    expect(pillCount({ ...EMPTY_PILLS, types: ['villa'], budget: '50to100' })).toBe(2)
  })

  it('drops one criterion', () => {
    const parsed = parsePropertyQuery('3bhk whitefield under 1.5 cr gym')
    expect(withoutCriterion(parsed, 'price').maxPrice).toBeUndefined()
    expect(withoutCriterion(parsed, 'city').localities).toEqual([])
    expect(withoutCriterion(parsed, 'amenity:gym').amenities).toEqual([])
    expect(withoutCriterion(parsed, 'configuration').configurations).toEqual([])
  })

  it('filters by the tab after the filters', () => {
    const { inFilters, shown } = filterList(db.properties, { ...EMPTY_PROPERTY_FILTERS, cities: ['Bengaluru'] }, 'available')
    expect(inFilters.every((p) => p.location.city === 'Bengaluru')).toBe(true)
    expect(shown.every((p) => p.status === 'available' && p.location.city === 'Bengaluru')).toBe(true)
  })

  it('groups by locality with counts, price range and status split', () => {
    const groups = groupByLocality(db.properties)
    expect(groups.reduce((n, g) => n + g.properties.length, 0)).toBe(db.properties.length)
    for (const g of groups) {
      expect(g.minPrice).toBeLessThanOrEqual(g.maxPrice)
      expect(Object.values(g.byStatus).reduce((a, b) => a + b, 0)).toBe(g.properties.length)
    }
    expect(groups[0].properties.length).toBeGreaterThanOrEqual(groups[groups.length - 1].properties.length)
  })

  it('counts weekly adds oldest first', () => {
    const w = weeklyAdds([{ createdAt: now.toISOString() }, { createdAt: new Date(now.getTime() - 8 * 86_400_000).toISOString() }], now, 4)
    expect(w).toEqual([0, 0, 1, 1])
  })

  it('writes CSV with quoting', () => {
    const p = { ...db.properties[0], title: 'Aranya "Greens", 3 BHK' }
    const cols = propertyCsvColumns((k) => k, { type: (x) => x.type, status: (x) => x.status })
    const csv = toCsv([p], cols)
    const [head, row] = csv.split('\r\n')
    expect(head.startsWith('id,title,type')).toBe(true)
    expect(row).toContain('"Aranya ""Greens"", 3 BHK"')
  })
})
