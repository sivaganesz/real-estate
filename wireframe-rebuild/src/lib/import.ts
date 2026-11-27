/**
 * Bulk import — properties from a spreadsheet (our template or anyone's own sheet), a brochure or a photo.
 * Rebuilt from spec-system-wireframe/views-import.js. Flow: choose the type → drop a file → check every row → import.
 *
 * Rules (the same as Add property):
 * - Blank Property ID = a new property; an existing ID = update only the filled cells (Admin / Sales manager only).
 * - A row missing a required detail is never rejected: it becomes a draft the AI assistant finishes.
 * - A blank title is suggested by the AI. Latitude + longitude = the exact location.
 * - Approvals can be listed; each starts as "document pending". Columns with no field are kept as extra details.
 * - A Sales executive's ready rows wait for a manager's approval.
 *
 * Columns use the assistant's fact keys (`price`, `area`, `spec:length`…), so labels and values show the same everywhere.
 * Messages are i18n keys with values (`imp.msg.<k>`), never finished sentences. In the product the AI matches columns
 * and reads PDFs and photos; the wireframe does the same with rules and a sample result.
 */
import { CITIES, FACINGS, PROPERTY_TYPES, PURPOSES, amenityList, typeFacts } from '@/data/catalogue'
import type { Database, ExtraDetail, Facing, FactSource, Property, PropertyStatus, PropertyTypeKey, Purpose, Settings, SpecValue } from '@/data/types'
import { type Draft, EMPTY_DRAFT, draftToProperty, nextStep, type OptionalStep, suggestTitle } from './assistant'

export const IMP_MAX_ROWS = 500
/** A column that has no field of its own: kept on the property as an extra detail. */
export const EXTRA = '_extra'

export type Issue = { k: string; v?: Record<string, string | number> }

export type ImpCol = {
  /** `id`, `title`, `purpose`, `status`, `city`, `locality`, `facing`, `area`, `price`, `lat`, `lng`, `amenities`, `approvals`, `spec:<key>` */
  key: string
  /** The English heading in our template (also used to match other sheets). */
  heading: string
  kind: 'id' | 'text' | 'number' | 'select' | 'month' | 'list' | 'approvals'
  options?: string[]
  req?: boolean
  money?: boolean
}

const STATUSES: PropertyStatus[] = ['available', 'negotiation', 'reserved', 'onHold', 'booked', 'sold']
const STATUS_WORDS: Record<string, PropertyStatus> = { available: 'available', forsale: 'available', open: 'available', negotiation: 'negotiation', undernegotiation: 'negotiation', reserved: 'reserved', onhold: 'onHold', hold: 'onHold', booked: 'booked', sold: 'sold' }
const FACING_WORDS: Record<string, Facing> = { e: 'E', east: 'E', n: 'N', north: 'N', w: 'W', west: 'W', s: 'S', south: 'S', ne: 'NE', northeast: 'NE', nw: 'NW', northwest: 'NW', se: 'SE', southeast: 'SE', sw: 'SW', southwest: 'SW' }

/** Every column a file of this type can have; the required ones first after the ID and title. */
export function importColumns(type: PropertyTypeKey, s: Settings): ImpCol[] {
  const def = PROPERTY_TYPES[type]
  const main: ImpCol[] = [
    { key: 'id', heading: 'Property ID', kind: 'id' },
    { key: 'title', heading: 'Property title', kind: 'text' },
    { key: 'purpose', heading: 'Listing purpose', kind: 'select', options: def.purposes },
    { key: 'status', heading: 'Property status', kind: 'select', options: STATUSES },
    { key: 'city', heading: 'City', kind: 'select', options: Object.keys(CITIES), req: true },
    { key: 'locality', heading: 'Locality', kind: 'text', req: true },
    { key: 'facing', heading: 'Facing', kind: 'select', options: FACINGS },
    { key: 'area', heading: `${def.areaLabel} (sq.ft.)`, kind: 'number', req: true },
    { key: 'price', heading: 'Asking price (₹)', kind: 'number', req: true, money: true },
    { key: 'lat', heading: 'Latitude', kind: 'number' },
    { key: 'lng', heading: 'Longitude', kind: 'number' },
    { key: 'amenities', heading: 'Amenities', kind: 'list' },
    { key: 'approvals', heading: 'Approvals', kind: 'approvals' },
  ]
  const specs: ImpCol[] = typeFacts(type, s).map((f) => ({
    key: `spec:${f.key}`, heading: f.label, kind: f.kind, options: f.options, money: f.money, req: (def.required as string[]).includes(f.key),
  }))
  return [...main, ...specs.filter((c) => c.req), ...specs.filter((c) => !c.req)]
}

/* ---------- reading files ---------- */

/** CSV text → rows of cells (quotes, commas and line breaks inside quotes are handled). */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n')

