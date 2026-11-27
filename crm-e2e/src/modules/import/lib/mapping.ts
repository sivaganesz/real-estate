/**
 * Column mapping (master prompt §15.2). Each heading is matched to a CRM field, in this order of trust:
 *   saved (this sender's mapping, saved earlier) → template (our own heading) → synonym (exact, then a contained phrase)
 *   → fuzzy (a near spelling) → value (no heading match; the sample values decide: phones, e-mails, "Cr"/"L", BHK, RERA…).
 * Ambiguous headings are settled by their values ("Area" with numbers is a size, with names a locality). Each field is
 * used once, by the most confident column. Unmatched columns stay unmapped and are kept as extra details on import.
 * Pure; unit-tested.
 */
import type { ColumnMapping, MappingProfile } from '@/domain/types'
import { fieldsFor, type FieldDef, type SheetKind, type ValueKind } from './fields'
import { TEMPLATES } from './templates'
import { cellText, isBlank, isOk, readArea, readConfig, readDate, readEmail, readFacing, readPhone, readPrice, type Cell } from './values'

export const SKIP_FIELD = '__skip'

/** "Price (₹)" → "price", "Carpet (sft)" → "carpet sft", "Property name *" → "property name". */
export function normHeader(h: string): string {
  return h.toLowerCase().replace(/₹|\b(rs|inr)\b\.?/g, ' ').replace(/[_./()[\]\-*:#?'"]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

type Candidate = { col: number; field: string; confidence: number; method: ColumnMapping['method'] }

const wordIn = (hay: string, needle: string) => ` ${hay} `.includes(` ${needle} `)

/** How a heading matches a field by its words (no values). */
function headingMatch(h: string, f: FieldDef): { confidence: number; method: 'synonym' | 'fuzzy' } | null {
  let best: { confidence: number; method: 'synonym' | 'fuzzy' } | null = null
  const consider = (c: number, m: 'synonym' | 'fuzzy') => { if (!best || c > best.confidence) best = { confidence: c, method: m } }
  for (const w of f.synonyms) {
    if (h === w) consider(0.95, 'synonym')
    else if (w.length > 2 && wordIn(h, w)) consider(Math.min(0.9, 0.72 + w.length / 60), 'synonym')
    else if (w.length > 4 && h.length > 4) {
      const d = editDistance(h, w)
      if (d <= 2) consider(d === 1 ? 0.78 : 0.66, 'fuzzy')
    }
  }
  return best
}

const SAMPLE = 12
const nonBlank = (values: Cell[]) => values.filter((v) => !isBlank(v)).slice(0, SAMPLE)
const share = (values: Cell[], test: (v: Cell) => boolean) => (values.length ? values.filter(test).length / values.length : 0)
const numericish = (v: Cell) => typeof v === 'number' || /^\s*[\d,.]+\s*$/.test(cellText(v))
const RERA_RE = /rera|^[a-z]{2,4}\/[a-z]{2}\/|^p\d{8,}/i

/** Share of sample values a field can read (1 = all of them). Text fields accept anything that is not a bare number. */
export function valueFit(kind: ValueKind, values: Cell[]): number {
  const v = nonBlank(values)
  if (!v.length) return 0.5
  switch (kind) {
    case 'phone': return share(v, (x) => isOk(readPhone(x)))
    case 'email': return share(v, (x) => isOk(readEmail(x)))
    case 'price': return share(v, (x) => isOk(readPrice(x, 1000)) || /call|request/i.test(cellText(x)))
    case 'area': case 'dimensions': return share(v, (x) => isOk(readArea(x)))
    case 'int': return share(v, (x) => typeof x === 'number' || /^(ground|g|\d+)/i.test(cellText(x)))
    case 'config': case 'configs': return share(v, (x) => isOk(readConfig(String(cellText(x)).split(/[,/]/)[0])))
    case 'facing': return share(v, (x) => isOk(readFacing(x)))
    case 'date': return share(v, (x) => isOk(readDate(x)))
    case 'city': case 'cities': case 'locality': case 'localities':
      return 1 - share(v, numericish)
    default: return 1
  }
}

/** A column with no heading match: what do its values look like? */
function sniff(values: Cell[], fields: FieldDef[]): { field: string; confidence: number } | null {
  const v = nonBlank(values)
  if (v.length < 1) return null
  const has = (k: string) => fields.some((f) => f.key === k)
  const all = (test: (x: Cell) => boolean) => share(v, test) >= 0.8
  if (all((x) => isOk(readPhone(x)))) return has('phone') ? { field: 'phone', confidence: 0.75 } : has('owner.phone') ? { field: 'owner.phone', confidence: 0.7 } : null
  if (all((x) => isOk(readEmail(x))) && has('email')) return { field: 'email', confidence: 0.8 }
  if (all((x) => /\d\s*(cr|crores?|l|lakhs?|lacs?)\b/i.test(cellText(x)))) return has('price') ? { field: 'price', confidence: 0.72 } : { field: 'requirement.budgetMax', confidence: 0.7 }
  if (all((x) => /\d\s*(bhk|rk)\b/i.test(cellText(x)))) return has('configuration') ? { field: 'configuration', confidence: 0.75 } : has('requirement.configurations') ? { field: 'requirement.configurations', confidence: 0.75 } : null
  if (all((x) => RERA_RE.test(cellText(x))) && has('rera.number')) return { field: 'rera.number', confidence: 0.7 }
  if (all((x) => /sq\.?\s*ft|sft|sqft|cents?|acres?|\d+\s*x\s*\d+/i.test(cellText(x)))) {
    const f = ['area.carpet', 'area.superBuiltUp', 'area.builtUp', 'area.plot'].find(has)
    return f ? { field: f, confidence: 0.65 } : null
  }
  if (all((x) => isOk(readFacing(x))) && has('facing')) return { field: 'facing', confidence: 0.7 }
  return null
}

export type AutoMapOptions = { profile?: Pick<MappingProfile, 'columns'> | null }

/** Maps every heading. `columns[i]` are the sample values of column i. */
export function autoMap(headers: string[], columns: Cell[][], kind: SheetKind, opts: AutoMapOptions = {}): ColumnMapping[] {
  const fields = fieldsFor(kind)
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const template = new Map(TEMPLATES[kind].columns.map((c) => [normHeader(c.header), c.field]))
  const fixed = new Map<number, ColumnMapping>()
  const candidates: Candidate[] = []

  headers.forEach((header, col) => {
    const h = normHeader(header)
    const saved = opts.profile?.columns[header]
    if (saved !== undefined) {
      fixed.set(col, { column: header, field: saved === SKIP_FIELD || !byKey.has(saved) ? null : saved, confidence: saved === SKIP_FIELD ? 0 : 0.98, method: 'saved' })
      return
    }
    const tf = template.get(h)
    if (tf && byKey.has(tf)) { candidates.push({ col, field: tf, confidence: 1, method: 'template' }); return }
    for (const f of fields) {
      if (normHeader(f.key) === h) { candidates.push({ col, field: f.key, confidence: 0.95, method: 'synonym' }); continue }
      const m = headingMatch(h, f)
      if (!m) continue
      // the values settle ambiguous headings: a heading match whose values do not fit loses confidence or is dropped
      const fit = valueFit(f.value, columns[col] ?? [])
      const confidence = m.confidence * (fit >= 0.7 ? 1 : fit >= 0.4 ? 0.8 : 0.45)
      if (confidence >= 0.45) candidates.push({ col, field: f.key, confidence: Math.round(confidence * 100) / 100, method: m.method })
    }
  })

  // the most confident pairs win; a field and a column are used once
  const usedFields = new Set([...fixed.values()].map((m) => m.field).filter((f): f is string => !!f))
  const result = new Map<number, ColumnMapping>(fixed)
  for (const c of candidates.sort((a, b) => b.confidence - a.confidence || a.col - b.col)) {
    if (result.has(c.col) || usedFields.has(c.field)) continue
    result.set(c.col, { column: headers[c.col], field: c.field, confidence: c.confidence, method: c.method })
    usedFields.add(c.field)
  }
  headers.forEach((header, col) => {
    if (result.has(col)) return
    const s = sniff(columns[col] ?? [], fields.filter((f) => !usedFields.has(f.key)))
    if (s) { usedFields.add(s.field); result.set(col, { column: header, field: s.field, confidence: s.confidence, method: 'value' }) }
    else result.set(col, { column: header, field: null, confidence: 0, method: 'manual' })
  })
  return headers.map((_, col) => result.get(col)!)
}

/**
 * What the mapping still lacks: required fields with no column (a "set for all" value can fill them). A property's city
 * is not missing when the locality is mapped: each row's city is worked out from its locality.
 */
export function missingRequired(mapping: ColumnMapping[], kind: SheetKind, defaults: Record<string, string> = {}): string[] {
  const used = new Set(mapping.map((m) => m.field).filter(Boolean))
  const inferred = kind !== 'leads' && used.has('location.locality') ? ['location.city'] : []
  return fieldsFor(kind).filter((f) => f.required && !used.has(f.key) && !inferred.includes(f.key) && !defaults[f.key]?.trim()).map((f) => f.key)
}

/** Counts per method (for the "matched by" chips). */
export function methodCounts(mapping: ColumnMapping[]): Record<ColumnMapping['method'] | 'unmapped', number> {
  const out = { template: 0, saved: 0, synonym: 0, fuzzy: 0, value: 0, manual: 0, unmapped: 0 }
  for (const m of mapping) { if (!m.field) out.unmapped++; else out[m.method]++ }
  return out
}

/** A mapping as a saved profile: heading → field (or skip). */
export const mappingToProfileColumns = (mapping: ColumnMapping[]): Record<string, string> =>
  Object.fromEntries(mapping.map((m) => [m.column, m.field ?? SKIP_FIELD]))

/** The saved profile that fits these headings best (most of its headings present), if any covers half of them. */
export function bestProfile<T extends Pick<MappingProfile, 'columns' | 'kind'>>(profiles: T[], headers: string[], kind: SheetKind): T | undefined {
  const set = new Set(headers)
  let best: { p: T; score: number } | undefined
  for (const p of profiles.filter((x) => x.kind === kind)) {
    const keys = Object.keys(p.columns)
    const hit = keys.filter((k) => set.has(k)).length
    const score = hit / Math.max(keys.length, headers.length)
    if (score >= 0.5 && (!best || score > best.score)) best = { p, score }
  }
  return best?.p
}

/** Average confidence of the mapped columns (0–1). */
export const mappingConfidence = (mapping: ColumnMapping[]) => {
  const mapped = mapping.filter((m) => m.field)
  return mapped.length ? mapped.reduce((n, m) => n + m.confidence, 0) / mapped.length : 0
}
