/**
 * Reading one cell the way people write it in Indian property sheets (origin/feat/estate-platform docs/02-bulk-import
 * "messy sheets are expected"): "1.2 Cr", "85 L", "₹45,00,000", "Call"; "1,200 sqft", "3 cents", "30x40"; "Ground",
 * "3rd"; "E", "North-East"; Excel serial dates; "Ready", "Dec 2027"; portal names as lead sources. Pure.
 * Each reader returns { ok: value } or { issue: key } (an i18n key under `import:issue.*`), never throws.
 */
import type { AreaUnit, Configuration, Facing, Furnishing, LeadSource, PropertyType, Timeline } from '@/domain/types'
import { CITIES, CITY_NAMES, LEAD_SOURCES, SQFT_PER_UNIT, TIMELINES, cityOfLocality } from '@/domain/catalogue'
import { CRORE, LAKH } from '@/lib/amount'
import { isEmail } from '@/lib/validation'
import { toE164 } from '@/lib/phone'

export type Read<T> = { ok: T; warn?: string } | { issue: string; params?: Record<string, string | number> }
export const isOk = <T,>(r: Read<T>): r is { ok: T; warn?: string } => 'ok' in r

export type Cell = string | number | boolean | Date | null | undefined

/** The text of a cell, trimmed ('' for empty). Numbers keep their digits; dates become YYYY-MM-DD. */
export function cellText(v: Cell): string {
  if (v == null) return ''
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : ymd(v)
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return v.replace(/\s+/g, ' ').trim()
}
export const isBlank = (v: Cell) => cellText(v) === ''

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const lower = (v: Cell) => cellText(v).toLowerCase()

// ── money ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const ON_REQUEST = /^(call|call us|call for price|on request|price on request|poa|p\.o\.a\.?|tbd|na|n\/a|-|—|negotiable|contact)$/i
const PER_SQFT = /(?:\/|per)\s*(?:sq\.?\s*ft\.?|sqft|sft|sq\s*feet|square\s*feet)/i

/**
 * A price in rupees. Bare numbers under 1,000 are lakhs ("85" → ₹85 L), as people say them; "Call" / "On request"
 * needs fixing. "9,800 / sqft" is a rate: with the row's area it becomes a total (warning `ratePerSqft`).
 */