/** Save a CSV in the browser (with a BOM so Excel reads ₹ and Tamil correctly). */
export function downloadCsv(name: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The first sheet of an Excel (.xlsx) file, read in the browser: an .xlsx file is a zip of XML files. */
export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const u8 = new Uint8Array(buf), dv = new DataView(buf)
  let eocd = -1
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('not an Excel file')
  const n = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const files: Record<string, { method: number; csize: number; off: number }> = {}
  for (let k = 0; k < n; k++) {
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true)
    files[new TextDecoder().decode(u8.slice(p + 46, p + 46 + nlen))] = { method: dv.getUint16(p + 10, true), csize: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) }
    p += 46 + nlen + xlen + clen
  }
  const read = async (name: string): Promise<string | null> => {
    const f = files[name]
    if (!f) return null
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true)
    const raw = u8.slice(start, start + f.csize)
    if (f.method === 0) return new TextDecoder().decode(raw)
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat))
    return new Response(stream).text()
  }
  const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml')
  const ss = await read('xl/sharedStrings.xml')
  const shared = ss ? [...xml(ss).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join('')) : []
  const sheet = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]))[0]
  if (!sheet) throw new Error('no sheet found')
  const doc = xml((await read(sheet)) ?? '')
  const rows: string[][] = []
  const colIx = (ref: string) => { let c = 0; for (const ch of ref.replace(/\d+/g, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1 }
  for (const row of [...doc.getElementsByTagName('row')]) {
    const r: string[] = []
    for (const c of [...row.getElementsByTagName('c')]) {
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0]
      let val = t === 's' ? shared[Number(v?.textContent)] ?? '' : t === 'inlineStr' ? is?.textContent ?? '' : t === 'b' ? (v?.textContent === '1' ? 'TRUE' : 'FALSE') : v?.textContent ?? ''
      if (t !== 's' && t !== 'inlineStr' && t !== 'str' && val !== '' && !isNaN(+val)) val = String(+(+val).toPrecision(12))
      r[colIx(c.getAttribute('r') ?? 'A')] = val
    }
    rows[Number(row.getAttribute('r')) - 1] = Array.from(r, (x) => x ?? '')
  }
  return Array.from(rows, (x) => x ?? [])
}

/* ---------- matching another sheet's columns ---------- */

