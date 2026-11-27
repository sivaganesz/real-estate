import { describe, expect, it } from 'vitest'
import { guessRecordKind, splitUnits } from './classify'
import { itemsToLines } from './pdf-text'

const BROCHURE = `Prestige Lakeside Habitat
Premium apartments by Prestige Group · Whitefield, Bengaluru
Spread over 12 acres, 2 and 3 BHK apartments with a clubhouse, swimming pool and gym. Ready to move by December 2027.
Unit types and prices
Configuration  Super built-up area  Price
2 BHK  1,265 sq ft  Rs. 98 Lakhs onwards
3 BHK  1,740 sq ft  Rs. 1.45 Cr onwards
RERA No: PRM/KA/RERA/1251/446/PR/171014/002345`

const CARD = `Ramesh Iyer
Senior Manager, Infosys Ltd
Mobile: +91 98450 33221
Email: ramesh.iyer@example.com
Looking for 3 BHK in Whitefield, budget 1.2 Cr, ready to move`

describe('guessRecordKind', () => {
  it('a brochure is a property, a visiting card with a requirement is a lead', () => {
    expect(guessRecordKind(BROCHURE)).toMatchObject({ kind: 'property' })
    expect(guessRecordKind(BROCHURE).confidence).toBeGreaterThan(0.7)
    expect(guessRecordKind(CARD)).toMatchObject({ kind: 'lead' })
    expect(guessRecordKind('Name: Kavitha\nNeed 2 BHK near Porur\nBudget 70 to 80 lakhs').kind).toBe('lead')
    expect(guessRecordKind('hello')).toEqual({ kind: 'lead', confidence: 0.5, signals: [] })
  })
})

describe('splitUnits', () => {
  it('one entry per unit type, each with the shared text and without competing BHK mentions', () => {
    const units = splitUnits(BROCHURE)
    expect(units.map((u) => u.label)).toEqual(['2 BHK  1,265 sq ft  Rs. 98 Lakhs onwards', '3 BHK  1,740 sq ft  Rs. 1.45 Cr onwards'])
    expect(units[1].text).toContain('RERA No')
    expect(units[1].text.match(/bhk/gi)).toHaveLength(1)
  })
  it('a single unit keeps the whole text', () => {
    expect(splitUnits(CARD)).toEqual([{ label: '', text: CARD }])
  })
})

describe('itemsToLines', () => {
  it('groups PDF text items by baseline, top to bottom, left to right', () => {
    expect(itemsToLines([
      { str: '1,265 sq ft', x: 200, y: 500, eol: false }, { str: '2 BHK', x: 50, y: 501, eol: false },
      { str: 'Title', x: 50, y: 700, eol: true }, { str: ' ', x: 0, y: 600, eol: false },
    ])).toEqual(['Title', '2 BHK  1,265 sq ft'])
  })
})
