import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { T_NOW, makeLead } from '@/test/factories'
import { findDuplicates } from './duplicates'
import { missingRequired, pricePerSqft, primaryAreaSqft } from './property'
import { applyPropertyFilters, parsePropertyQuery, relaxFor } from './search'
import { agingTone } from './stalled'
import { validateLead, validateStageMove } from './validation'

describe('plain-words property search', () => {
  it('reads "3BHK Whitefield under 1.2 Cr ready to move east facing"', () => {
    const f = parsePropertyQuery('3BHK Whitefield under 1.2 Cr ready to move east facing')
    expect(f).toMatchObject({ configurations: ['3BHK'], localities: ['Whitefield'], cities: ['Bengaluru'], maxPrice: 12_000_000, possession: 'ready', facing: ['E'], types: ['apartment'] })
    expect(f.text).toBeUndefined()
  })

  it('reads areas, ranges, types and statuses', () => {
    expect(parsePropertyQuery('plots in Yelahanka between 40 and 60 lakh')).toMatchObject({ types: ['plot'], minPrice: 4_000_000, maxPrice: 6_000_000, localities: ['Yelahanka'] })
    expect(parsePropertyQuery('villa above 1500 sqft with swimming pool')).toMatchObject({ types: ['villa'], minArea: 1500, amenities: ['swimmingPool'] })
    expect(parsePropertyQuery('office for rent in Gachibowli')).toMatchObject({ types: ['office'], purpose: 'rent', localities: ['Gachibowli'] })
    expect(parsePropertyQuery('sold flats in bangalore')).toMatchObject({ statuses: ['sold'], cities: ['Bengaluru'], types: ['apartment'] })
  })

  it('filters the seed and suggests what to relax when nothing is found', () => {
    const db = buildSeed(T_NOW)
    const hits = applyPropertyFilters(db.properties, parsePropertyQuery('apartments in Bengaluru'))
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((p) => p.type === 'apartment' && p.location.city === 'Bengaluru')).toBe(true)
    const none = parsePropertyQuery('3BHK Whitefield under 10 lakh')
    expect(applyPropertyFilters(db.properties, none)).toHaveLength(0)
    expect(relaxFor(db.properties, none)?.drop).toEqual(['price'])
  })
})

describe('property, duplicates, aging, validation', () => {
  it('works out the primary area, price per sq ft and smart-required fields', () => {
    const db = buildSeed(T_NOW)
    const flat = db.properties.find((p) => p.id === 'PRP-1001')!
    expect(primaryAreaSqft(flat)).toBe(1450)
    expect(pricePerSqft(flat)).toBe(Math.round(12_800_000 / 1450))
    expect(missingRequired(flat)).toEqual([])
    expect(missingRequired({ ...flat, price: 0, location: { ...flat.location, locality: '' } })).toEqual(['locality', 'price'])
  })

  it('finds duplicates by the last 10 digits or email', () => {
    const db = { leads: [makeLead({ id: 'A', phone: '+919845098765', email: 'x@example.com' })] }
    expect(findDuplicates(db, { phone: '098450 98765' })).toHaveLength(1)
    expect(findDuplicates(db, { email: 'X@Example.com' })[0].by).toBe('email')
    expect(findDuplicates(db, { phone: '9845098765', excludeId: 'A' })).toHaveLength(0)
  })

  it('ages deals: muted below target, warning to 2×, danger beyond', () => {
    expect(agingTone(2, 5)).toBe('muted')
    expect(agingTone(5, 5)).toBe('warning')
    expect(agingTone(11, 5)).toBe('danger')
  })

  it('validates smart-required lead fields and stage moves', () => {
    expect(validateLead({ name: 'A', source: 'phone', phone: '9845012345' })).toEqual([])
    expect(validateLead({ name: '', source: 'phone' }).map((e) => e.key)).toEqual(['required', 'phoneOrEmail'])
    expect(validateLead({ name: 'A', source: 'phone', phone: '123' })[0].key).toBe('invalidPhone')
    expect(validateStageMove('lost', {})[0].key).toBe('lostReasonRequired')
    expect(validateStageMove('booked', { propertyId: 'P' })[0].key).toBe('bookingAmountRequired')
  })
})
