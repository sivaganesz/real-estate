/**
 * One sheet row → a lead or property ready for the services, with every problem found (master prompt §15.1:
 * required fields, formats, price/area sanity, duplicates). Each row ends in one state:
 *   ready     → imported as is;
 *   draft     → a key fact is missing (a property with no price or area): kept as a Draft to finish later;
 *   duplicate → already in the CRM, or an earlier row of the same file (skip or update on import);
 *   error     → a value cannot be read ("Call" as a price, a 5-digit phone): fix it inline, set it for all, or skip.
 * Nothing is dropped: unmapped columns are kept in the property description or the lead's note.
 * Pure; unit-tested.
 */
import type {
  ColumnMapping, Configuration, DB, Facing, FieldMetaMap, ID, LeadInput, LeadSource, PropertyInput, PropertyType, Requirement, Timeline,
} from '@/domain/types'
import { CONFIGURATION_BEDROOMS, PROPERTY_TYPES } from '@/domain/catalogue'
import { findDuplicates } from '@/lib/duplicates'
import { last10 } from '@/lib/phone'
import { DEFAULT_TYPE, KIND_TYPES, fieldDef, type SheetKind } from './fields'
import type { Table } from './sheet'
import {
  cellText, cityOfLocality, isBlank, isOk, readArea, readCity, readConfig, readConfigs, readDate, readDimensions, readEmail,
  readFacing, readFurnishing, readInt, readLocality, readPhone, readPossession, readPrice, readPropertyType, readPropertyTypes,
  readSource, readTimeline, readTransaction, splitList, type Cell, type Read,
} from './values'

export type IssueLevel = 'error' | 'missing' | 'warning'
export type Issue = { field: string; key: string; level: IssueLevel; params?: Record<string, string | number> }
export type RowStatus = 'ready' | 'draft' | 'duplicate' | 'error'
export type DuplicateRef = { kind: 'lead' | 'property'; id: ID; name: string; by: 'phone' | 'email' | 'unit' | 'similar' } | { kind: 'row'; row: number; by: 'phone' | 'email' | 'unit' | 'similar' }

/** A lead as the import service takes it (+ the note made from remarks and unmapped columns). */
export type LeadRecord = Pick<LeadInput, 'name' | 'source'> & Partial<LeadInput> & { note?: string }

export type EvaluatedRow = {
  rowNumber: number
  status: RowStatus
  issues: Issue[]
  /** The effective value per field (after "set for all" and inline fixes), as text: what the fix form edits. */
  values: Record<string, string>
  label: string
  lead?: LeadRecord
  property?: PropertyInput
  meta: FieldMetaMap
  duplicate?: DuplicateRef
  /** Unmapped columns with a value (kept, never dropped). */
  extras: { column: string; value: string }[]
}

export type RowContext = {
  kind: SheetKind
  mapping: ColumnMapping[]
  /** "Set for all": used where a row has no value for that field. */
  defaults?: Record<string, string>
  /** Inline fixes per row number: field → value. */
  edits?: Record<number, Record<string, string>>
  db: Pick<DB, 'leads' | 'properties'>
}

// ── helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const emptyRequirement = (): Requirement => ({
  propertyTypes: [], configurations: [], cities: [], localities: [], budgetFlexPct: 10, possession: 'any', facing: [],
  amenities: [], mustHaves: [], purpose: 'sale',
})

const TYPE_LABEL: Record<PropertyType, string> = {
  apartment: 'Apartment', villa: 'Villa', independentHouse: 'Independent House', rowHouse: 'Row House', plot: 'Plot',
  agriLand: 'Agricultural Land', office: 'Office', shop: 'Shop', showroom: 'Showroom', warehouse: 'Warehouse', coworking: 'Co-working Space',
}
const configText = (c: Configuration) => c.replace(/^(\d(?:\.5)?)BHK(\+?)$/, '$1$2 BHK')

/** A title for a listing that has none: "Lakeview Residency 3 BHK", "3 BHK Apartment, Hebbal", "Plot, Tambaram". */
export function autoTitle(p: { type: PropertyType; configuration?: Configuration; projectName?: string; locality?: string }): string {
  const what = [p.configuration ? configText(p.configuration) : '', p.configuration && p.projectName ? '' : TYPE_LABEL[p.type]].filter(Boolean).join(' ')
  if (p.projectName) return `${p.projectName} ${what}`.trim()
  return p.locality ? `${what}, ${p.locality}` : what
}

