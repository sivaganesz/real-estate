/**
 * Documents → records (master prompt §15.3): the AI extraction becomes the same text values the sheet import reads, is
 * checked by the same rules, and decides between "save" and "keep as a Draft" (uncertain or incomplete). OCR doubt
 * lowers every field's confidence, so a blurry photo highlights more fields. Pure; unit-tested.
 */
import type { Draft, FieldMetaMap, PropertyInput } from '@/domain/types'
import type { DraftInputLikePublic } from './plan'
import { buildLead, buildProperty, kindForType, payloadToValues, type Issue, type LeadRecord } from './rows'
import { LOW_CONFIDENCE, lowFields } from './stats'
import { isOk, readArea, readConfig, readDate, readPrice, readPropertyType } from './values'

export type RecordKind = 'lead' | 'property'
export type DocEntry = { label: string; values: Record<string, string>; meta: FieldMetaMap }
export type CheckedEntry = { issues: Issue[]; blocking: Issue[]; lead?: LeadRecord; property?: PropertyInput; low: string[]; complete: boolean }

/** Map an extraction's field paths onto the form's fields (e.g. requirement.budgetMax stays, area.carpet stays). */
export function entryFromExtraction(kind: RecordKind, fields: Record<string, unknown>, meta: FieldMetaMap, opts: { label?: string; ocrConfidence?: number; sourceText?: string } = {}): DocEntry {
  const values = payloadToValues(kind, fields)
  // OCR doubt carries into every field read from that text
  const factor = opts.ocrConfidence == null ? 1 : Math.min(1, 0.4 + opts.ocrConfidence * 0.6)
  const m: FieldMetaMap = {}
  for (const [k, v] of Object.entries(meta)) {
    const key = kind === 'lead' && k === 'requirement.budget' ? 'requirement.budgetMax' : k
    m[key] = { ...v, confidence: Math.round((v.confidence ?? 1) * factor * 100) / 100 }
  }
  if (kind === 'lead' && opts.sourceText && !values.notes) values.notes = opts.sourceText.trim().slice(0, 600)
  return { label: opts.label ?? '', values, meta: m }
}

export function checkEntry(kind: RecordKind, e: DocEntry): CheckedEntry {
  const built = kind === 'lead' ? buildLead(e.values) : buildProperty(e.values, kindForType(typeOf(e.values)))
  const blocking = built.issues.filter((i) => i.level !== 'warning')
  const low = lowFields(e.meta).filter((f) => e.values[f])
  return {
    issues: built.issues, blocking, low, complete: blocking.length === 0,
    ...(kind === 'lead' ? { lead: built.record as LeadRecord } : { property: built.record as PropertyInput }),
  }
}

const typeOf = (values: Record<string, string>) => {
  const r = readPropertyType(values.type ?? '')
  return isOk(r) ? r.ok : undefined
}

/** Should this go to Drafts rather than straight in? Incomplete, a doubtful field, or a poor scan. */
export const isUncertain = (c: CheckedEntry, ocrConfidence?: number) => !c.complete || c.low.length > 0 || (ocrConfidence != null && ocrConfidence < LOW_CONFIDENCE)

/** A Draft for an entry: its payload is what the checks could read (partial), its fieldMeta the confidences. */
export function entryDraft(kind: RecordKind, e: DocEntry, c: CheckedEntry, source: DraftInputLikePublic['source'], fallbackTitle: string): DraftInputLikePublic {
  const payload = (kind === 'lead' ? c.lead : c.property) as Record<string, unknown> | undefined
  const title = kind === 'lead' ? c.lead?.name || fallbackTitle : c.property?.title || fallbackTitle
  return { kind, title, payload: payload ?? {}, fieldMeta: e.meta, source }
}

/** What a draft still lacks (lead / property only), by the same checks as the import. */
export function draftGaps(d: Pick<Draft, 'kind' | 'payload' | 'fieldMeta'>): number {
  if (d.kind === 'appointment') return 0
  return checkEntry(d.kind, { label: '', values: payloadToValues(d.kind, d.payload), meta: d.fieldMeta }).blocking.length
}

/**
 * Plain-text tidying before extraction: OCR leaves blank lines between every line, and a visiting card starts with
 * the person's name without saying so. A first line of two to four words, letters only, is marked "Name: … ." (the full stop keeps the next line out of the name).
 */