export const norm = (h: unknown) => String(h ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')

/** Other names people use for our columns. In the product the AI does this; the list stands in for it. */
const SYN: Record<string, string[]> = {
  id: ['propertyid', 'id', 'propid', 'refno', 'reference'],
  title: ['title', 'propertytitle', 'propertyname', 'name', 'plotname', 'projectname', 'listingtitle', 'heading', 'property'],
  purpose: ['purpose', 'listingpurpose', 'saleorrent', 'salerent', 'dealtype', 'transaction', 'for'],
  status: ['status', 'availability', 'propertystatus'],
  city: ['city', 'town', 'district', 'citydistrict'],
  locality: ['locality', 'areaname', 'location', 'place', 'neighbourhood', 'neighborhood', 'village'],
  facing: ['facing', 'direction', 'orientation'],
  area: ['areasqft', 'size', 'plotsize', 'plotarea', 'sqft', 'totalarea', 'builtuparea', 'extent', 'landarea', 'areainsqft', 'sizesqft', 'usablearea'],
  price: ['askingprice', 'price', 'rate', 'cost', 'amount', 'expectedprice', 'value', 'totalprice', 'pricers', 'priceinr', 'quotedprice', 'rs'],
  lat: ['latitude', 'lat'], lng: ['longitude', 'long', 'lng', 'lon'],
  amenities: ['amenities', 'features', 'facilities'],
  approvals: ['approvals', 'approval', 'approvedby', 'sanction', 'approvaltype', 'dtcp'],
  'spec:length': ['length', 'plotlength', 'lengthft'], 'spec:width': ['width', 'breadth', 'plotwidth', 'widthft', 'breadthft'],
  'spec:roadWidth': ['roadwidth', 'road', 'roadft', 'roadsize', 'streetwidth'], 'spec:corner': ['corner', 'cornerplot', 'cornernoncorner'],
  'spec:surveyNo': ['surveyno', 'surveynumber', 'sfno', 'survey', 'sno'], 'spec:layoutApproval': ['layoutapproval', 'approvalno', 'layoutno'],
  'spec:bhk': ['bhk', 'config', 'configuration', 'bhkconfiguration'], 'spec:floor': ['floor', 'floorno', 'floornumber'],
  'spec:totalFloors': ['totalfloors', 'floors', 'noofloors'], 'spec:carpet': ['carpet', 'carpetarea'],
  'spec:bedrooms': ['bedrooms', 'beds', 'bedroom'], 'spec:bathrooms': ['bathrooms', 'baths', 'toilets'],
  'spec:parking': ['parking', 'carparking', 'carpark'], 'spec:maintenance': ['maintenance', 'maintenancecharges', 'monthlymaintenance'],
  'spec:possession': ['possession', 'possessionstatus'], 'spec:possessionDate': ['possessiondate', 'expectedpossession', 'handover'],
}

const isNumish = (v: unknown) => /^\s*(₹|rs\.?)?\s*[\d,.]+\s*(l|lac|lakh|lakhs|cr|crore|crores|k|sq\.?\s*ft\.?|sqft|ft|feet|cents|acres?)?\s*$/i.test(String(v))

/** How a column was matched: our heading, a saved sender's format, remembered from an earlier file, the AI, kept as extra, or not used. */
export type MatchHow = 'exact' | 'format' | 'remembered' | 'ai' | 'extra' | 'none' | 'you'
export type ColMatch = { heading: string; key: string; how: MatchHow; samples: string[]; why?: 'sizes' | 'places' }

export type ImportFormat = {
  id: string
  type: PropertyTypeKey
  sender: string
  /** The headings, normalised: a file with 80%+ of the same headings is this format. */
  sig: string[]
  headings: string[]
  /** Normalised heading → column key ('' = not used, EXTRA = kept as an extra detail). */
  map: Record<string, string>
  uses: number
  last: string
  by: string
}

const keyOk = (k: string, cols: ImpCol[]) => k === '' || k === EXTRA || cols.some((c) => c.key === k)
export const headingSig = (hs: string[]) => [...new Set(hs.map(norm).filter(Boolean))]

/** A saved format with nearly the same headings, for this type. */
export function findFormat(headings: string[], type: PropertyTypeKey, formats: ImportFormat[]): ImportFormat | undefined {
  const sig = headingSig(headings)
  let best: ImportFormat | undefined, bestScore = 0
  for (const f of formats.filter((x) => x.type === type)) {
    const score = f.sig.filter((x) => sig.includes(x)).length / Math.max(f.sig.length, sig.length)
    if (score >= 0.8 && score > bestScore) { best = f; bestScore = score }
  }
  return best
}

/** Match each heading to a column: ours → the sender's saved format → remembered → the AI (other names, then the values). */
export function autoMatch(headings: string[], rows: string[][], cols: ImpCol[], format?: ImportFormat, memory: Record<string, string> = {}): ColMatch[] {
  const fm = format?.map ?? {}
  const out: ColMatch[] = headings.map((heading, i) => {
    const n = norm(heading)
    const samples = rows.map((r) => String(r[i] ?? '').trim()).filter(Boolean).slice(0, 3)
    if (!n) return { heading, key: '', how: 'none', samples }
    const col = cols.find((c) => norm(c.key) === n || norm(c.key.replace('spec:', '')) === n || norm(c.heading) === n)
    if (col) return { heading, key: col.key, how: 'exact', samples }
    if (fm[n] !== undefined && keyOk(fm[n], cols)) return { heading, key: fm[n], how: 'format', samples }
    if (memory[n] !== undefined && keyOk(memory[n], cols)) return { heading, key: memory[n], how: 'remembered', samples }
    // "Area" or "Location": sizes or place names? Decide by the values
    if (['area', 'location', 'areaname'].includes(n) && samples.length) {
      const sizes = samples.filter(isNumish).length >= Math.ceil(samples.length / 2)
      return { heading, key: sizes ? 'area' : 'locality', how: 'ai', samples, why: sizes ? 'sizes' : 'places' }
    }
    const syn = (c: ImpCol) => (SYN[c.key] ?? []).map(norm)
    const hit = cols.find((c) => syn(c).includes(n)) ?? cols.find((c) => syn(c).some((s) => s.length > 3 && (n.includes(s) || s.includes(n))))
    if (hit) return { heading, key: hit.key, how: 'ai', samples }
    return samples.length ? { heading, key: EXTRA, how: 'extra', samples } : { heading, key: '', how: 'none', samples }
  })
  // two columns for one field: the first match keeps it
  const used = new Set<string>()
  for (const m of out) {
    if (!m.key || m.key === EXTRA) continue
    if (used.has(m.key) && m.how !== 'exact') { m.key = m.samples.length ? EXTRA : ''; m.how = m.key ? 'extra' : 'none' } else used.add(m.key)
  }
  return out
}

/* ---------- reading values from people's own sheets ---------- */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** "30 L", "1.2 Cr", "1,200 sqft", "30 ft", "North-East", "December 2027", an Excel date number — into our value. */
export function cleanValue(col: ImpCol | undefined, raw: unknown, approvals: Settings['approvalTypes']): { v: string; note?: Issue } {
  const s = String(raw ?? '').trim()
  if (!s || !col) return { v: s }
  if (col.money) {
    const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(cr|crore|crores|l|lac|lacs|lakh|lakhs|k)?\b/i)
    if (m) {
      const mult = ({ cr: 1e7, crore: 1e7, crores: 1e7, l: 1e5, lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5, k: 1e3 } as Record<string, number>)[(m[2] ?? '').toLowerCase()] ?? 1
      const n = Math.round(Number(m[1]) * mult)
      return { v: String(n), note: mult > 1 || m[0] !== s.replace(/,/g, '') ? { k: 'readMoney', v: { from: s, to: n } } : undefined }
    }
  }
  if (col.kind === 'number') {
    const plain = s.replace(/,/g, '')
    const m = plain.match(/-?\d+(?:\.\d+)?/)
    if (m) return { v: m[0], note: m[0] !== plain ? { k: 'readAs', v: { from: s, to: m[0] } } : undefined }
  }
  if (col.kind === 'month') {
    if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5).toISOString().slice(0, 7); return { v: d, note: { k: 'readAs', v: { from: s, to: d } } } }
    const mm = s.toLowerCase().match(/([a-z]{3,})\s*,?\s*(\d{4})/)
    const mi = mm ? MONTHS.findIndex((x) => x.startsWith(mm[1].slice(0, 3))) : -1
    if (mm && mi >= 0) { const d = `${mm[2]}-${String(mi + 1).padStart(2, '0')}`; return { v: d, note: { k: 'readAs', v: { from: s, to: d } } } }
  }
  if (col.key === 'facing') return { v: FACING_WORDS[norm(s)] ?? s }
  if (col.key === 'status') return { v: STATUS_WORDS[norm(s)] ?? s }
  if (col.key === 'purpose') { const p = PURPOSES.find((x) => norm(s).startsWith(x)); return { v: p ?? s } }
  if (col.kind === 'approvals') {
    // "DTCP and RERA", "RERA; DTCP approved" → our approval ids
    return { v: s.split(/[;,/]| and /i).map((x) => x.trim()).filter(Boolean).map((x) => approvalId(x, approvals) ?? x).join(';') }
  }
  if (col.kind === 'select' && col.options) {
    const hit = col.options.find((o) => norm(o) === norm(s)) ?? col.options.find((o) => norm(s).length >= 3 && norm(o).startsWith(norm(s)))
    return { v: hit ?? s }
  }
  return { v: s }
}

