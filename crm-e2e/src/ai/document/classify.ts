/**
 * What a document is about, before the field extraction runs: a buyer (a visiting card, a handwritten requirement, an
 * enquiry) or a property (a brochure, a price sheet, an owner's listing). Rule-based and explainable: it counts
 * signal words and says which ones it found. Also splits a brochure's unit table into one entry per unit type.
 * Pure; unit-tested.
 */

const PROPERTY_SIGNALS: [RegExp, number][] = [
  [/\brera\b/i, 3], [/\bonwards\b/i, 2], [/\bamenit(y|ies)\b/i, 2], [/\bclubhouse|swimming pool|gym\b/i, 1],
  [/\bpossession\b/i, 1], [/\bbuilders?|developers?|construction|realty|infra\b/i, 2], [/\bprice list|unit types?|floor plans?\b/i, 3],
  [/\bsuper built.?up|carpet area|saleable|sba\b/i, 2], [/\bfor sale|selling|resale|to sell|expected price|expecting\b/i, 2],
  [/\bapproved|approvals?|bbmp|cmda|dtcp|hmda|bda\b/i, 2], [/\bsite office|launch|towers?|acres?\b/i, 1], [/\bvastu|east facing|facing\b/i, 1],
]
const LEAD_SIGNALS: [RegExp, number][] = [
  [/\blooking for|need(s|ed)?\b|\brequire(ment|d)?\b|\bwants?\b|\binterested\b/i, 3], [/\bbudget\b/i, 3],
  [/\bname\s*[:-]/i, 2], [/\b(manager|engineer|director|consultant|executive|founder|ceo|cto|vp|officer|analyst)\b/i, 2],
  [/\bltd\.?|pvt\.?|technologies|infosys|tcs|wipro|accenture\b/i, 1], [/\bcall (me|after)|prefers?|whatsapp me\b/i, 2],
  [/\bwithin \d+ months?|ready to move in\b/i, 1], [/\bloan|pre.?approved\b/i, 1], [/\bfamily|kids|school\b/i, 1],
]

export type KindGuess = { kind: 'lead' | 'property'; confidence: number; signals: string[] }

export function guessRecordKind(text: string): KindGuess {
  const hits = (list: [RegExp, number][]) => list.flatMap(([re, w]) => { const m = re.exec(text); return m ? [{ word: m[0].toLowerCase(), w }] : [] })
  const p = hits(PROPERTY_SIGNALS)
  const l = hits(LEAD_SIGNALS)
  const ps = p.reduce((n, h) => n + h.w, 0)
  const ls = l.reduce((n, h) => n + h.w, 0)
  if (!ps && !ls) return { kind: 'lead', confidence: 0.5, signals: [] }
  const kind = ps > ls ? 'property' : 'lead'
  const top = Math.max(ps, ls)
  const confidence = Math.round(Math.min(0.97, 0.5 + (Math.abs(ps - ls) / (ps + ls)) * 0.45 + Math.min(top, 10) / 100) * 100) / 100
  return { kind, confidence, signals: [...new Set((kind === 'property' ? p : l).map((h) => h.word))].slice(0, 5) }
}

/** A unit row starts with its configuration (a table row or a list item), not a BHK mentioned mid-sentence. */
const UNIT_LINE = /^\W*(\d(?:\.5)?)\s*(bhk|rk)\b/i
const HAS_SIZE_OR_PRICE = /(\d[\d,]*\s*(sq\.?\s*ft|sft|sqft))|(\d+(\.\d+)?\s*(cr|crores?|l|lakhs?|lacs?)\b)|₹|rs\.?\s*\d/i

/**
 * A brochure lists several unit types ("2 BHK · 1,265 sq ft · Rs. 98 Lakhs onwards"). Each becomes its own text: the
 * shared part of the document (project, place, RERA, amenities) plus that one unit line. One unit (or none) → [text].
 */
export function splitUnits(text: string): { label: string; text: string; header?: string }[] {
  const lines = text.split(/\r?\n/)
  const unitIdx = lines.map((l, i) => (UNIT_LINE.test(l) && HAS_SIZE_OR_PRICE.test(l) ? i : -1)).filter((i) => i >= 0)
  const configs = new Set(unitIdx.map((i) => UNIT_LINE.exec(lines[i])![1]))
  if (unitIdx.length < 2 || configs.size < 2) return [{ label: '', text }]
  // the table's heading row ("Configuration  Super built-up area  Price") says which area the numbers are
  const header = lines.slice(Math.max(0, unitIdx[0] - 2), unitIdx[0]).reverse().find((l) => /area|size|price|carpet|built/i.test(l))?.trim()
  const shared = lines.filter((_, i) => !unitIdx.includes(i))
    // other BHK mentions in the shared text would compete with the unit's own
    .map((l) => l.replace(/\b\d(?:\.5)?\s*(?:and|&|,|\/)\s*\d(?:\.5)?\s*bhk\b/gi, '').replace(/\b\d(?:\.5)?\s*bhk\b/gi, ''))
    .join('\n')
  return unitIdx.map((i) => ({ label: lines[i].trim(), text: `${lines[i].trim()}\n${shared}`, header }))
}