/** The sheet kind a record of this type belongs to (documents and drafts). */
export function kindForType(type: PropertyType | undefined): Exclude<SheetKind, 'leads'> {
  if (!type) return 'apartments'
  return (Object.keys(KIND_TYPES) as Exclude<SheetKind, 'leads'>[]).find((k) => KIND_TYPES[k].includes(type)) ?? 'apartments'
}

/** Rupees per sq ft outside these bands is worth a second look (asking prices in Indian metros). */
const PSF_BAND: Record<'built' | 'land', [number, number]> = { built: [1500, 60000], land: [150, 60000] }

const set = (obj: Record<string, unknown>, path: string, value: unknown) => {
  const parts = path.split('.')
  let o = obj
  for (const p of parts.slice(0, -1)) o = (o[p] ??= {}) as Record<string, unknown>
  o[parts[parts.length - 1]] = value
}

// ── one record from field values ───────────────────────────────────────────────────────────────────────────────────
type Built<T> = { record: T; issues: Issue[]; extrasNote?: string }

/** Reads each field; collects issues. `meta` gets an import marker per field that was read. */
function reader(values: Record<string, Cell>, issues: Issue[]) {
  return <T,>(field: string, read: (v: Cell) => Read<T>, opts: { required?: boolean; missingKey?: string } = {}): T | undefined => {
    const v = values[field]
    if (isBlank(v)) {
      if (opts.required) issues.push({ field, key: opts.missingKey ?? 'missing', level: 'missing' })
      return undefined
    }
    const r = read(v)
    if (isOk(r)) {
      if (r.warn) issues.push({ field, key: r.warn, level: 'warning', params: { value: cellText(v) } })
      return r.ok
    }
    issues.push({ field, key: r.issue === 'missing' ? 'valueInvalid' : r.issue, level: 'error', params: { value: cellText(v), ...r.params } })
    return undefined
  }
}

export function buildLead(values: Record<string, Cell>): Built<LeadRecord> {
  const issues: Issue[] = []
  const read = reader(values, issues)
  const name = cellText(values.name)
  const phone = read('phone', readPhone)
  const email = read('email', readEmail)
  const altPhone = read('altPhone', readPhone)
  const source = read('source', readSource, { required: true, missingKey: 'sourceMissing' })
  if (!name) issues.push({ field: 'name', key: 'nameMissing', level: 'missing' })
  if (isBlank(values.phone) && isBlank(values.email)) issues.push({ field: 'phone', key: 'contactMissing', level: 'error' })
  const r = emptyRequirement()
  const localities = isBlank(values['requirement.localities']) ? [] : splitList(values['requirement.localities']).map((l) => { const x = readLocality(l); return isOk(x) ? x.ok : l })
  const cities = isBlank(values['requirement.cities']) ? [] : splitList(values['requirement.cities']).map((c) => { const x = readCity(c); return isOk(x) ? x.ok : c })
  if (!cities.length) for (const l of localities) { const c = cityOfLocality(l); if (c && !cities.includes(c)) cities.push(c) }
  r.cities = [...new Set(cities)]
  r.localities = localities
  r.propertyTypes = read('requirement.propertyTypes', readPropertyTypes) ?? []
  r.configurations = read('requirement.configurations', readConfigs) ?? []
  r.budgetMin = read('requirement.budgetMin', (v) => readPrice(v))
  r.budgetMax = read('requirement.budgetMax', (v) => readPrice(v))
  if (r.budgetMin && r.budgetMax && r.budgetMin > r.budgetMax) issues.push({ field: 'requirement.budgetMin', key: 'budgetOrder', level: 'error' })
  const timeline: Timeline | undefined = read('qualification.timeline', readTimeline)
  const enquired = read('enquiredAt', readDate)
  // the enquiry date only tags a message: a row with an empty notes cell adds no note
  const message = cellText(values.notes)
  const notes = message ? [enquired ? `[${enquired}]` : '', message].filter(Boolean).join(' ') : ''
  const record: LeadRecord = {
    name, source: source ?? ('' as LeadSource), isNri: false, ownerId: null,
    ...(phone ? { phone } : {}), ...(email ? { email } : {}), ...(altPhone ? { altPhone } : {}),
    ...(cellText(values.sourceDetail) ? { sourceDetail: cellText(values.sourceDetail) } : {}),
    ...(cellText(values.preferredLanguage) ? { preferredLanguage: cellText(values.preferredLanguage) } : {}),
    requirement: r,
    qualification: { decisionMakers: [], loan: 'unknown', ...(timeline ? { timeline } : {}) },
    ...(notes ? { note: notes } : {}),
  }
  if (source === 'other' && cellText(values.source) && !record.sourceDetail) record.sourceDetail = cellText(values.source)
  return { record, issues }
}