export function readPrice(v: Cell, areaSqft?: number): Read<number> {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return { issue: 'priceInvalid', params: { value: String(v) } }
    return { ok: v < 1000 ? Math.round(v * LAKH) : Math.round(v) }
  }
  const s = cellText(v)
  if (!s) return { issue: 'priceMissing' }
  const clean = s.replace(/₹|rs\.?|inr/gi, ' ').replace(/onwards|approx\.?|all\s*inclusive|\+\s*taxes?|\(.*?\)/gi, ' ').trim()
  if (ON_REQUEST.test(clean) || ON_REQUEST.test(s)) return { issue: 'priceOnRequest', params: { value: s } }
  if (PER_SQFT.test(clean)) {
    const rate = parseFloat(clean.replace(/,/g, ''))
    if (!Number.isFinite(rate) || rate <= 0) return { issue: 'priceInvalid', params: { value: s } }
    if (!areaSqft) return { issue: 'rateNeedsArea', params: { value: s } }
    return { ok: Math.round(rate * areaSqft), warn: 'ratePerSqft' }
  }
  const m = /^(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?\.?$/i.exec(clean.replace(/\s+/g, ' '))
  if (!m) return { issue: 'priceInvalid', params: { value: s } }
  const n = parseFloat(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return { issue: 'priceInvalid', params: { value: s } }
  const unit = (m[2] ?? '').toLowerCase()
  if (unit.startsWith('c')) return { ok: Math.round(n * CRORE) }
  if (unit.startsWith('l')) return { ok: Math.round(n * LAKH) }
  if (unit === 'k' || unit === 'thousand') return { ok: Math.round(n * 1000) }
  return { ok: n < 1000 ? Math.round(n * LAKH) : Math.round(n) }
}

// ── area ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export type AreaValue = { sqft: number; value: number; unit: AreaUnit; lengthFt?: number; widthFt?: number }
const UNIT_WORDS: [RegExp, AreaUnit][] = [
  [/sq\.?\s*y(?:d|ds|ards?)|sq\.?\s*yards?|gaj/i, 'sqyd'],
  [/cents?/i, 'cents'],
  [/acres?|ac\b/i, 'acres'],
  [/guntas?|gunthas?/i, 'guntha'],
  [/sq\.?\s*f(?:ee)?t|sqft|sft|square\s*feet|ft2|sq\.?\s*ft/i, 'sqft'],
]

/** "1,200 sqft", "1200", "3 cents", "2.5 acres", "240 sq yd", "30x40" / "30 X 40 ft" (a plot's sides). */
export function readArea(v: Cell): Read<AreaValue> {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? { ok: { sqft: Math.round(v), value: v, unit: 'sqft' } } : { issue: 'areaInvalid', params: { value: String(v) } }
  const s = cellText(v)
  if (!s) return { issue: 'areaMissing' }
  const dims = /^(\d+(?:\.\d+)?)\s*(?:ft|')?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|')?$/i.exec(s)
  if (dims) {
    const l = parseFloat(dims[1])
    const w = parseFloat(dims[2])
    return { ok: { sqft: Math.round(l * w), value: Math.round(l * w), unit: 'sqft', lengthFt: l, widthFt: w } }
  }
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(s)
  if (!m) return { issue: 'areaInvalid', params: { value: s } }
  const n = parseFloat(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return { issue: 'areaInvalid', params: { value: s } }
  const rest = s.slice(m.index + m[1].length)
  const unit = UNIT_WORDS.find(([re]) => re.test(rest))?.[1] ?? 'sqft'
  return { ok: { sqft: Math.round(n * SQFT_PER_UNIT[unit]), value: n, unit } }
}

export function readDimensions(v: Cell): Read<{ lengthFt: number; widthFt: number }> {
  const r = readArea(v)
  if (isOk(r) && r.ok.lengthFt && r.ok.widthFt) return { ok: { lengthFt: r.ok.lengthFt, widthFt: r.ok.widthFt } }
  return { issue: 'dimensionsInvalid', params: { value: cellText(v) } }
}

// ── numbers ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Whole numbers, plus "Ground" / "G" / "GF" → 0, "3rd", "Floor 7", "12 ft". */
export function readInt(v: Cell): Read<number> {
  if (typeof v === 'number') return Number.isFinite(v) ? { ok: Math.round(v) } : { issue: 'numberInvalid', params: { value: String(v) } }
  const s = lower(v)
  if (!s) return { issue: 'missing' }
  if (/^(ground|g|gf|grd|ground floor|lower ground|lg|ug|upper ground)$/.test(s)) return { ok: 0 }
  const m = /-?\d+/.exec(s.replace(/,/g, ''))
  return m ? { ok: parseInt(m[0], 10) } : { issue: 'numberInvalid', params: { value: cellText(v) } }
}

export function readBool(v: Cell): Read<boolean> {
  const s = lower(v)
  if (/^(y|yes|true|1|available|ok|✓|✔)$/.test(s)) return { ok: true }
  if (/^(n|no|false|0|na|not available|✗|✘)$/.test(s)) return { ok: false }
  return { issue: 'boolInvalid', params: { value: cellText(v) } }
}

// ── contact ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function readPhone(v: Cell): Read<string> {
  const s = cellText(v)
  if (!s) return { issue: 'phoneMissing' }
  const e164 = toE164(s)
  return e164 ? { ok: e164 } : { issue: 'phoneInvalid', params: { value: s } }
}

export function readEmail(v: Cell): Read<string> {
  const s = cellText(v)
  if (!s) return { issue: 'missing' }
  return isEmail(s) ? { ok: s.toLowerCase() } : { issue: 'emailInvalid', params: { value: s } }
}

// ── dates ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
/** Excel's day 1 is 1900-01-01 and it counts a 29 Feb 1900 that never was, so serials from 61 on are one day ahead. */
export function excelSerialToDate(serial: number): string {
  const days = Math.floor(serial) - (serial >= 61 ? 1 : 0)
  const d = new Date(1899, 11, 31 + days)
  return ymd(d)
}
const validDay = (y: number, m: number, d: number) => {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? ymd(dt) : undefined
}

/** A calendar day: Date cells, Excel serials, DD/MM/YYYY (Indian order), YYYY-MM-DD, "12 Mar 2027", "Dec 2027", "Q4 2027". */
export function readDate(v: Cell): Read<string> {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? { issue: 'dateInvalid', params: { value: '' } } : { ok: ymd(v) }
  if (typeof v === 'number') return v > 20000 && v < 80000 ? { ok: excelSerialToDate(v) } : { issue: 'dateInvalid', params: { value: String(v) } }
  const s = lower(v)
  if (!s) return { issue: 'missing' }
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s)
  if (m) { const d = validDay(+m[1], +m[2], +m[3]); if (d) return { ok: d } }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s)
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = validDay(y, +m[2], +m[1]); if (d) return { ok: d } }
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3})[a-z]*[\s,-]+(\d{4})$/.exec(s)
  if (m && MONTHS.includes(m[2])) { const d = validDay(+m[3], MONTHS.indexOf(m[2]) + 1, +m[1]); if (d) return { ok: d } }
  m = /^([a-z]{3})[a-z]*[\s,'-]+(\d{2}|\d{4})$/.exec(s)
  if (m && MONTHS.includes(m[1])) { const y = m[2].length === 2 ? 2000 + +m[2] : +m[2]; return { ok: `${y}-${pad(MONTHS.indexOf(m[1]) + 1)}-01` } }
  m = /^q([1-4])\s*(\d{4})$/.exec(s)
  if (m) return { ok: `${m[2]}-${pad(+m[1] * 3)}-01` }
  if (/^\d{5}$/.test(s)) return readDate(+s)
  return { issue: 'dateInvalid', params: { value: cellText(v) } }
}