/** An approval named in a file ("DTCP", "RERA approval", "dtcp approved") → its id in Settings. */
export function approvalId(name: string, approvals: Settings['approvalTypes']): string | undefined {
  const n = norm(name).replace(/approved|approval/g, '')
  return approvals.find((a) => [a.id, a.label, a.documentName].some((x) => { const m = norm(x).replace(/approved|approval/g, ''); return m === n || (n.length >= 3 && m.startsWith(n)) }))?.id
}

/* ---------- a file → rows ready to check ---------- */

/** What the AI read from a brochure or a photo: one item per property, with the page and the words it came from. */
export type DocItem = { page: number; photos: number; quote: string; f: Record<string, string>; notes?: Issue[]; confirm?: Issue[]; extra?: ExtraDetail[] }
export type DocRead = { kind: 'pdf' | 'image'; pages: number; type: PropertyTypeKey; what: string; items: DocItem[] }

export type Source = {
  file: string
  headings: string[]
  data: string[][]
  /** The line in the file of each data row (headings may sit below a title). */
  lines: number[]
  matches: ColMatch[]
  /** Only the first IMP_MAX_ROWS rows were read. */
  limited: boolean
  /** What was worked out about the file: where the headings are, total rows skipped. */
  found: Issue[]
  format?: ImportFormat
  /** Every heading is one of ours: no column step. */
  template: boolean
  doc?: DocRead & { real: boolean }
}

/** The heading row: the first (of 15) that's nearly as wide as the table and mostly text — a title line above it is skipped. */
function findHeadingRow(rows: string[][]): number {
  const filled = (r: string[]) => r.filter((c) => c.trim() !== '').length
  const wide = Math.max(...rows.slice(0, 40).map(filled))
  for (let i = 0; i < Math.min(rows.length - 1, 15); i++) {
    const f = filled(rows[i])
    if (f < Math.max(2, Math.ceil(wide * 0.6))) continue
    if (rows[i].filter((c) => c.trim() !== '' && !isNumish(c)).length / f >= 0.7) return i
  }
  return 0
}

/** Rows (with headings somewhere near the top) → a source to check. `null` with a reason when there's nothing to read. */
export function prepare(rows: unknown[][], file: string, cols: ImpCol[], type: PropertyTypeKey, db: Pick<Database, 'importFormats' | 'importMemory'>):
  { src: Source } | { error: 'empty' | 'noRows' } {
  const all = rows.map((r, i) => ({ r: (r ?? []).map((c) => String(c ?? '')), line: i + 1 })).filter((x) => x.r.some((c) => c.trim() !== ''))
  if (all.length < 2) return { error: all.length ? 'noRows' : 'empty' }
  const hi = findHeadingRow(all.map((x) => x.r))
  const headings = all[hi].r.map((h) => h.trim())
  const found: Issue[] = []
  if (all[hi].line > 1) found.push({ k: 'headingsOn', v: { line: all[hi].line, above: all.slice(0, hi).map((x) => `“${x.r.filter((c) => c.trim()).join(' ')}”`).join(', ') } })
  let body = all.slice(hi + 1)
  const width = headings.filter(Boolean).length
  const isTotal = (r: string[]) => /^\s*(grand\s+|sub\s*)?total\b/i.test(r.find((c) => c.trim()) ?? '') && r.filter((c) => c.trim()).length <= Math.ceil(width / 2)
  const totals = body.filter((x) => isTotal(x.r))
  body = body.filter((x) => !isTotal(x.r))
  if (totals.length) found.push({ k: 'totalsSkipped', v: { count: totals.length, lines: totals.map((x) => x.line).join(', ') } })
  if (!body.length) return { error: 'noRows' }
  const limited = body.length > IMP_MAX_ROWS
  if (limited) body = body.slice(0, IMP_MAX_ROWS)
  const data = body.map((x) => x.r)
  const format = findFormat(headings, type, db.importFormats ?? [])
  const matches = autoMatch(headings, data, cols, format, db.importMemory ?? {})
  return { src: { file, headings, data, lines: body.map((x) => x.line), matches, limited, found, format, template: matches.every((m) => m.how === 'exact' || !m.heading) } }
}

/* ---------- checking each row ---------- */

export type RowStatus = 'new' | 'draft' | 'update' | 'nochange' | 'error'
export type Change = { key: string; from: unknown; to: unknown; extra?: boolean }

export type ImpRow = {
  line: number
  /** Values by column key, cleaned. */
  data: Record<string, string>
  errors: Issue[]
  warnings: Issue[]
  notes: Issue[]
  /** Required columns still empty (a draft the AI finishes). */
  needs: string[]
  mode: 'new' | 'update'
  existing?: Property
  changes: Change[]
  extra: ExtraDetail[]
  suggestedTitle?: string
  /** From a brochure or a photo. */
  page?: number
  quote?: string
  photos: number
  /** What the AI wasn't sure of: the row becomes a draft so a person confirms it. */
  confirm: Issue[]
}

export const rowStatus = (r: ImpRow): RowStatus =>
  r.errors.length ? 'error' : r.mode === 'update' ? (r.changes.length ? 'update' : 'nochange') : r.needs.length || r.confirm.length ? 'draft' : 'new'

const num = (v: string) => Number(String(v).replace(/,/g, '').trim())