export function buildProperty(values: Record<string, Cell>, kind: Exclude<SheetKind, 'leads'>): Built<PropertyInput> {
  const issues: Issue[] = []
  const read = reader(values, issues)
  const type = read('type', readPropertyType) ?? DEFAULT_TYPE[kind]
  if (!isBlank(values.type) && isOk(readPropertyType(values.type)) && !KIND_TYPES[kind].includes(type)) issues.push({ field: 'type', key: 'typeOtherTemplate', level: 'warning', params: { value: cellText(values.type) } })
  const def = PROPERTY_TYPES[type]
  const configuration = def.configurable ? read('configuration', readConfig, { required: true, missingKey: 'configMissing' }) : undefined
  const locality = read('location.locality', readLocality, { required: true, missingKey: 'localityMissing' })
  let city = read('location.city', readCity)
  // a known locality names its city (Hebbal → Bengaluru); the row is not flagged for it
  if (!city && locality) city = cityOfLocality(locality)
  if (!city) issues.push({ field: 'location.city', key: 'cityMissing', level: 'missing' })
  const area: PropertyInput['area'] = {}
  const carpet = read('area.carpet', readArea)
  const builtUp = read('area.builtUp', readArea)
  const superBuiltUp = read('area.superBuiltUp', readArea)
  const plot = read('area.plot', readArea)
  const dims = read('dimensions', readDimensions)
  if (carpet) area.carpet = carpet.sqft
  if (builtUp) area.builtUp = builtUp.sqft
  if (superBuiltUp) area.superBuiltUp = superBuiltUp.sqft
  if (plot) { area.plot = plot.value; area.plotUnit = plot.unit; if (plot.lengthFt) { area.plotLengthFt = plot.lengthFt; area.plotWidthFt = plot.widthFt } }
  if (dims) { area.plotLengthFt = dims.lengthFt; area.plotWidthFt = dims.widthFt; if (!area.plot) { area.plot = Math.round(dims.lengthFt * dims.widthFt); area.plotUnit = 'sqft' } }
  const anyArea = area.carpet || area.builtUp || area.superBuiltUp || area.plot
  const areaSqft = area.superBuiltUp ?? area.builtUp ?? area.carpet ?? (plot ? plot.sqft : area.plot)
  if (!anyArea && !issues.some((i) => i.field.startsWith('area.') && i.level === 'error')) issues.push({ field: 'area.any', key: 'areaMissing', level: 'missing' })
  if (area.carpet && area.builtUp && area.carpet > area.builtUp) issues.push({ field: 'area.carpet', key: 'carpetOverBuiltUp', level: 'error' })
  const price = read('price', (v) => readPrice(v, areaSqft), { required: true, missingKey: 'priceMissing' })
  const floor = read('floor', readInt)
  const totalFloors = read('totalFloors', readInt)
  if (floor != null && totalFloors != null && floor > totalFloors) issues.push({ field: 'floor', key: 'floorOverTotal', level: 'error' })
  const facing: Facing | undefined = read('facing', readFacing)
  const possession = read('possession.status', readPossession)
  const possessionDate = read('possession.date', readDate)
  const furnishing = read('furnishing', readFurnishing)
  const transaction = read('transaction', readTransaction)
  const roadWidthFt = read('roadWidthFt', readInt)
  const covered = read('parking.covered', readInt)
  const maintenance = read('maintenancePerMonth', (v) => readPrice(v))
  const ownerPhone = read('owner.phone', readPhone)
  if (price && areaSqft) {
    const psf = price / areaSqft
    const [lo, hi] = PSF_BAND[def.category === 'land' ? 'land' : 'built']
    if (psf < lo || psf > hi) issues.push({ field: 'price', key: 'priceAreaOdd', level: 'warning', params: { perSqft: Math.round(psf) } })
  }
  const projectName = cellText(values.projectName) || undefined
  const specs: PropertyInput['specs'] = {}
  if (cellText(values['specs.towerName'])) specs.towerName = cellText(values['specs.towerName'])
  if (cellText(values['specs.unitNumber'])) specs.unitNumber = cellText(values['specs.unitNumber'])
  const record: PropertyInput = {
    title: cellText(values.title) || autoTitle({ type, configuration, projectName, locality }),
    type, purpose: 'sale', transaction: transaction ?? 'newBooking',
    ...(configuration ? { configuration, bedrooms: Math.floor(CONFIGURATION_BEDROOMS[configuration]) } : {}),
    ...(projectName ? { projectName } : {}),
    ...(cellText(values.builderName) ? { builderName: cellText(values.builderName) } : {}),
    location: {
      city: city ?? '', locality: locality ?? '',
      ...(cellText(values['location.address']) ? { address: cellText(values['location.address']) } : {}),
      ...(cellText(values['location.pincode']) ? { pincode: cellText(values['location.pincode']) } : {}),
    },
    price: price ?? 0,
    area,
    ...(floor != null ? { floor } : {}), ...(totalFloors != null ? { totalFloors } : {}), ...(facing ? { facing } : {}),
    ...(furnishing ? { furnishing } : {}), ...(roadWidthFt != null ? { roadWidthFt } : {}), ...(maintenance ? { maintenancePerMonth: maintenance } : {}),
    parking: { covered: covered ?? 0, open: 0 },
    amenities: [],
    possession: possession ? { status: possession.status, ...(possession.date || possessionDate ? { date: possessionDate ?? possession.date } : {}) } : { status: possessionDate ? 'underConstruction' : 'ready', ...(possessionDate ? { date: possessionDate } : {}) },
    ...(cellText(values['rera.number']) ? { rera: { number: cellText(values['rera.number']), verified: false } } : {}),
    approvals: [], bankApprovals: [], specs,
    status: 'available', listing: 'live', media: [],
    ...(cellText(values['owner.name']) || ownerPhone ? { owner: { name: cellText(values['owner.name']), phone: ownerPhone ?? '', kind: /builder|developer|pvt|ltd|infra|homes|realty|construction/i.test(cellText(values['owner.name'])) ? 'builder' : 'owner' } } : {}),
    ...(cellText(values.description) ? { description: cellText(values.description) } : {}),
  }
  const amenityText = cellText(values.amenities)
  if (amenityText) record.description = [record.description, amenityText].filter(Boolean).join('\n')
  return { record, issues }
}