// ── property vocabulary ────────────────────────────────────────────────────────────────────────────────────────────
/** "2 BHK", "2bhk", "2.5 BHK", "1 RK", "4+ BHK", "5 BHK" → 4BHK+, a bare 3 → 3BHK. */
export function readConfig(v: Cell): Read<Configuration> {
  const s = lower(v).replace(/\s+/g, '')
  if (!s) return { issue: 'missing' }
  if (/^1rk$|studio/.test(s)) return { ok: '1RK' }
  const m = /^(\d(?:\.5)?)\+?(?:bhk|bed|beds|bedroom|bedrooms|br)?\+?$/.exec(s)
  if (!m) return { issue: 'configInvalid', params: { value: cellText(v) } }
  const n = parseFloat(m[1])
  if (n >= 4) return { ok: '4BHK+' }
  const c = `${n}BHK` as Configuration
  return ['1BHK', '2BHK', '2.5BHK', '3BHK'].includes(c) ? { ok: c } : n === 3.5 ? { ok: '3BHK', warn: 'configRounded' } : { issue: 'configInvalid', params: { value: cellText(v) } }
}
export function readConfigs(v: Cell): Read<Configuration[]> {
  const parts = cellText(v).split(/\s*(?:,|\/|&|\bor\b|\band\b)\s*/i).filter(Boolean)
  const out: Configuration[] = []
  for (const p of parts) { const r = readConfig(p); if (isOk(r)) out.push(r.ok); else return r }
  return out.length ? { ok: [...new Set(out)] } : { issue: 'missing' }
}