/** The stored value for a column (numbers as numbers, lists as lists). */
export function valueFor(col: ImpCol, v: string, settings: Settings): SpecValue | string[] {
  if (col.kind === 'number') return num(v)
  if (col.kind === 'list') {
    const list = amenityList(settings)
    return v.split(/[;,]/).map((x) => x.trim()).map((a) => list.find((x) => norm(x) === norm(a))).filter((x): x is string => !!x)
  }
  if (col.kind === 'approvals') return [...new Set(v.split(';').map((x) => approvalId(x, settings.approvalTypes)).filter((x): x is string => !!x))]
  return v
}

/** The current value on a property, for an update's "from → to". */
function currentValue(p: Property, key: string): unknown {
  if (key.startsWith('spec:')) return p.specs[key.slice(5)]
  switch (key) {
    case 'title': return p.title
    case 'purpose': return p.purpose
    case 'status': return p.status
    case 'city': return p.location.city
    case 'locality': return p.location.locality
    case 'facing': return p.facing
    case 'area': return p.areaSqft
    case 'price': return p.price
    case 'lat': return p.location.lat
    case 'lng': return p.location.lng
    case 'amenities': return p.amenities
    case 'approvals': return p.approvals.map((a) => a.approvalId)
  }
}

/** Check every row against the rules. `canUpdate`: an Admin or Sales manager (only they change published properties). */
export function checkRows(objs: { data: Record<string, string>; extra: ExtraDetail[] }[], lines: number[], cols: ImpCol[], type: PropertyTypeKey,
  db: Database, canUpdate: boolean): ImpRow[] {
  const seen: Record<string, number> = {}
  const s = db.settings
  return objs.map((o, i) => {
    const line = lines[i]
    const r: ImpRow = { line, data: {}, errors: [], warnings: [], notes: [], needs: [], mode: 'new', changes: [], extra: o.extra.filter((x) => x.value), photos: 0, confirm: [] }
    for (const c of cols) r.data[c.key] = String(o.data[c.key] ?? '').trim()
    const d = r.data, id = d.id
    if (id) {
      if (seen[id]) r.errors.push({ k: 'dupId', v: { line: seen[id] } }); else seen[id] = line
      const ex = db.properties.find((p) => p.id.toLowerCase() === id.toLowerCase())
      if (!ex) r.errors.push({ k: 'unknownId', v: { id } })
      else {
        r.mode = 'update'
        r.existing = ex
        if (!canUpdate) r.errors.push({ k: 'onlyManager', v: { id: ex.id } })
        if (ex.archived) r.errors.push({ k: 'archived', v: { id: ex.id } })
        if (ex.type !== type) r.errors.push({ k: 'otherType', v: { id: ex.id, type: ex.type } })
      }
    }
    if (r.mode === 'new') r.needs = cols.filter((c) => c.req && !d[c.key]).map((c) => c.key)
    for (const c of cols) {
      const v = d[c.key]
      if (!v || c.kind === 'id') continue
      if (c.kind === 'number') {
        if (isNaN(num(v))) r.errors.push({ k: 'notNumber', v: { col: c.key, value: v } })
        else if ((c.key === 'area' || c.key === 'price') && num(v) <= 0) r.errors.push({ k: 'notPositive', v: { col: c.key } })
      } else if (c.kind === 'select' && c.options) {
        const hit = c.options.find((x) => x.toLowerCase() === v.toLowerCase())
        if (hit) d[c.key] = hit
        else r.errors.push({ k: 'notAllowed', v: { col: c.key, value: v, options: c.options.join(' / ') } })
      } else if (c.kind === 'month' && !/^\d{4}-\d{2}$/.test(v)) r.errors.push({ k: 'month', v: { col: c.key } })
      else if (c.kind === 'list') {
        const list = amenityList(s)
        const unknown = v.split(/[;,]/).map((x) => x.trim()).filter(Boolean).filter((a) => !list.some((x) => norm(x) === norm(a)))
        if (unknown.length) r.warnings.push({ k: 'unknownAmenities', v: { list: unknown.join(', ') } })
      } else if (c.kind === 'approvals') {
        const items = v.split(';').map((x) => x.trim()).filter(Boolean)
        const unknown = items.filter((a) => !approvalId(a, s.approvalTypes))
        if (unknown.length) r.warnings.push({ k: 'unknownApprovals', v: { list: unknown.join(', ') } })
        if (items.length > unknown.length) r.notes.push({ k: 'approvalsPending', v: { count: items.length - unknown.length } })
      }
    }
    if (!!d.lat !== !!d.lng) r.warnings.push({ k: 'oneOfLatLng' })
    else if (d.lat && !isNaN(num(d.lat)) && !isNaN(num(d.lng))) r.notes.push({ k: 'exactFromLatLng' })
    // a blank title: the AI suggests one from what the row says
    if (r.mode === 'new' && !d.title && !r.errors.length) {
      r.suggestedTitle = suggestTitle(rowDraft(r, cols, type, s))
      if (r.suggestedTitle) r.notes.push({ k: 'titleSuggested', v: { title: r.suggestedTitle } })
    }
    const city = d.city || r.existing?.location.city
    if (d.locality && city && CITIES[city] && !CITIES[city].some((x) => norm(x) === norm(d.locality))) r.warnings.push({ k: 'newLocality', v: { locality: d.locality, city } })
    if (d.city && !d.locality && !CITIES[d.city]) r.warnings.push({ k: 'newCity', v: { city: d.city } })
    // same type and locality, similar size: probably a property we already have
    if (r.mode === 'new' && d.locality) {
      const area = num(d.area)
      const dup = db.properties.find((p) => !p.archived && p.type === type && norm(p.location.locality) === norm(d.locality) &&
        ((d.title && norm(p.title) === norm(d.title)) || (area > 0 && p.areaSqft > 0 && Math.abs(p.areaSqft - area) / p.areaSqft <= 0.1)))
      if (dup) r.warnings.push({ k: 'maybeDuplicate', v: { id: dup.id, title: dup.title } })
    }
    if (r.extra.length) r.notes.push({ k: 'keptExtra', v: { list: r.extra.map((x) => `${x.label} “${x.value}”`).join(', ') } })
    if (r.mode === 'update' && !r.errors.length && r.existing) {
      for (const c of cols) {
        if (c.kind === 'id' || !d[c.key]) continue
        const cur = currentValue(r.existing, c.key)
        const nv = valueFor(c, d[c.key], s)
        if (c.kind === 'approvals') {
          const added = (nv as string[]).filter((a) => !(cur as string[]).includes(a))
          if (added.length) r.changes.push({ key: c.key, from: undefined, to: added })
        } else if (JSON.stringify(cur ?? '') !== JSON.stringify(nv)) r.changes.push({ key: c.key, from: cur, to: nv })
      }
      for (const x of r.extra) {
        const cur = r.existing.extraDetails?.find((e) => norm(e.label) === norm(x.label))?.value
        if ((cur ?? '') !== x.value) r.changes.push({ key: x.label, from: cur, to: x.value, extra: true })
      }
      if (!r.changes.length) r.warnings.push({ k: 'noChanges' })
    }
    return r
  })
}

