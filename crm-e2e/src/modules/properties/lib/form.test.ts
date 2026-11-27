import { describe, expect, it } from 'vitest'
import { extractPropertyFields } from '@/ai/simulated/extract-property'
import { buildSeed } from '@/data/seed'
import { validateProperty } from '@/lib/validation'
import { blankProperty, cleanForSave, changedKeys, familyShows, formPricePerSqft, fromProperty, mergeExtraction, pickExtracted, setPath, suggestTitle } from './form'

const now = new Date('2026-11-27T10:00:00+05:30')

describe('property form model', () => {
  it('shows sections by family', () => {
    expect(familyShows('apartment', 'floor')).toBe(true)
    expect(familyShows('apartment', 'patta')).toBe(false)
    expect(familyShows('villa', 'configuration')).toBe(true)
    expect(familyShows('plot', 'configuration')).toBe(false)
    expect(familyShows('plot', 'roadWidth')).toBe(true)
    expect(familyShows('agriLand', 'possession')).toBe(false)
    expect(familyShows('office', 'floor')).toBe(true)
    expect(familyShows('warehouse', 'rooms')).toBe(false)
  })

  it('fills from the paste-and-fill example and computes ₹ / sq ft', () => {
    const x = extractPropertyFields('2.5BHK 1200 sqft east facing in Kondapur 85 L ready to move', { now })
    const f = mergeExtraction(blankProperty(), x.fields)
    expect(f.configuration).toBe('2.5BHK')
    expect(f.facing).toBe('E')
    expect(f.location.locality).toBe('Kondapur')
    expect(f.location.city).toBe('Hyderabad')
    expect(f.price).toBe(8_500_000)
    expect(f.possession.status).toBe('ready')
    expect(f.area.carpet).toBe(1200)
    expect(formPricePerSqft(f)).toBe(7083)
    expect(validateProperty(cleanForSave(f))).toEqual([])
  })

  it('merges objects and lists instead of replacing what was typed', () => {
    let f = blankProperty()
    f = setPath(f, 'location.address', 'Hagadur Main Road')
    f = { ...f, amenities: ['gym'], approvals: [{ authority: 'BBMP', docStatus: 'verified' }] }
    const out = mergeExtraction(f, { location: { city: 'Bengaluru', locality: 'Whitefield' }, amenities: ['gym', 'lift'], approvals: [{ authority: 'BBMP', docStatus: 'pending' }, { authority: 'BDA', docStatus: 'pending' }] })
    expect(out.location).toEqual({ address: 'Hagadur Main Road', city: 'Bengaluru', locality: 'Whitefield' })
    expect(out.amenities).toEqual(['gym', 'lift'])
    expect(out.approvals.map((a) => `${a.authority}:${a.docStatus}`)).toEqual(['BBMP:verified', 'BDA:pending'])
    expect(f.amenities).toEqual(['gym'])
  })

  it('edits with AI change only what the text mentioned', () => {
    const stored = { ...blankProperty(), purpose: 'rent' as const, title: 'My flat', location: { city: 'Pune', locality: 'Baner' }, price: 45_000 }
    const x = extractPropertyFields('price now 52000 per month, semi furnished', { now })
    const picked = pickExtracted(x.fields, x.meta, ['title'])
    expect(picked.purpose === undefined || picked.purpose === 'rent').toBe(true)
    expect(picked.title).toBeUndefined()
    const out = mergeExtraction(stored, picked)
    expect(out.furnishing).toBe('semi')
    expect(out.location).toEqual({ city: 'Pune', locality: 'Baner' })
    expect(out.title).toBe('My flat')
  })

  it('never blanks a nested value with an empty one', () => {
    const f = { ...blankProperty(), location: { city: 'Pune', locality: 'Baner' } }
    expect(mergeExtraction(f, { location: { city: 'Pune', locality: '' } }).location.locality).toBe('Baner')
  })

  it('setPath creates missing objects and never mutates the input', () => {
    const f = blankProperty()
    const out = setPath(f, 'rera.number', 'PRM/KA/1')
    expect(out.rera).toEqual({ number: 'PRM/KA/1' })
    expect(f.rera).toBeUndefined()
  })

  it('cleans hidden sections, empty rows and stray specs, and suggests a title', () => {
    const f = {
      ...blankProperty('plot'),
      configuration: '3BHK' as const, floor: 2, bedrooms: 3, roadWidthFt: 30, pattaAvailable: true,
      area: { plot: 2400, carpet: 1200 }, price: 6_000_000, location: { city: 'Chennai', locality: 'Tambaram', address: '  ' },
      specs: { roadAccess: 'publicRoad', washrooms: 2, boundaryWall: false },
      owner: { name: '', phone: '', kind: 'owner' as const }, rera: { number: ' ', verified: false },
    }
    const out = cleanForSave(f)
    expect(out.configuration).toBeUndefined()
    expect(out.floor).toBeUndefined()
    expect(out.bedrooms).toBeUndefined()
    expect(out.area).toEqual({ plot: 2400, plotUnit: 'sqft' })
    expect(out.specs).toEqual({ roadAccess: 'publicRoad' })
    expect(out.owner).toBeUndefined()
    expect(out.rera).toBeUndefined()
    expect(out.location.address).toBeUndefined()
    expect(out.roadWidthFt).toBe(30)
    expect(out.title).toBe('Plot, Tambaram')
  })

  it('derives bedrooms from the configuration and drops the date of a ready home', () => {
    const out = cleanForSave({ ...blankProperty(), configuration: '3BHK', possession: { status: 'ready', date: '2027-01-01' }, location: { city: 'Pune', locality: 'Baner' } })
    expect(out.bedrooms).toBe(3)
    expect(out.possession).toEqual({ status: 'ready' })
    expect(out.title).toBe('3 BHK Apartment, Baner')
  })

  it('suggests titles with the project name', () => {
    expect(suggestTitle({ type: 'apartment', configuration: '2BHK', projectName: 'Aranya Greens', location: { city: 'Bengaluru', locality: 'Whitefield' } })).toBe('Aranya Greens 2 BHK, Whitefield')
    expect(suggestTitle({ type: 'office', location: { city: 'Pune', locality: '' } })).toBe('Office, Pune')
  })

  it('round-trips a stored property and lists what changed', () => {
    const db = buildSeed(now)
    const p = db.properties[0]
    const f = fromProperty(p)
    expect('id' in f).toBe(false)
    expect(changedKeys(f, f)).toEqual([])
    expect(changedKeys(f, { ...f, price: f.price + 1 })).toEqual(['price'])
    expect(validateProperty(cleanForSave(f))).toEqual([])
  })
})