const TYPE_WORDS: [RegExp, PropertyType][] = [
  [/co-?\s?working/, 'coworking'],
  [/apartment|flat|apt|condo|penthouse|studio/, 'apartment'],
  [/row\s?house|town\s?house/, 'rowHouse'],
  [/villa|bungalow/, 'villa'],
  [/independent|individual|house|duplex/, 'independentHouse'],
  [/agri|farm|agricultural|land parcel/, 'agriLand'],
  [/plot|site|land/, 'plot'],
  [/office|it space|commercial space/, 'office'],
  [/showroom/, 'showroom'],
  [/shop|retail|store/, 'shop'],
  [/warehouse|godown|industrial|shed/, 'warehouse'],
]
export function readPropertyType(v: Cell): Read<PropertyType> {
  const s = lower(v)
  if (!s) return { issue: 'missing' }
  const hit = TYPE_WORDS.find(([re]) => re.test(s))
  return hit ? { ok: hit[1] } : { issue: 'typeInvalid', params: { value: cellText(v) } }
}
export function readPropertyTypes(v: Cell): Read<PropertyType[]> {
  const parts = cellText(v).split(/\s*(?:,|\/|&|\bor\b)\s*/i).filter(Boolean)
  const out = parts.map(readPropertyType).filter(isOk).map((r) => r.ok)
  return out.length ? { ok: [...new Set(out)] } : { issue: 'typeInvalid', params: { value: cellText(v) } }
}

const FACING_WORDS: Record<string, Facing> = {
  e: 'E', east: 'E', w: 'W', west: 'W', n: 'N', north: 'N', s: 'S', south: 'S',
  ne: 'NE', northeast: 'NE', nw: 'NW', northwest: 'NW', se: 'SE', southeast: 'SE', sw: 'SW', southwest: 'SW',
}
export function readFacing(v: Cell): Read<Facing> {
  const s = lower(v).replace(/[\s-]+|facing/g, '')
  if (!s) return { issue: 'missing' }
  return FACING_WORDS[s] ? { ok: FACING_WORDS[s] } : { issue: 'facingInvalid', params: { value: cellText(v) } }
}

/** "Ready", "RTM", "Ready to move" → ready; "UC", "Under construction" or a date → under construction (with the date). */
export function readPossession(v: Cell): Read<{ status: 'ready' | 'underConstruction'; date?: string }> {
  const s = lower(v)
  if (!s) return { issue: 'missing' }
  if (/^(ready|rtm|ready to move|ready to occupy|immediate|completed|oc received)/.test(s)) return { ok: { status: 'ready' } }
  if (/under\s*construction|^uc$|ongoing|new launch|pre.?launch/.test(s)) return { ok: { status: 'underConstruction' } }
  const d = readDate(v)
  if (isOk(d)) return { ok: { status: 'underConstruction', date: d.ok } }
  return { issue: 'possessionInvalid', params: { value: cellText(v) } }
}

export function readFurnishing(v: Cell): Read<Furnishing> {
  const s = lower(v)
  if (!s) return { issue: 'missing' }
  if (/semi/.test(s)) return { ok: 'semi' }
  if (/un\s*furnished|bare|no/.test(s)) return { ok: 'unfurnished' }
  if (/full|furnished/.test(s)) return { ok: 'full' }
  return { issue: 'furnishingInvalid', params: { value: cellText(v) } }
}

export function readTransaction(v: Cell): Read<'newBooking' | 'resale'> {
  const s = lower(v)
  if (!s) return { issue: 'missing' }
  if (/resale|re-sale|second|old/.test(s)) return { ok: 'resale' }
  if (/new|primary|booking|fresh|launch/.test(s)) return { ok: 'newBooking' }
  return { issue: 'transactionInvalid', params: { value: cellText(v) } }
}