/** A new row as the assistant's draft — the same shape Add property saves, so a draft opens in the assistant as usual. */
export function rowDraft(r: ImpRow, cols: ImpCol[], type: PropertyTypeKey, s: Settings, source: FactSource = 'file'): Draft {
  const d = r.data
  const draft: Draft = { ...structuredClone(EMPTY_DRAFT), type, sources: { type: source } }
  const set = (key: string, apply: () => void) => { apply(); draft.sources![key] = source }
  for (const c of cols) {
    const v = d[c.key]
    if (!v || c.kind === 'id' || c.key === 'lat' || c.key === 'lng' || c.key === 'status') continue
    const val = valueFor(c, v, s)
    if (c.key.startsWith('spec:')) set(c.key, () => { draft.specs[c.key.slice(5)] = val as SpecValue })
    else if (c.key === 'area') set('area', () => { draft.areaSqft = val as number })
    else if (c.key === 'price') set('price', () => { draft.price = val as number })
    else if (c.key === 'purpose') set('purpose', () => { draft.purpose = val as Purpose })
    else if (c.key === 'facing') set('facing', () => { draft.facing = val as Facing })
    else if (c.key === 'amenities') set('amenities', () => { draft.amenities = val as string[] })
    else if (c.key === 'approvals') draft.approvals = val as string[]
    else if (c.key === 'title' || c.key === 'city' || c.key === 'locality') set(c.key, () => { (draft as Record<string, unknown>)[c.key] = val })
  }
  // a file without a purpose column: sale, the usual one (the team can change it)
  if (!draft.purpose) { draft.purpose = PROPERTY_TYPES[type].purposes[0]; draft.sources!.purpose = 'auto' }
  if (!draft.title) { draft.title = suggestTitle(draft); if (draft.title) draft.sources!.title = 'ai' }
  draft.exactLocation = !!(d.lat && d.lng && !isNaN(num(d.lat)) && !isNaN(num(d.lng)))
  draft.photos = r.photos
  if (r.extra.length) draft.extraDetails = r.extra.map((x) => ({ label: x.label, value: x.value }))
  return draft
}

/** A new property from a row. Ready rows are listed by a manager; an executive's go for approval; incomplete rows are drafts. */
export function rowToProperty(r: ImpRow, cols: ImpCol[], type: PropertyTypeKey, s: Settings, o: { id: string; by: string; at: string; manager: boolean; ai: boolean }): Property {
  const d = rowDraft(r, cols, type, s, o.ai ? 'ai' : 'file')
  const ready = rowStatus(r) === 'new'
  const p = draftToProperty(d, o.id, o.by, o.at, ready && o.manager ? (STATUSES.includes(r.data.status as PropertyStatus) ? r.data.status as PropertyStatus : 'available') : 'draft')
  if (d.exactLocation) { p.location.lat = num(r.data.lat); p.location.lng = num(r.data.lng) }
  if (ready && !o.manager) p.submitted = { by: o.by, at: o.at }
  // a draft opens in the assistant with what's left to do: what the AI wasn't sure of, then the next question
  if (p.status === 'draft' && !p.submitted) {
    // what the file already gave isn't asked again: photos, amenities
    const passed: OptionalStep[] = [...(d.photos ? ['photos' as const] : []), ...(d.amenities.length ? ['amenities' as const] : [])]
    const step = nextStep(d, passed)
    p.assistant = {
      passed,
      dupChecked: true,
      chat: [
        { id: 0, from: 'ai', kind: 'text', key: 'imp.ai.fromFile' },
        ...(r.confirm.length ? [{ id: 1, from: 'ai' as const, kind: 'text' as const, key: 'imp.ai.confirm', values: { what: r.confirm.map((x) => x.v?.what ?? '').join('; ') } }] : []),
        { id: 2, ...(step.kind === 'ask' ? { from: 'ai' as const, kind: 'ask' as const, q: step.q } : { from: 'ai' as const, kind: step.kind }) },
      ],
    }
  }
  return p
}

