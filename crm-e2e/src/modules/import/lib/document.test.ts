import { describe, expect, it } from 'vitest'
import { checkEntry, entryDraft, entryFromExtraction, isUncertain, prepareText, refineProperty } from './document'
import { draftConfidence, importStats, lowFields, visibleDrafts, visibleJobs } from './stats'
import type { Draft, ImportJob } from '@/domain/types'

describe('document entries', () => {
  it('a complete property extraction can be saved; OCR doubt lowers confidence and makes it uncertain', () => {
    const fields = { title: 'Lakeside 3 BHK', type: 'apartment', configuration: '3BHK', location: { city: 'Bengaluru', locality: 'Whitefield' }, price: 14_500_000, area: { superBuiltUp: 1740 } }
    const meta = { price: { origin: 'ai' as const, confidence: 0.9 }, configuration: { origin: 'ai' as const, confidence: 0.95 } }
    const clean = entryFromExtraction('property', fields, meta)
    expect(clean.values).toMatchObject({ price: '1.45 Cr', 'area.superBuiltUp': '1740', configuration: '3BHK' })
    const c = checkEntry('property', clean)
    expect(c.complete).toBe(true)
    expect(c.property).toMatchObject({ price: 14_500_000, area: { superBuiltUp: 1740 }, location: { city: 'Bengaluru' } })
    expect(isUncertain(c)).toBe(false)
    const ocr = entryFromExtraction('property', fields, meta, { ocrConfidence: 0.5 })
    expect(ocr.meta.price.confidence).toBeCloseTo(0.63)
    expect(isUncertain(checkEntry('property', ocr), 0.5)).toBe(true)
  })
  it('a lead without a source or phone is incomplete and becomes a draft with its note', () => {
    const e = entryFromExtraction('lead', { name: 'Kavitha Suresh', requirement: { localities: ['Porur'], cities: ['Chennai'], configurations: ['2BHK'], budgetMax: 8_000_000 } },
      { name: { origin: 'ai', confidence: 0.6 } }, { sourceText: 'Name: Kavitha Suresh\nNeed 2 BHK near Porur' })
    expect(e.values.notes).toContain('Porur')
    const c = checkEntry('lead', e)
    expect(c.complete).toBe(false)
    expect(c.blocking.map((i) => i.key)).toEqual(expect.arrayContaining(['sourceMissing', 'contactMissing']))
    expect(c.low).toEqual(['name'])
    const d = entryDraft('lead', e, c, { type: 'image', fileName: 'note.jpg' }, 'Untitled')
    expect(d).toMatchObject({ kind: 'lead', title: 'Kavitha Suresh', source: { type: 'image' } })
    expect((d.payload as { requirement: { budgetMax: number } }).requirement.budgetMax).toBe(8_000_000)
  })
})

describe('stats', () => {
  const iso = (d: number) => new Date(2026, 10, 27 - d, 10).toISOString()
  const job = (p: Partial<ImportJob>): ImportJob => ({
    id: 'IMP-1', kind: 'leads', fileName: 'f.csv', fileType: 'csv', template: 'default', createdBy: 'u1', createdAt: iso(1), status: 'completed',
    counts: { total: 10, imported: 8, updated: 0, skipped: 1, duplicates: 1, errors: 1, drafts: 0 }, createdIds: [], draftIds: [], errorRows: [], ...p,
  })
  const draft = (p: Partial<Draft>): Draft => ({
    id: 'D1', kind: 'lead', title: 'x', payload: {}, fieldMeta: {}, source: { type: 'pdf' }, createdBy: 'u1', createdAt: iso(0), updatedAt: iso(0), status: 'open', ...p,
  })
  it('counts the last 30 days and the drafts that need a look', () => {
    const jobs = [job({}), job({ id: 'IMP-2', kind: 'apartments', createdBy: 'u2', createdAt: iso(40) })]
    const drafts = [draft({ fieldMeta: { price: { origin: 'import', confidence: 0.4 } } }), draft({ id: 'D2' }), draft({ id: 'D3', status: 'saved' })]
    const s = importStats(jobs, drafts, new Date(2026, 10, 27, 12))
    expect(s).toMatchObject({ jobs30: 1, rows30: 10, created30: 8, duplicates30: 1, openDrafts: 2, lowDrafts: 1, draftsLowShare: 50 })
    expect(s.spark).toHaveLength(14)
    expect(s.spark[12]).toBe(8)
    expect(visibleJobs(jobs, 'u3', false).map((j) => j.id)).toEqual(['IMP-1'])
    expect(visibleDrafts(drafts, 'u9', false)).toEqual([])
    expect(lowFields({ a: { origin: 'ai', confidence: 0.5 }, b: { origin: 'ai', confidence: 0.9 } })).toEqual(['a'])
    expect(draftConfidence({ a: { origin: 'ai', confidence: 0.5 }, b: { origin: 'manual' } })).toBe(0.5)
  })
})

describe('document refinements', () => {
  it('prepareText marks a leading name and drops OCR blank lines', () => {
    expect(prepareText('Ramesh lyer\n\nSenior Manager\n\nMobile: 98450 33221')).toBe('Name: Ramesh lyer.\nSenior Manager\nMobile: 98450 33221')
    expect(prepareText('Name: Kavitha\nNeed 2 BHK')).toBe('Name: Kavitha\nNeed 2 BHK')
    expect(prepareText('Looking for a 3 BHK flat')).toBe('Looking for a 3 BHK flat')
  })
  it('refineProperty reads the unit row, fixes the type and finds project and possession date', () => {
    const text = 'Prestige Lakeside Habitat\nReady to move by December 2027.\nConfiguration  Super built-up area  Price\n2 BHK  1,265 sq ft  Rs. 98 Lakhs onwards\nSite office'
    const e = refineProperty({ label: '', values: { type: 'office', title: 'Office in Whitefield', 'area.carpet': '1265' }, meta: { title: { origin: 'ai', confidence: 0.6 }, 'area.carpet': { origin: 'ai', confidence: 0.6 } } },
      text, { line: '2 BHK  1,265 sq ft  Rs. 98 Lakhs onwards', header: 'Configuration  Super built-up area  Price' })
    expect(e.values).toMatchObject({
      configuration: '2BHK', type: 'apartment', 'area.superBuiltUp': '1265', price: '98 L', projectName: 'Prestige Lakeside Habitat',
      'possession.status': 'underConstruction', 'possession.date': '2027-12-01', title: 'Prestige Lakeside Habitat 2 BHK',
    })
    expect(e.values['area.carpet']).toBeUndefined()
  })
})