// ── places ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru', bengaluru: 'Bengaluru', blr: 'Bengaluru', madras: 'Chennai', chennai: 'Chennai', hyderabad: 'Hyderabad',
  hyd: 'Hyderabad', secunderabad: 'Hyderabad', pune: 'Pune', poona: 'Pune', mumbai: 'Mumbai', bombay: 'Mumbai', thane: 'Mumbai',
  'navi mumbai': 'Mumbai', ncr: 'NCR', delhi: 'NCR', 'new delhi': 'NCR', 'delhi ncr': 'NCR', gurgaon: 'NCR', gurugram: 'NCR', noida: 'NCR',
}
/** Known metros are spelled the CRM's way ("Bangalore" → Bengaluru, "Gurgaon" → NCR); other cities are kept as typed. */
export function readCity(v: Cell): Read<string> {
  const s = cellText(v)
  if (!s) return { issue: 'missing' }
  const alias = CITY_ALIASES[s.toLowerCase()]
  if (alias) return { ok: alias }
  const known = CITY_NAMES.find((c) => c.toLowerCase() === s.toLowerCase())
  return { ok: known ?? titleCase(s) }
}
export function readLocality(v: Cell): Read<string> {
  const s = cellText(v)
  if (!s) return { issue: 'missing' }
  for (const list of Object.values(CITIES)) {
    const hit = list.find((l) => l.toLowerCase() === s.toLowerCase())
    if (hit) return { ok: hit }
  }
  return { ok: titleCase(s) }
}
export const splitList = (v: Cell) => cellText(v).split(/\s*[,;/|]\s*/).filter(Boolean)
export { cityOfLocality }
const titleCase = (s: string) => (s === s.toLowerCase() || s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s)

// ── leads ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const SOURCE_WORDS: [RegExp, LeadSource][] = [
  [/99\s*acres/, 'acres99'], [/magic\s*bricks|\bmb\b/, 'magicbricks'], [/housing/, 'housing'], [/no\s*broker/, 'nobroker'],
  [/facebook|\bfb\b|meta/, 'facebook'], [/instagram|\binsta\b|\big\b/, 'instagram'], [/google|adwords|ppc|\bsem\b/, 'googleAds'],
  [/website|web|landing|portal form|site enquiry/, 'website'], [/walk.?in|site visit|office visit/, 'walkIn'],
  [/referr?al|referred|friend/, 'referral'], [/channel|\bcp\b|broker|agent/, 'channelPartner'], [/whats\s*app|\bwa\b/, 'whatsapp'],
  [/phone|call|ivr|missed/, 'phone'], [/manual/, 'manual'],
]
export function readSource(v: Cell): Read<LeadSource> {
  const s = lower(v)
  if (!s) return { issue: 'sourceMissing' }
  const key = (LEAD_SOURCES as string[]).find((k) => k.toLowerCase() === s)
  if (key) return { ok: key as LeadSource }
  const hit = SOURCE_WORDS.find(([re]) => re.test(s))
  return hit ? { ok: hit[1] } : { ok: 'other', warn: 'sourceOther' }
}

export function readTimeline(v: Cell): Read<Timeline> {
  const s = lower(v)
  if (!s) return { issue: 'missing' }
  const key = (TIMELINES as string[]).find((k) => k.toLowerCase() === s)
  if (key) return { ok: key as Timeline }
  if (/immediate|urgent|asap|now|this month|within (a|1) month|ready/.test(s)) return { ok: 'immediate' }
  if (/explor|just looking|not sure|no hurry|later/.test(s)) return { ok: 'exploring' }
  const m = /(\d+)\s*(?:-|to)?\s*(\d+)?\s*(month|months|mon|m\b|year|years|yr)/.exec(s)
  if (m) {
    const months = (m[2] ? +m[2] : +m[1]) * (/^y/.test(m[3]) ? 12 : 1)
    return { ok: months <= 3 ? 'm1to3' : months <= 6 ? 'm3to6' : months <= 12 ? 'm6to12' : 'exploring' }
  }
  return { issue: 'timelineInvalid', params: { value: cellText(v) } }
}