/** Write an update row onto the stored property: only the filled cells. New approvals start as "document pending". */
export function applyUpdate(p: Property, r: ImpRow, cols: ImpCol[], s: Settings) {
  const d = r.data
  for (const c of cols) {
    const v = d[c.key]
    if (!v || c.kind === 'id') continue
    const val = valueFor(c, v, s)
    if (c.key.startsWith('spec:')) p.specs[c.key.slice(5)] = val as SpecValue
    else switch (c.key) {
      case 'title': p.title = String(val); break
      case 'purpose': p.purpose = val as Purpose; break
      case 'status': p.status = val as PropertyStatus; break
      case 'city': p.location.city = String(val); break
      case 'locality': p.location.locality = String(val); break
      case 'facing': p.facing = val as Facing; break
      case 'area': p.areaSqft = val as number; break
      case 'price': p.price = val as number; break
      case 'lat': case 'lng': break
      case 'amenities': p.amenities = val as string[]; break
      case 'approvals': for (const a of val as string[]) if (!p.approvals.some((x) => x.approvalId === a)) p.approvals.push({ approvalId: a, status: 'pending' }); break
    }
    const sk = c.key === 'lat' || c.key === 'lng' ? '' : c.key
    if (sk && sk !== 'approvals') p.sources = { ...p.sources, [sk]: 'file' }
  }
  if (d.lat && d.lng && !isNaN(num(d.lat)) && !isNaN(num(d.lng))) { p.location.lat = num(d.lat); p.location.lng = num(d.lng); p.location.exact = true }
  for (const x of r.extra) {
    p.extraDetails = p.extraDetails ?? []
    const e = p.extraDetails.find((y) => norm(y.label) === norm(x.label))
    if (e) e.value = x.value
    else p.extraDetails.push({ label: x.label, value: x.value })
  }
}

/* ---------- the record of each import ---------- */

export type ImportBatch = {
  id: string
  at: string
  by: string
  type: PropertyTypeKey
  file: string
  sender?: string
  total: number
  /** Listed straight away (a manager's ready rows). */
  created: string[]
  /** An executive's ready rows, waiting for a manager. */
  pending: string[]
  /** Rows missing a detail, or that the AI wasn't sure of: drafts the assistant finishes. */
  drafts: string[]
  updated: string[]
  skipped: number
}

/* ---------- samples to try ---------- */

/** Our template, filled in — with a few mistakes on purpose, so the Check screen has something to show. */
export function templateSample(type: PropertyTypeKey, cols: ImpCol[], db: Database): string[][] {
  const head = cols.map((c) => c.heading)
  const row = (o: Record<string, string>) => cols.map((c) => o[c.key] ?? '')
  if (type === 'plot') {
    const base = { purpose: 'sale', status: 'available', city: 'Madurai', 'spec:roadAccess': 'Layout road', 'spec:corner': 'Non-corner', 'spec:topography': 'Level', 'spec:landUse': 'Residential', 'spec:water': 'Municipal supply', 'spec:electricity': 'Available at site', 'spec:drainage': 'Underground drainage', 'spec:roadInfra': 'Tar road' }
    return [head,
      row({ ...base, title: 'Corner plot near Kochadai', locality: 'Thirunagar', facing: 'N', area: '1500', price: '33,00,000', lat: '9.8890', lng: '78.0580', amenities: 'Park / open space', 'spec:length': '50', 'spec:width': '30', 'spec:roadWidth': '30', 'spec:corner': 'Corner', 'spec:surveyNo': '14/2', approvals: 'DTCP' }),
      row({ ...base, title: 'Compact plot, Othakadai east', locality: 'Othakadai', facing: 'E', area: '1000', price: '2200000', 'spec:length': '40', 'spec:width': '25', 'spec:roadWidth': '24', 'spec:water': 'Borewell' }),
      row({ ...base, title: '', locality: 'Kalavasal', facing: 'E', area: '1200', price: '2700000', 'spec:length': '40', 'spec:width': '30', 'spec:roadWidth': '30' }),
      row({ ...base, title: 'Plot behind the bus depot', locality: 'Kappalur', facing: 'S', area: '1100', price: '1800000', 'spec:roadWidth': '20' }),
      row({ id: 'PROP-1012', price: '3000000' }),
      row({ ...base, title: 'Plot near ring road junction', locality: 'Ponmeni', facing: 'E', area: '1200', price: '', 'spec:length': '40', 'spec:width': '30' }),
      row({ ...base, title: 'Plot with odd facing', locality: 'Ponmeni', facing: 'Eastern', area: '1200', price: '2600000', 'spec:length': '40', 'spec:width': '30' }),
      row({ id: 'PROP-9999', title: 'Unknown reference', price: '2500000' }),
      row({ ...base, title: 'Plot in Salem outskirts', city: 'Salem', locality: 'Omalur', facing: 'W', area: 'abc', price: '1500000' }),
      row({ ...base, title: 'Premium plot, Vilangudi', locality: 'Vilangudi', facing: 'E', area: '1250', price: '2900000', amenities: 'Security;Helipad', 'spec:length': '50', 'spec:width': '25' }),
    ]
  }
  // other types: a ready row, an update of one we have, and a row with mistakes
  const def = PROPERTY_TYPES[type]
  const spec: Record<string, string> = {}
  for (const f of def.facts) spec[`spec:${f.key}`] = f.kind === 'select' ? f.options![0] : f.kind === 'number' ? '2' : f.kind === 'month' ? '2027-06' : 'Sample'
  const existing = db.properties.find((p) => p.type === type && !p.archived && p.status !== 'draft')
  const city = 'Coimbatore'
  const rows = [
    row({ ...spec, title: `New ${def.label.toLowerCase()} (sample)`, purpose: def.purposes[0], status: 'available', city, locality: CITIES[city][1], facing: 'E', area: '1400', price: '9500000' }),
    ...(existing ? [row({ id: existing.id, price: String(Math.round(existing.price * 1.02)) })] : []),
    row({ ...spec, city, locality: CITIES[city][0], facing: 'Sideways', area: '900', price: '7000000', [`spec:${def.facts[0].key}`]: def.facts[0].kind === 'select' ? 'Not an option' : spec[`spec:${def.facts[0].key}`] }),
  ]
  return [head, ...rows]
}