// ── whole sheet ────────────────────────────────────────────────────────────────────────────────────────────────────
const isMissing = (i: Issue) => i.level === 'missing'
const isError = (i: Issue) => i.level === 'error'

function propertyKey(p: PropertyInput) {
  return { project: (p.projectName ?? '').trim().toLowerCase(), unit: String(p.specs.unitNumber ?? '').trim().toLowerCase(), locality: p.location.locality.trim().toLowerCase() }
}
const near = (a: number, b: number, pct: number) => Math.abs(a - b) <= Math.max(a, b) * pct
const primarySqft = (p: Pick<PropertyInput, 'area'>) => p.area.superBuiltUp ?? p.area.builtUp ?? p.area.carpet ?? p.area.plot ?? 0

/** Same project + unit (or same locality + unit when no project), or same locality and type with price ±5 % and area ±2 %. */
export function sameProperty(a: PropertyInput, b: Pick<PropertyInput, 'projectName' | 'specs' | 'location' | 'type' | 'price' | 'area'>): 'unit' | 'similar' | null {
  const ka = propertyKey(a)
  const kb = { project: (b.projectName ?? '').trim().toLowerCase(), unit: String(b.specs?.unitNumber ?? '').trim().toLowerCase(), locality: b.location.locality.trim().toLowerCase() }
  if (ka.unit && ka.unit === kb.unit && ((ka.project && ka.project === kb.project) || (!ka.project && !kb.project && ka.locality === kb.locality))) return 'unit'
  if (ka.unit && kb.unit && ka.unit !== kb.unit) return null
  if (ka.locality && ka.locality === kb.locality && a.type === b.type && a.price > 0 && near(a.price, b.price, 0.05)) {
    const sa = primarySqft(a)
    const sb = primarySqft(b)
    if (sa && sb && near(sa, sb, 0.02)) return 'similar'
  }
  return null
}