export function prepareText(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length && !/\bname\s*[:-]/i.test(text) && /^[A-Za-z][A-Za-z.'-]*(\s+[A-Za-z][A-Za-z.'-]*){1,3}$/.test(lines[0])) lines[0] = `Name: ${lines[0]}.`
  return lines.join('\n')
}

type Unit = { line: string; header?: string }
const setAi = (e: DocEntry, field: string, value: string, confidence: number) => {
  e.values[field] = value
  e.meta[field] = { origin: 'ai', confidence }
}
const moneyText = (n: number) => (n >= 10_000_000 ? `${+(n / 10_000_000).toFixed(4)} Cr` : `${+(n / 100_000).toFixed(2)} L`)

/**
 * Brochure facts the general extractor can miss, read with the import's own readers:
 *  - a unit row ("2 BHK  1,265 sq ft  Rs. 98 Lakhs onwards") gives its configuration, its area (of the kind the table
 *    heading names: super built-up, carpet, built-up) and its price;
 *  - a configuration means a home, not an office ("Site office" in the footer is not the property type);
 *  - the brochure's first line is usually the project; "ready by December 2027" is a possession date;
 *  - a title is made from the project and the unit when the extractor was unsure.
 */
export function refineProperty(entry: DocEntry, text: string, unit?: Unit): DocEntry {
  const e: DocEntry = { ...entry, values: { ...entry.values }, meta: { ...entry.meta } }
  if (unit?.line) {
    const parts = unit.line.split(/\s{2,}|\t|\s[·|]\s/).map((p) => p.trim()).filter(Boolean)
    const cfg = readConfig(parts[0] ?? '')
    if (isOk(cfg)) setAi(e, 'configuration', cfg.ok, 0.92)
    const areaPart = parts.find((p) => /sq\.?\s*ft|sft|sqft|sq\.?\s*yd|cents?|acres?/i.test(p))
    const area = areaPart ? readArea(areaPart) : null
    if (area && isOk(area)) {
      const h = unit.header?.toLowerCase() ?? ''
      const key = /super|saleable|sba/.test(h) ? 'area.superBuiltUp' : /carpet/.test(h) ? 'area.carpet' : /built/.test(h) ? 'area.builtUp' : 'area.superBuiltUp'
      for (const k of ['area.carpet', 'area.builtUp', 'area.superBuiltUp']) {
        if (k !== key && e.meta[k]?.origin === 'ai') { delete e.values[k]; delete e.meta[k] }
      }
      setAi(e, key, String(area.ok.sqft), 0.9)
    }
    const pricePart = parts.find((p) => /\d/.test(p) && /(cr\b|crore|lakh|lac|\bl\b|rs\.?|₹)/i.test(p))
    const price = pricePart ? readPrice(pricePart.replace(/onwards|starting|from/gi, '').trim()) : null
    if (price && isOk(price)) setAi(e, 'price', moneyText(price.ok), 0.9)
  }
  const type = readPropertyType(e.values.type ?? '')
  if (e.values.configuration && (!isOk(type) || !['apartment', 'villa', 'independentHouse', 'rowHouse'].includes(type.ok))) {
    setAi(e, 'type', /villa/i.test(text) ? 'villa' : 'apartment', 0.8)
  }
  const first = text.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  if (!e.values.projectName && first && first.split(/\s+/).length <= 5 && !/\d/.test(first)) setAi(e, 'projectName', first, 0.7)
  const by = /(?:ready|possession|handover|completion)[^.\n]{0,40}?\b(?:by|in|from)\s+([A-Za-z]{3,9}\.?\s+\d{4})/i.exec(text.replace(/\n/g, ' '))
  const date = by ? readDate(by[1].replace('.', '')) : null
  if (date && isOk(date)) {
    setAi(e, 'possession.status', 'underConstruction', 0.8)
    setAi(e, 'possession.date', date.ok, 0.8)
  }
  const cfgText = e.values.configuration ? e.values.configuration.replace('BHK', ' BHK') : ''
  if (e.values.projectName && (!e.values.title || (e.meta.title?.confidence ?? 1) < 0.75)) setAi(e, 'title', `${e.values.projectName} ${cfgText}`.trim(), 0.8)
  return e
}
