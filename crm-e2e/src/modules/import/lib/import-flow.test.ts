/// <reference types="node" />
/**
 * End to end over the real sample files in public/samples (made by scripts/make-samples.mjs): read with SheetJS,
 * find the table, map the columns, evaluate the rows, plan the import. Also the runtime templates round-trip.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeLead, makeProperty } from '@/test/factories'
import { SHEET_KINDS } from './fields'
import { autoMap, bestProfile, editDistance, mappingToProfileColumns, missingRequired, normHeader, SKIP_FIELD } from './mapping'
import { failedRowsCsv, planImport } from './plan'
import { autoTitle, commonGaps, evaluateRows, payloadToValues, sameProperty, statusCounts } from './rows'
import { chooseSheet, detectTable, type RawSheet } from './sheet'
import { isDefaultTemplate } from './templates'
import { readWorkbook, templateFile } from './workbook'

const samples = path.resolve(import.meta.dirname, '../../../../public/samples')
const load = (name: string) => readWorkbook(new Uint8Array(readFileSync(path.join(samples, name))), name)
const columnsOf = (t: ReturnType<typeof detectTable>) => t.headers.map((_, c) => t.rows.map((r) => r.cells[c]))
const db = { leads: [makeLead({ id: 'LEAD-1', name: 'Priya Sharma', phone: '+919845123401' })], properties: [makeProperty({ id: 'PRP-1' })] }

describe('mapping basics', () => {
  it('normalises headings and measures spelling distance', () => {
    expect(normHeader('Price (₹)')).toBe('price')
    expect(normHeader('Carpet (sft)')).toBe('carpet sft')
    expect(normHeader('Property name *')).toBe('property name')
    expect(editDistance('locality', 'locallity')).toBe(1)
  })
  it('settles an ambiguous "Area" heading by its values', () => {
    const sizes = autoMap(['Area', 'Rate'], [[1200, 1350], ['85 L', '1.1 Cr']], 'apartments')
    expect(sizes[0].field).toMatch(/^area\./)
    const places = autoMap(['Area', 'Rate'], [['Hebbal', 'Whitefield'], ['85 L', '1.1 Cr']], 'apartments')
    expect(places[0].field).toBe('location.locality')
    expect(places[1]).toMatchObject({ field: 'price', method: 'synonym' })
  })
  it('sniffs values when the heading says nothing', () => {
    const m = autoMap(['Col1', 'Col2'], [['98450 12345', '9880012345'], ['a@b.com', 'c@d.in']], 'leads')
    expect(m.map((x) => [x.field, x.method])).toEqual([['phone', 'value'], ['email', 'value']])
  })
  it('a saved mapping wins and can skip a column', () => {
    const profile = { kind: 'apartments' as const, columns: { Rate: 'price', Junk: SKIP_FIELD } }
    const m = autoMap(['Rate', 'Junk'], [[], []], 'apartments', { profile })
    expect(m[0]).toMatchObject({ field: 'price', method: 'saved' })
    expect(m[1]).toMatchObject({ field: null, method: 'saved' })
    expect(bestProfile([{ ...profile, id: 'x' }], ['Rate', 'Junk', 'Other'], 'apartments')?.id).toBe('x')
    expect(mappingToProfileColumns(m)).toEqual({ Rate: 'price', Junk: SKIP_FIELD })
  })
})

describe('templates', () => {
  for (const kind of SHEET_KINDS) {
    it(`${kind}: the generated .xlsx and .csv map 100% by template and their examples import`, () => {
      for (const type of ['xlsx', 'csv'] as const) {
        const f = templateFile(kind, type)
        const data = typeof f.data === 'string' ? new TextEncoder().encode(f.data) : f.data
        const sheets = readWorkbook(data, f.name)
        const { best, choices } = chooseSheet(sheets, kind)
        if (type === 'xlsx') expect(choices.find((c) => c.name === 'Instructions')?.ignored).toBe(true)
        const table = detectTable(sheets.find((s) => s.name === best)!, kind)
        expect(isDefaultTemplate(table.headers, kind)).toBe(true)
        const mapping = autoMap(table.headers, columnsOf(table), kind)
        expect(mapping.every((m) => m.method === 'template' && m.confidence === 1)).toBe(true)
        const rows = evaluateRows(table, { kind, mapping, db: { leads: [], properties: [] } })
        expect(rows.length).toBeGreaterThanOrEqual(2)
        expect(rows.filter((r) => r.status === 'error')).toEqual([])
      }
    })
  }
})

describe('the messy builder price list (xlsx sample)', () => {
  const sheets = load('builder-price-list-custom.xlsx')
  const { best, choices } = chooseSheet(sheets, 'apartments')
  const table = detectTable(sheets.find((s) => s.name === best)!, 'apartments')
  const mapping = autoMap(table.headers, columnsOf(table), 'apartments')
  const field = (h: string) => mapping.find((m) => m.column === h)?.field

  it('ignores the Instructions and Lists tabs and skips the title, blank and totals rows', () => {
    expect(best).toBe('Price List')
    expect(choices.filter((c) => c.ignored).map((c) => c.name)).toEqual(['Instructions', 'Lists'])
    expect(table.headerRow).toBe(4)
    expect(table.skipped.map((s) => s.reason)).toEqual(['title', 'title', 'blank', 'blank', 'total'])
    expect(table.rows).toHaveLength(9)
  })
  it('maps the custom headings', () => {
    expect(field('Rate')).toBe('price')
    expect(field('SBA')).toBe('area.superBuiltUp')
    expect(field('Carpet (sft)')).toBe('area.carpet')
    expect(field('Unit Type')).toBe('configuration')
    expect(field('Unit No')).toBe('specs.unitNumber')
    expect(field('Locality')).toBe('location.locality')
    expect(field('RERA No')).toBe('rera.number')
    expect(missingRequired(mapping, 'apartments')).toEqual([])
    expect(missingRequired(mapping.filter((m) => m.field !== 'location.locality'), 'apartments')).toEqual(['location.city', 'location.locality'])
  })
  it('reads the values, infers the city, and finds the problems', () => {
    const rows = evaluateRows(table, { kind: 'apartments', mapping, db: { leads: [], properties: [] } })
    const byUnit = (u: string) => rows.find((r) => r.property?.specs.unitNumber === u || r.values['specs.unitNumber'] === u)!
    expect(byUnit('A-101').property).toMatchObject({ price: 8_500_000, floor: 0, facing: 'E', configuration: '2BHK', location: { city: 'Bengaluru', locality: 'Hebbal' } })
    expect(byUnit('A-702').property?.possession).toEqual({ status: 'underConstruction', date: '2027-12-01' })
    expect(byUnit('B-1501').status).toBe('error')
    expect(byUnit('B-1501').issues.map((i) => i.key)).toContain('priceOnRequest')
    expect(byUnit('B-1802').property?.price).toBe(22_638_000)
    expect(byUnit('C-202').status).toBe('draft')
    const repeat = rows.filter((r) => r.values['specs.unitNumber'] === 'A-304')
    expect(repeat.map((r) => r.status)).toEqual(['ready', 'duplicate'])
    expect(repeat[1].duplicate).toMatchObject({ kind: 'row', by: 'unit' })
    expect(byUnit('A-101').property?.description).toContain('Garden facing')
    const c = statusCounts(rows)
    expect(c).toMatchObject({ total: 9, ready: 6, draft: 1, duplicate: 1, error: 1 })
  })
  it('an inline fix and "set for all" re-validate the rows', () => {
    const rows = evaluateRows(table, {
      kind: 'apartments', mapping, db: { leads: [], properties: [] },
      defaults: { 'location.locality': 'Hebbal' },
      edits: { [table.rows.find((r) => r.cells.includes('B-1501'))!.rowNumber]: { price: '1.55 Cr' } },
    })
    expect(statusCounts(rows)).toMatchObject({ ready: 8, draft: 0, error: 0, duplicate: 1 })
  })
  it('plans the import and lists what was not imported', () => {
    const rows = evaluateRows(table, { kind: 'apartments', mapping, db: { leads: [], properties: [] } })
    const plan = planImport(rows, { kind: 'apartments', fileName: 'x.xlsx', duplicates: 'skip', publish: false, skipped: new Set() })
    expect(plan.counts).toMatchObject({ total: 9, imported: 6, drafts: 1, errors: 1, duplicates: 1, skipped: 1 })
    expect(plan.properties.every((p) => p.listing === 'draft')).toBe(true)
    expect(plan.drafts[0]).toMatchObject({ kind: 'property', source: { type: 'import' } })
    const cells = new Map(table.rows.map((r) => [r.rowNumber, r.cells.map((c) => (c == null ? '' : String(c)))]))
    const csv = failedRowsCsv(table.headers, cells, plan.failed, (i) => i.key, (r) => r)
    expect(csv.split('\r\n')[0]).toContain('Problems')
    expect(csv).toContain('priceOnRequest')
    expect(csv).toContain('duplicate')
  })
})

describe('the 99acres lead export (csv sample)', () => {
  const [sheet] = load('leads-99acres-export.csv')
  const table = detectTable(sheet, 'leads')
  const mapping = autoMap(table.headers, columnsOf(table), 'leads')
  it('maps the portal headings and needs a source for all', () => {
    expect(mapping.find((m) => m.column === 'Mobile')?.field).toBe('phone')
    expect(mapping.find((m) => m.column === 'Budget')?.field).toBe('requirement.budgetMax')
    expect(mapping.find((m) => m.column === 'Message')?.field).toBe('notes')
    expect(missingRequired(mapping, 'leads')).toEqual(['source'])
    expect(missingRequired(mapping, 'leads', { source: '99acres' })).toEqual([])
  })
  it('finds the CRM duplicate, the repeat in the file and the bad rows', () => {
    const rows = evaluateRows(table, { kind: 'leads', mapping, db, defaults: { source: '99acres' } })
    const by = (name: string) => rows.filter((r) => r.lead?.name === name)
    expect(by('Priya Sharma')[0].duplicate).toMatchObject({ kind: 'lead', id: 'LEAD-1', by: 'phone' })
    expect(by('Rohit Verma').map((r) => r.status)).toEqual(['ready', 'duplicate'])
    expect(by('Lakshmi Prasad')[0].issues.map((i) => i.key)).toEqual(expect.arrayContaining(['phoneInvalid', 'emailInvalid']))
    expect(rows.find((r) => !r.lead?.name && r.status === 'error')?.issues.map((i) => i.key)).toContain('contactMissing')
    expect(by('Farhan Qureshi')[0].lead).toMatchObject({ phone: '+919885123456', source: 'acres99', requirement: { cities: ['Hyderabad'], budgetMax: 28_000_000, configurations: ['4BHK+'] } })
    expect(by('Vikram Singh')[0].lead?.requirement?.cities).toEqual(['NCR'])
    expect(statusCounts(rows)).toMatchObject({ total: 12, ready: 8, duplicate: 2, error: 2 })
    const plan = planImport(rows, { kind: 'leads', fileName: 'f.csv', duplicates: 'update', publish: true, skipped: new Set() })
    expect(plan.leadUpdates.map((u) => u.id)).toEqual(['LEAD-1'])
    expect(plan.leads).toHaveLength(8)
    expect(plan.leads[0].note).toContain('ITPL')
    expect(commonGaps(rows)).toEqual([])
  })
})

describe('helpers', () => {
  it('property duplicates: same unit in the project, or same locality, type, price ±5% and area ±2%', () => {
    const base = makeProperty({ projectName: 'Lakeview', specs: { unitNumber: 'A-1' } })
    expect(sameProperty({ ...base, price: 1 }, base)).toBe('unit')
    const other = makeProperty({ specs: {}, price: 6_900_000, area: { carpet: 1090 } })
    expect(sameProperty(makeProperty({ specs: {} }), other)).toBe('similar')
    expect(sameProperty(makeProperty({ specs: {} }), { ...other, price: 9_000_000 })).toBeNull()
  })
  it('titles and form values', () => {
    expect(autoTitle({ type: 'apartment', configuration: '3BHK', locality: 'Hebbal' })).toBe('3 BHK Apartment, Hebbal')
    expect(autoTitle({ type: 'plot', projectName: 'Green Valley' })).toBe('Green Valley Plot')
    expect(payloadToValues('property', { price: 12_500_000, area: { superBuiltUp: 1720 }, location: { city: 'Bengaluru' } }))
      .toEqual({ price: '1.25 Cr', 'area.superBuiltUp': '1720', 'location.city': 'Bengaluru' })
  })
  it('a sheet with nothing that looks like headings yields no table', () => {
    const empty: RawSheet = { name: 'S', rows: [[1, 2], [3, 4]] }
    expect(detectTable(empty, 'leads').headers).toEqual([])
  })
})
