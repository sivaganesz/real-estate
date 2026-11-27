import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { attentionFor, isMatchable, listingScore, missingRequired, pricePerSqft, priceCheck, propertyCopy } from './property'

const now = new Date('2026-11-27T10:00:00+05:30')
const db = buildSeed(now)
const p1 = db.properties.find((p) => p.id === 'PRP-1001')!

describe('lib/property', () => {
  it('computes price per sq ft from the primary area', () => {
    expect(pricePerSqft(p1)).toBe(Math.round(12_800_000 / 1450))
    expect(pricePerSqft({ ...p1, price: 0 })).toBeNull()
  })

  it('lists smart-required gaps', () => {
    expect(missingRequired(p1)).toEqual([])
    expect(missingRequired({ ...p1, title: '', configuration: undefined, price: 0, location: { city: 'Bengaluru', locality: '' } })).toEqual(['title', 'locality', 'price', 'configuration'])
  })

  it('scores the listing and names what is missing', () => {
    const full = listingScore(p1)
    const bare = listingScore({ ...p1, media: [], amenities: [], approvals: [], rera: undefined })
    expect(full.score).toBeGreaterThan(bare.score)
    expect(bare.missing.map((m) => m.key)).toEqual(expect.arrayContaining(['photos', 'amenities', 'legal']))
  })

  it('booked and sold are not matchable', () => {
    expect(isMatchable({ listing: 'live', status: 'available' })).toBe(true)
    expect(isMatchable({ listing: 'live', status: 'onHold' })).toBe(true)
    expect(isMatchable({ listing: 'live', status: 'booked' })).toBe(false)
    expect(isMatchable({ listing: 'live', status: 'sold' })).toBe(false)
    expect(isMatchable({ listing: 'draft', status: 'available' })).toBe(false)
  })

  it('prices against comparables with registration costs', () => {
    const pc = priceCheck(p1, db, now)
    expect(pc.allIn).toBe(p1.price + pc.costs.total)
    expect(pc.costs.pct).toBe(8)
    if (pc.count) expect(['within', 'below', 'above']).toContain(pc.position)
  })

  it('flags attention items only for live listings', () => {
    expect(attentionFor({ ...p1, listing: 'draft' }, db, now)).toEqual([])
    expect(attentionFor({ ...p1, approvals: [{ authority: 'BBMP', docStatus: 'pending' }] }, db, now).map((a) => a.key)).toContain('docs')
  })

  it('writes listing copy only from facts on the record', () => {
    const c = propertyCopy(p1)
    expect(c.title).toBe('East-facing 3 BHK apartment at Aranya Greens in Whitefield')
    expect(c.description).toContain('Whitefield, Bengaluru')
    expect(c.description).toContain('1,450 sq ft carpet area')
    expect(c.description).toContain('swimming pool')
    expect(c.description).toContain('RERA registered')
    expect(c.facts).toBeGreaterThan(5)
    const bare = propertyCopy({ ...p1, facing: undefined, projectName: undefined, amenities: [], rera: undefined, bankApprovals: [], vastuCompliant: false, parking: { covered: 0, open: 0 }, furnishing: undefined, floor: undefined })
    expect(bare.description).not.toContain('Amenities')
    expect(bare.description).not.toContain('RERA')
    expect(bare.title).toBe('3 BHK apartment in Whitefield')
  })
})