/** Evaluates every row of the table, in order (within-file duplicates point at the earlier row). */
export function evaluateRows(table: Table, ctx: RowContext): EvaluatedRow[] {
  const byField = new Map<string, number>()
  ctx.mapping.forEach((m, i) => { if (m.field) byField.set(m.field, i) })
  const out: EvaluatedRow[] = []
  const seenPhones = new Map<string, number>()
  const seenEmails = new Map<string, number>()
  const seenProps: { row: number; p: PropertyInput }[] = []

  for (const row of table.rows) {
    const values: Record<string, Cell> = {}
    const meta: FieldMetaMap = {}
    for (const [field, col] of byField) {
      const v = row.cells[col]
      if (!isBlank(v)) { values[field] = v; meta[field] = { origin: 'import', confidence: ctx.mapping[col].confidence } }
    }
    for (const [field, v] of Object.entries(ctx.defaults ?? {})) {
      if (v.trim() && isBlank(values[field])) { values[field] = v; meta[field] = { origin: 'import', confidence: 1 } }
    }
    for (const [field, v] of Object.entries(ctx.edits?.[row.rowNumber] ?? {})) {
      values[field] = v
      if (v.trim()) meta[field] = { origin: 'manual' }
      else delete meta[field]
    }
    const extras = ctx.mapping.flatMap((m, i) => (!m.field && !isBlank(row.cells[i]) ? [{ column: m.column, value: cellText(row.cells[i]) }] : []))
    const extraText = extras.map((e) => `${e.column}: ${e.value}`).join('\n')
    const text: Record<string, string> = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, cellText(v)]))

    let ev: EvaluatedRow
    if (ctx.kind === 'leads') {
      const { record, issues } = buildLead(values)
      if (extraText) record.note = [record.note, extraText].filter(Boolean).join('\n')
      ev = { rowNumber: row.rowNumber, status: 'ready', issues, values: text, label: record.name || record.phone || `#${row.rowNumber}`, lead: record, meta, extras }
      if (!issues.some(isError)) {
        const db = findDuplicates(ctx.db, { phone: record.phone, altPhone: record.altPhone, email: record.email })[0]
        const p = record.phone ? last10(record.phone) : ''
        const e = record.email?.toLowerCase() ?? ''
        if (db) ev.duplicate = { kind: 'lead', id: db.lead.id, name: db.lead.name, by: db.by }
        else if (p && seenPhones.has(p)) ev.duplicate = { kind: 'row', row: seenPhones.get(p)!, by: 'phone' }
        else if (e && seenEmails.has(e)) ev.duplicate = { kind: 'row', row: seenEmails.get(e)!, by: 'email' }
        if (p && !seenPhones.has(p)) seenPhones.set(p, row.rowNumber)
        if (e && !seenEmails.has(e)) seenEmails.set(e, row.rowNumber)
      }
    } else {
      const { record, issues } = buildProperty(values, ctx.kind)
      if (extraText) record.description = [record.description, extraText].filter(Boolean).join('\n')
      if (!values['location.city'] && record.location.city) meta['location.city'] = { origin: 'import', confidence: 0.85 }
      ev = { rowNumber: row.rowNumber, status: 'ready', issues, values: text, label: record.title, property: record, meta, extras }
      if (!issues.some(isError)) {
        const inDb = ctx.db.properties.map((p) => ({ p, by: sameProperty(record, p) })).find((x) => x.by)
        const inFile = seenProps.map((x) => ({ row: x.row, by: sameProperty(record, x.p) })).find((x) => x.by)
        if (inDb?.by) ev.duplicate = { kind: 'property', id: inDb.p.id, name: inDb.p.title, by: inDb.by }
        else if (inFile?.by) ev.duplicate = { kind: 'row', row: inFile.row, by: inFile.by }
        seenProps.push({ row: row.rowNumber, p: record })
      }
    }
    ev.status = ev.issues.some(isError) ? 'error' : ev.duplicate ? 'duplicate' : ev.issues.some(isMissing) ? (ctx.kind === 'leads' && ev.issues.some((i) => isMissing(i) && i.key === 'sourceMissing') ? 'error' : 'draft') : 'ready'
    out.push(ev)
  }
  return out
}