/** An owner's own sheet: a title above the headings, other names for columns, lakh prices, units in the cells, a total row. */
export const OWNER_SHEET: string[][] = [
  ['ABC Realty – Plot list, November 2026'], ['Prepared for the sales team'], [],
  ['Plot Name', 'Area Name', 'Town', 'Plot Size', 'Rate', 'Facing', 'Length', 'Breadth', 'Road', 'Survey No', 'Approval', 'Contact person', 'Owner remarks'],
  ['Sunrise Nagar plot', 'Vilangudi', 'Madurai', '1100 sqft', '30 L', 'East', '40', '27.5', '30 ft', '112/3', 'DTCP', 'Mr. Kumar', 'Clear title, ready to register'],
  ['', 'Thirunagar', 'Madurai', '1,500', '36 lakhs', 'North', '50', '30', '40 ft', '', 'DTCP', '', ''],
  ['Corner plot near temple', 'Anna Nagar', 'Madurai', '1350', '31,00,000', 'North-East', '45', '30', '', '61/4', '', 'Mrs. Latha', 'Price slightly negotiable'],
  ['Budget plot', 'Othakadai', 'Madurai', '1000', '18 L', 'South', '', '', '20 ft', '', '', '', ''],
  ['Total: 4 plots'],
]

/** What the AI reads from a sample brochure or a photo of a "For sale" board (the wireframe's stand-in for the real AI). */
export function docSample(kind: 'pdf' | 'image'): DocRead {
  if (kind === 'image') return {
    kind: 'image', pages: 1, type: 'plot', what: 'photo',
    items: [{
      page: 1, photos: 1, quote: 'PLOT FOR SALE · 30 × 40 · EAST FACING · THIRUPARANKUNDRAM · 24 L · CALL 98XXX XXXXX',
      f: { city: 'Madurai', locality: 'Thiruparankundram', facing: 'East', 'spec:width': '30', 'spec:length': '40', area: '1200', price: '24 L' },
      notes: [{ k: 'cityFromLocality', v: { locality: 'Thiruparankundram', city: 'Madurai' } }, { k: 'areaFromSize', v: { size: '30 × 40 ft' } }, { k: 'photoKept' }],
      extra: [{ label: 'Phone on the board', value: '98XXX XXXXX' }],
    }],
  }
  const common = { city: 'Madurai', locality: 'K.K. Nagar', 'spec:totalFloors': '5', 'spec:possession': 'Under construction', 'spec:possessionDate': 'December 2027', amenities: 'Lift;Power backup;Gym;Security;CCTV', approvals: 'RERA' }
  const extra = [{ label: 'Builder', value: 'Green Homes Pvt. Ltd.' }, { label: 'RERA number', value: 'TN/35/Building/0123/2026' }]
  const floors: Issue = { k: 'readAs', v: { from: 'G + 4 floors', to: '5' } }
  return {
    kind: 'pdf', pages: 8, type: 'flat', what: 'brochure',
    items: [
      { page: 3, photos: 4, quote: '2 BHK · 1,150 sq.ft. (carpet 920 sq.ft.) · ₹68 Lakhs onwards', f: { ...common, title: 'Green Meadows — 2 BHK', 'spec:bhk': '2 BHK', 'spec:floor': '2', area: '1150', 'spec:carpet': '920', price: '68 Lakhs' }, notes: [floors], confirm: [{ k: 'onwards', v: { what: '“₹68 Lakhs onwards”' } }], extra },
      { page: 3, photos: 4, quote: '3 BHK · 1,480 sq.ft. (carpet 1,190 sq.ft.) · ₹89 Lakhs onwards', f: { ...common, title: 'Green Meadows — 3 BHK', 'spec:bhk': '3 BHK', area: '1480', 'spec:carpet': '1190', price: '89 Lakhs' }, notes: [floors], confirm: [{ k: 'onwards', v: { what: '“₹89 Lakhs onwards”' } }], extra },
      { page: 4, photos: 3, quote: '3 BHK Premium, east-facing · 1,720 sq.ft. · ₹1.05 Cr · 4th floor', f: { ...common, title: 'Green Meadows — 3 BHK Premium', 'spec:bhk': '3 BHK', facing: 'East', 'spec:floor': '4', area: '1720', price: '1.05 Cr' }, notes: [floors], extra },
    ],
  }
}

/** The AI's items → rows with headings, so a brochure goes through the same Check screen as a sheet. */
export function docToRows(doc: DocRead): { rows: string[][]; extraLabels: string[] } {
  const keys = [...new Set(doc.items.flatMap((it) => Object.keys(it.f)))]
  const extraLabels = [...new Set(doc.items.flatMap((it) => (it.extra ?? []).map((x) => x.label)))]
  return {
    rows: [[...keys, ...extraLabels], ...doc.items.map((it) => [...keys.map((k) => it.f[k] ?? ''), ...extraLabels.map((l) => it.extra?.find((x) => x.label === l)?.value ?? '')])],
    extraLabels,
  }
}