export type StatusCounts = Record<RowStatus, number> & { total: number }
export function statusCounts(rows: EvaluatedRow[], skipped: ReadonlySet<number> = new Set()): StatusCounts & { skipped: number } {
  const c = { ready: 0, draft: 0, duplicate: 0, error: 0, total: rows.length, skipped: 0 }
  for (const r of rows) { if (skipped.has(r.rowNumber)) c.skipped++; else c[r.status]++ }
  return c
}

/** Fields that identify one record: a single value for all rows makes no sense there. */
const PER_ROW_FIELDS = new Set(['area.any', 'name', 'phone', 'email', 'altPhone', 'title', 'specs.unitNumber', 'owner.phone'])

/** The fields most often missing or invalid, for "set for all" (field → rows). */
export function commonGaps(rows: EvaluatedRow[], skipped: ReadonlySet<number> = new Set()): { field: string; key: string; rows: number[] }[] {
  const map = new Map<string, { field: string; key: string; rows: number[] }>()
  for (const r of rows) {
    if (skipped.has(r.rowNumber)) continue
    for (const i of r.issues) {
      if (i.level === 'warning' || PER_ROW_FIELDS.has(i.field)) continue
      const k = i.field
      const e = map.get(k) ?? { field: i.field, key: i.key, rows: [] }
      if (!e.rows.includes(r.rowNumber)) e.rows.push(r.rowNumber)
      map.set(k, e)
    }
  }
  return [...map.values()].filter((g) => g.rows.length >= 2).sort((a, b) => b.rows.length - a.rows.length)
}

/** The value a field needs for a form/input: the field's read kind (for choosing the input control). */
export const valueKindOf = (field: string) => fieldDef(field)?.value ?? 'text'

/** Readable text for a value in the fix and draft forms ("1.25 Cr", "85 L"). */
export function moneyText(n: number | undefined): string {
  if (!n) return ''
  if (n >= 10_000_000) return `${+(n / 10_000_000).toFixed(4)} Cr`
  if (n >= 100_000) return `${+(n / 100_000).toFixed(2)} L`
  return String(n)
}

/** A stored lead/property payload → the text values the form edits (the reverse of buildLead / buildProperty). */
export function payloadToValues(kind: 'lead' | 'property', payload: Record<string, unknown>): Record<string, string> {
  const get = (path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), payload)
  const out: Record<string, string> = {}
  const put = (field: string, v: unknown) => {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return
    out[field] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  if (kind === 'lead') {
    for (const f of ['name', 'phone', 'email', 'altPhone', 'source', 'sourceDetail', 'preferredLanguage', 'requirement.cities', 'requirement.localities',
      'requirement.propertyTypes', 'requirement.configurations', 'qualification.timeline', 'note']) put(f === 'note' ? 'notes' : f, get(f))
    out['requirement.budgetMin'] = moneyText(get('requirement.budgetMin') as number | undefined)
    out['requirement.budgetMax'] = moneyText(get('requirement.budgetMax') as number | undefined)
  } else {
    for (const f of ['title', 'type', 'configuration', 'projectName', 'builderName', 'location.city', 'location.locality', 'location.address',
      'area.carpet', 'area.builtUp', 'area.superBuiltUp', 'floor', 'totalFloors', 'facing', 'possession.status', 'possession.date', 'transaction',
      'rera.number', 'owner.name', 'owner.phone', 'description']) put(f, get(f))
    const plot = get('area.plot') as number | undefined
    if (plot) out['area.plot'] = `${plot} ${String(get('area.plotUnit') ?? 'sqft')}`
    out.price = moneyText(get('price') as number | undefined)
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== ''))
}

/** Field paths of a payload that carry a value, for marking draft fields ("requirement.cities", "area.carpet"…). */
export function filledPaths(payload: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(payload).flatMap(([k, v]) => {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) return filledPaths(v as Record<string, unknown>, p)
    return v == null || v === '' || (Array.isArray(v) && !v.length) ? [] : [p]
  })
}

export { set as setPath }
