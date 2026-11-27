/**
 * Small readers the simulated AI uses on free text: amounts, budgets, areas, BHK, places, facing, possession, timeline,
 * decision makers, loan, NRI, purpose, source, phone numbers, e-mails, names, dates and times.
 * Ported from wireframe-rebuild/src/lib/ai/parse.ts and widened to Indian formats ("1.2 Cr", "85 L", "85 lakhs",
 * "1,200 sq.ft", "2.5BHK", "east facing", "+91 98450 12345"). They never guess: a value they cannot read is left out
 * and the assistant asks for it instead. Pure functions; no React, no store.
 */
import type {
  BuyerPurpose, Configuration, DecisionMaker, Facing, Furnishing, ISODate, LeadSource, LoanStatus, PropertyType, Timeline,
} from '@/domain/types'
import { CITIES } from '@/domain/catalogue'
import { addDaysToDay, parseLocalDay } from '@/lib/dates'
import { toE164 } from '@/lib/phone'

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Lower-case, unify dashes and spaces, keep the original characters otherwise. */
export function norm(text: string): string {
  return text.replace(/[–—−]/g, '-').replace(/[’‘]/g, "'").replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim()
}

/* ---------- contact ---------- */

const PHONE_RE = /(?:\+\s?91[\s-]*|\b91[\s-]+|\b0)?\b[6-9](?:[\s-]?\d){9}\b/g

/** Every Indian mobile in the text, as E.164 (+919845012345), first mention first, no repeats. */
export function phonesIn(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(PHONE_RE)) {
    const e = toE164(m[0])
    if (e && !out.includes(e)) out.push(e)
  }
  return out
}

/** The text with phone numbers blanked (so their digits are never read as a price or an area). */
export const withoutPhones = (text: string) => text.replace(PHONE_RE, ' ')

export function emailIn(text: string): string | undefined {
  return /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(text)?.[0]?.toLowerCase()
}

/* ---------- names ---------- */

const NAME_STOP = new Set([
  'hi', 'hii', 'hello', 'hey', 'namaste', 'namaskar', 'vanakkam', 'dear', 'good', 'morning', 'evening', 'afternoon', 'sir', 'madam', 'mam', 'maam',
  'looking', 'interested', 'from', 'calling', 'here', 'and', 'my', 'number', 'phone', 'mobile', 'for', 'with', 'in', 'at', 'want',
  'wants', 'need', 'needs', 'searching', 'is', 'am', 'the', 'a', 'an', 'regarding', 'about', 'this', 'that', 'planning', 'contact',
  'call', 'whatsapp', 'me', 'we', 'our', 'i', 'im', 'budget', 'not', 'also', 'just', 'very', 'please', 'pls', 'kindly', 'thanks',
  'thank', 'you', 'ji', 'enquiry', 'inquiry', 'lead', 'client', 'customer', 'new', 'currently', 'staying', 'living', 'working',
  'bhk', 'flat', 'apartment', 'villa', 'plot', 'house', 'property', 'buyer', 'investor', 'nri', 'on', 'by', 'to', 'of', 'it',
  'today', 'tomorrow', 'ready', 'urgent', 'wife', 'husband', 'family', 'father', 'mother', 'parents',
])
const NAME_WORD = "[A-Za-z][A-Za-z.'-]*"
const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()

/** Up to three name words from the start of `s`, stopping at a stop word, a digit or punctuation. */
function takeName(s: string): string | undefined {
  const words: string[] = []
  for (const raw of s.split(/\s+/)) {
    const w = raw.replace(/[,.:;!?)]+$/, '')
    if (!w || !/^[A-Za-z][A-Za-z.'-]*$/.test(w)) break
    if (NAME_STOP.has(w.toLowerCase().replace(/\.$/, ''))) break
    words.push(w.replace(/\.$/, ''))
    if (words.length === 3 || /[,.:;!?]$/.test(raw)) break
  }
  if (!words.length) return undefined
  return words.map((w) => (w === w.toLowerCase() || w === w.toUpperCase() ? titleCase(w) : w)).join(' ')
}

/**
 * The person's name: "I'm Rahul Verma", "my name is …", "this is …", "Name: …", "Mr. …", "… here", a WhatsApp export
 * line "[12/11, 10:15] Priya Sharma: …", or a leading "Priya Sharma, 98450 12345". Greetings are never a name.
 * Returns the name and how sure the rule is (explicit phrases 0.9, positional guesses 0.6).
 */
export function nameIn(text: string): { value: string; confidence: number } | undefined {
  const t = norm(text)
  const hon = '(?:(?:mr|mrs|ms|dr|shri|smt)\\.?\\s+)?'
  const explicit = new RegExp(
    `\\b(?:i am|i'm|im|my name is|my name's|name is|this is|myself|it's|its)\\s+${hon}(${NAME_WORD}(?:\\s+${NAME_WORD}){0,3})`,
    'i',
  )
  const labelled = new RegExp(`\\b(?:name|client|customer|lead|buyer|contact person|enquiry from|inquiry from|call from|spoke to|spoke with)\\s*[:\\-]?\\s+${hon}(${NAME_WORD}(?:\\s+${NAME_WORD}){0,3})`, 'i')
  const honorific = new RegExp(`\\b(?:mr|mrs|ms|dr|shri|smt)\\.?\\s+(${NAME_WORD}(?:\\s+${NAME_WORD}){0,2})`, 'i')
  for (const re of [explicit, labelled, honorific]) {
    const m = re.exec(t)
    const name = m && takeName(m[1])
    if (name) return { value: name, confidence: 0.9 }
  }
  const here = /(?:^|[,.!]\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+here\b/m.exec(t)
  if (here) {
    const name = takeName(here[1])
    if (name) return { value: name, confidence: 0.85 }
  }
  const chat = /^\s*\[?[\d/.,:\s]+(?:am|pm)?\]?\s*-?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*:/m.exec(t)
  if (chat) {
    const name = takeName(chat[1])
    if (name) return { value: name, confidence: 0.7 }
  }
  const lead = /^\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*[,\-:|]?\s*(?:\+?91)?[\s-]*[6-9]\d/m.exec(t)
  if (lead) {
    const name = takeName(lead[1])
    if (name) return { value: name, confidence: 0.7 }
  }
  // "new enquiry - Suresh Kumar, ph 98765 43210" / "NRI from USA, Priyanka Rao, whatsapp +1 415…": a 2–3 word
  // capitalised name between separators, right before a (labelled) phone number
  const beforePhone = /(?:^|[,;|\-–—]\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[,(|\-–—:]\s*(?:(?:ph|phone|mob|mobile|cell|tel|contact|whatsapp|wa)\.?\s*[:-]?\s*)?\+?\d/m.exec(t)
  if (beforePhone) {
    const name = takeName(beforePhone[1])
    if (name && name.includes(' ')) return { value: name, confidence: 0.7 }
  }
  const signed = /\b(?:regards|thanks|thank you|cheers)\s*,?\s*\n?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*$/i.exec(t)
  if (signed) {
    const name = takeName(signed[1])
    if (name) return { value: name, confidence: 0.6 }
  }
  return undefined
}

/* ---------- money ---------- */

const UNIT: Record<string, number> = {
  l: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, lk: 1e5, 'லட்சம்': 1e5, 'லட்சங்கள்': 1e5,
  cr: 1e7, crs: 1e7, crore: 1e7, crores: 1e7, 'கோடி': 1e7, k: 1e3, thousand: 1e3,
}
const UNIT_SRC = '(crores?|crs?|cr|lakhs?|lacs?|lac|lk|l|k|thousand|லட்சம்|லட்சங்கள்|கோடி)(?![a-z])'
const NUM_SRC = '(\\d[\\d,]*(?:\\.\\d+)?)'
const toRupees = (n: string, unit: string) => Math.round(parseFloat(n.replace(/,/g, '')) * UNIT[unit.toLowerCase()])

export type Amount = { value: number; index: number; end: number }

/**
 * Every rupee amount in the text with its position: "1.2 Cr", "85 L", "85 lakhs", "₹45,00,000", "Rs. 4500000",
 * and ranges "60-80 L" / "80 L to 1.1 Cr" (both ends). Bare numbers count only with a ₹ / Rs / INR prefix.
 */
export function amountsIn(text: string): Amount[] {
  const t = withoutPhones(norm(text)).toLowerCase()
  const out: Amount[] = []
  const taken: [number, number][] = []
  const free = (a: number) => !taken.some(([x, y]) => a >= x && a < y)
  const range = new RegExp(`${NUM_SRC}\\s*(?:${UNIT_SRC})?\\s*(?:-|to|and)\\s*(?:₹|rs\\.?\\s*)?${NUM_SRC}\\s*${UNIT_SRC}`, 'gi')
  for (const m of t.matchAll(range)) {
    const i = m.index ?? 0
    const unitB = m[4]
    const unitA = m[2] ?? unitB
    // "2-3 months" style ranges never reach here (they need a money unit at the end)
    if (unitA === 'k' && unitB !== 'k') continue
    out.push({ value: toRupees(m[1], unitA), index: i, end: i + m[0].length }, { value: toRupees(m[3], unitB), index: i, end: i + m[0].length })
    taken.push([i, i + m[0].length])
  }
  for (const m of t.matchAll(new RegExp(`(?:₹|rs\\.?|inr)?\\s*${NUM_SRC}\\s*${UNIT_SRC}`, 'gi'))) {
    const i = m.index ?? 0
    if (!free(i + m[0].length - 1)) continue
    if (m[2].toLowerCase() === 'k' && parseFloat(m[1]) > 999) continue
    out.push({ value: toRupees(m[1], m[2]), index: i, end: i + m[0].length })
    taken.push([i, i + m[0].length])
  }
  for (const m of t.matchAll(/(?:₹|rs\.?|inr)\s*(\d{1,3}(?:,\d{2,3})+|\d{5,})(?![\d.]*\s*(?:crores?|cr|lakhs?|lacs?|l\b))/gi)) {
    const i = m.index ?? 0
    if (!free(i)) continue
    out.push({ value: Number(m[1].replace(/,/g, '')), index: i, end: i + m[0].length })
  }
  return out.sort((a, b) => a.index - b.index)
}

export type Budget = { min?: number; preferred?: number; max?: number; confidence: number }

/**
 * A buyer's budget: "budget around 1.2 Cr" (preferred and max 1.2 Cr), "under 85 L" (max), "60-80 L" (min–max),
 * "above 2 Cr" (min), "budget 90 lakhs" (max). The words just before the amount decide its role.
 */
export function budgetIn(text: string): Budget | undefined {
  const t = withoutPhones(norm(text)).toLowerCase()
  const list = amountsIn(text)
  if (!list.length) return undefined
  // a range is two amounts sharing one position
  const first = list[0]
  const second = list[1]
  if (second && second.index === first.index) {
    const [min, max] = first.value <= second.value ? [first.value, second.value] : [second.value, first.value]
    return { min, max, confidence: 0.9 }
  }
  // prefer the amount nearest to a budget word
  const anchor = /\b(budget|afford|range|spend|price|cost|upto|up to|under|below|within|max|maximum|around|about|approx|~)/.exec(t)
  const pick = anchor ? (list.find((a) => a.index >= anchor.index) ?? list[0]) : list[0]
  const before = t.slice(Math.max(0, pick.index - 28), pick.index)
  if (/(under|below|less than|within|upto|up to|max|maximum|not more than|tops?)\s*$/.test(before)) return { max: pick.value, confidence: 0.9 }
  if (/(above|over|more than|min|minimum|at least|starting|from)\s*$/.test(before)) return { min: pick.value, confidence: 0.8 }
  if (/(around|about|approx\.?|approximately|roughly|~|close to|near)\s*$/.test(before)) return { preferred: pick.value, max: pick.value, confidence: 0.8 }
  return { max: pick.value, confidence: anchor ? 0.85 : 0.7 }
}

/* ---------- area ---------- */

const AREA_UNIT_SRC = '(sq\\.?\\s?ft\\.?|sqft|sft|sq\\.?\\s?feet|square\\s?f(?:ee|oo)t|sq\\.?\\s?yds?|sq\\.?\\s?yards?|square\\s?yards?|gaj|cents?|acres?|guntas?|gunthas?)'
export type AreaUnitKey = 'sqft' | 'sqyd' | 'cents' | 'acres' | 'guntha'
export const unitOf = (u: string): AreaUnitKey =>
  /cent/.test(u) ? 'cents' : /acre/.test(u) ? 'acres' : /gunt/.test(u) ? 'guntha' : /y(?:ar)?ds?|gaj/.test(u) ? 'sqyd' : 'sqft'
const SQFT: Record<AreaUnitKey, number> = { sqft: 1, sqyd: 9, cents: 435.6, acres: 43560, guntha: 1089 }

export type AreaReading = { min?: number; max?: number; value?: number; unit: AreaUnitKey; sqftMin?: number; sqftMax?: number; kind?: 'carpet' | 'builtUp' | 'superBuiltUp' | 'plot' }

/** "1200 sqft", "1,200 sq.ft", "1200-1500 sft", "30x40" (plot, sq ft), "2.5 acres", "10 cents", "200 sq yd". */
export function areaIn(text: string): AreaReading | undefined {
  const t = withoutPhones(norm(text)).toLowerCase()
  const range = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:-|to)\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*${AREA_UNIT_SRC}`).exec(t)
  const kindOf = (i: number): AreaReading['kind'] => {
    const near = t.slice(Math.max(0, i - 24), i + 60)
    return /super\s?built|sba|saleable/.test(near) ? 'superBuiltUp' : /built\s?-?up/.test(near) ? 'builtUp' : /carpet/.test(near) ? 'carpet' : /plot|land|site/.test(near) ? 'plot' : undefined
  }
  if (range) {
    const unit = unitOf(range[3])
    const a = parseFloat(range[1].replace(/,/g, '')), b = parseFloat(range[2].replace(/,/g, ''))
    return { min: a, max: b, unit, sqftMin: Math.round(a * SQFT[unit]), sqftMax: Math.round(b * SQFT[unit]), kind: kindOf(range.index) }
  }
  const one = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*${AREA_UNIT_SRC}`).exec(t)
  if (one) {
    const unit = unitOf(one[2])
    const v = parseFloat(one[1].replace(/,/g, ''))
    return { value: v, unit, sqftMin: Math.round(v * SQFT[unit]), sqftMax: Math.round(v * SQFT[unit]), kind: kindOf(one.index) }
  }
  const dims = /\b(\d{2,3})\s*[x×*]\s*(\d{2,3})\b/.exec(t)
  if (dims) {
    const v = Number(dims[1]) * Number(dims[2])
    return { value: v, unit: 'sqft', sqftMin: v, sqftMax: v, kind: 'plot' }
  }
  return undefined
}

/* ---------- requirement words ---------- */

/** "3BHK", "3 bhk", "2.5BHK", "2 or 3 BHK", "2/3 bhk", "4+ bhk", "1RK", "3 bedroom". */
export function configurationsIn(text: string): Configuration[] {
  const t = withoutPhones(norm(text)).toLowerCase()
  const out: Configuration[] = []
  const add = (n: string) => {
    const v = parseFloat(n)
    const c: Configuration = v >= 4 ? '4BHK+' : v === 2.5 ? '2.5BHK' : (`${Math.max(1, Math.round(v))}BHK` as Configuration)
    if (!out.includes(c)) out.push(c)
  }
  // a BHK number is a lone digit: never the tail of a longer number ("…345, 3BHK")
  for (const m of t.matchAll(/(?<![\d.])(\d(?:\.5)?)\s*(?:bhk|bed\s?rooms?|beds?\b|br\b)\s*(?:\/|or|,|-|to)\s*(\d(?:\.5)?)\s*\+?\s*(?:bhk|bed\s?rooms?|beds?\b)/g)) { add(m[1]); add(m[2]) }
  for (const m of t.matchAll(/(?<![\d.,])(\d(?:\.5)?)\s*(?:\/|or|-|to)\s*(\d(?:\.5)?)\s*\+?\s*(?:bhk|bed\s?rooms?)/g)) { add(m[1]); add(m[2]) }
  for (const m of t.matchAll(/(?<![\d.])(\d(?:\.5)?)\s*\+?\s*-?\s*(?:bhk|bed\s?rooms?\b|bedroom)/g)) add(m[1])
  if (/\b1\s?rk\b/.test(t) && !out.includes('1RK')) out.unshift('1RK')
  return out
}

const TYPE_WORDS: [RegExp, PropertyType][] = [
  [/\b(agricultural|agri|farm ?lands?|farm ?house|farms?)\b/, 'agriLand'],
  [/\b(warehouses?|godowns?)\b/, 'warehouse'],
  [/\b(co-?working)\b/, 'coworking'],
  [/\b(showrooms?)\b/, 'showroom'],
  [/\b(shops?|retail)\b/, 'shop'],
  [/\b(office ?space|offices?)\b/, 'office'],
  [/\b(villas?|bungalows?)\b/, 'villa'],
  [/\brow ?houses?\b/, 'rowHouse'],
  [/\b(independent house|individual house|independent home|duplex house)\b/, 'independentHouse'],
  [/\b(flats?|apartments?|condo)\b/, 'apartment'],
  [/\b(plots?|sites?|land)\b/, 'plot'],
]

export function propertyTypesIn(text: string): PropertyType[] {
  const t = norm(text).toLowerCase()
  const out: PropertyType[] = []
  for (const [re, type] of TYPE_WORDS) if (re.test(t) && !out.includes(type)) out.push(type)
  // "farm land" is not also a plot; "house" alone means an independent house when no villa / row house was named
  if (out.includes('agriLand')) return out.filter((x) => x !== 'plot')
  if (!out.length && /\bhouse\b/.test(t)) out.push('independentHouse')
  return out
}

const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru', bengaluru: 'Bengaluru', blr: 'Bengaluru', madras: 'Chennai', hyd: 'Hyderabad', hyderabad: 'Hyderabad',
  bombay: 'Mumbai', mumbai: 'Mumbai', gurgaon: 'NCR', delhi: 'NCR', 'new delhi': 'NCR', ncr: 'NCR', pune: 'Pune', chennai: 'Chennai',
}
const LOCALITY_ALIASES: Record<string, string> = {
  sarjapur: 'Sarjapur Road', 'e city': 'Electronic City', 'e-city': 'Electronic City', ecity: 'Electronic City', hsr: 'HSR Layout',
  gurgaon: 'Gurugram', 'navi mumbai': 'Navi Mumbai', 'noida extension': 'Greater Noida West', 'greater noida': 'Greater Noida West',
  'dwarka expressway': 'Dwarka Expressway', andheri: 'Andheri East', 'old mahabalipuram road': 'OMR',
}

/** Cities and localities named in the text ("Whitefield or Sarjapur" → Whitefield, Sarjapur Road · Bengaluru). */
export function placesIn(text: string): { cities: string[]; localities: string[] } {
  const t = ` ${norm(text).toLowerCase()} `
  const cities: string[] = []
  const localities: string[] = []
  const addLoc = (loc: string) => {
    if (!localities.includes(loc)) localities.push(loc)
    const city = Object.keys(CITIES).find((c) => CITIES[c].includes(loc))
    if (city && !cities.includes(city)) cities.push(city)
  }
  const found: { at: number; loc: string }[] = []
  for (const locs of Object.values(CITIES)) {
    for (const loc of locs) {
      const m = new RegExp(`\\b${escapeRe(loc.toLowerCase())}\\b`).exec(t)
      if (m) found.push({ at: m.index, loc })
    }
  }
  for (const [alias, loc] of Object.entries(LOCALITY_ALIASES)) {
    const m = new RegExp(`\\b${escapeRe(alias)}\\b`).exec(t)
    if (m && !found.some((f) => f.loc === loc)) found.push({ at: m.index, loc })
  }
  for (const f of found.sort((a, b) => a.at - b.at)) addLoc(f.loc)
  for (const city of Object.keys(CITIES)) if (new RegExp(`\\b${escapeRe(city.toLowerCase())}\\b`).test(t) && !cities.includes(city)) cities.push(city)
  for (const [alias, city] of Object.entries(CITY_ALIASES)) if (new RegExp(`\\b${escapeRe(alias)}\\b`).test(t) && !cities.includes(city) && !LOCALITY_ALIASES[alias]) cities.push(city)
  return { cities, localities }
}

const FACING_WORDS: [RegExp, Facing][] = [
  [/\bnorth[- ]?east\b|\bne\b/, 'NE'], [/\bnorth[- ]?west\b|\bnw\b/, 'NW'], [/\bsouth[- ]?east\b|\bse\b/, 'SE'], [/\bsouth[- ]?west\b|\bsw\b/, 'SW'],
  [/\beast\b|\be\b/, 'E'], [/\bwest\b|\bw\b/, 'W'], [/\bnorth\b|\bn\b/, 'N'], [/\bsouth\b|\bs\b/, 'S'],
]

/** "east facing", "east-facing", "facing east", "north or east facing", "NE facing". */
export function facingIn(text: string): Facing[] {
  const t = norm(text).toLowerCase()
  const out: Facing[] = []
  const segs = [
    ...[...t.matchAll(/((?:(?:north|south|east|west|north[- ]?east|north[- ]?west|south[- ]?east|south[- ]?west|ne|nw|se|sw|[nesw])(?:\s*(?:\/|or|,|and)\s*)?)+)\s*[- ]?facing/g)].map((m) => m[1]),
    ...[...t.matchAll(/facing\s+((?:north|south|east|west)(?:[- ]?(?:east|west))?)/g)].map((m) => m[1]),
  ]
  for (const seg of segs) {
    let rest = ` ${seg} `
    for (const [re, f] of FACING_WORDS) {
      if (re.test(rest)) {
        if (!out.includes(f)) out.push(f)
        rest = rest.replace(re, ' ')
      }
    }
  }
  return out
}

/** Possession: "ready to move", "RTM", "ready possession", "under construction", "UC", "new launch", "possession Dec 2027". */
export function possessionIn(text: string, today: ISODate): { pref?: 'ready' | 'underConstruction'; by?: ISODate } {
  const t = norm(text).toLowerCase()
  const out: { pref?: 'ready' | 'underConstruction'; by?: ISODate } = {}
  if (/\b(ready[- ]to[- ]move|ready to occupy|rtm|ready possession|immediate possession|ready flat|ready property|ready home)\b/.test(t)) out.pref = 'ready'
  else if (/\b(under[- ]?construction|uc\b|new launch|pre[- ]?launch|upcoming project)/.test(t)) out.pref = 'underConstruction'
  const by = /possession\s*(?:by|in|on|date)?\s*:?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*'?(\d{2,4})/.exec(t)
  if (by) {
    const m = MONTHS.indexOf(by[1]) + 1
    let y = Number(by[2])
    if (y < 100) y += 2000
    out.by = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`
    if (!out.pref && out.by > today) out.pref = 'underConstruction'
  }
  return out
}

/**
 * When they want to buy: "immediately" / "urgent" / "asap" → immediate; "in 2-3 months" / "within 3 months" → 1–3 months;
 * "in 6 months" → 3–6; "next year" / "within a year" → 6–12; "just exploring" / "no hurry" → exploring.
 */
export function timelineIn(text: string): Timeline | undefined {
  const t = norm(text).toLowerCase()
  if (/\b(just exploring|only exploring|exploring|browsing|no hurry|not in a hurry|just looking|window shopping|no rush)\b/.test(t)) return 'exploring'
  if (/\b(immediately|immediate|urgent(?:ly)?|asap|right away|this week|at the earliest|as soon as possible)\b/.test(t) && !/immediate possession/.test(t)) return 'immediate'
  const m = /\b(?:in|within|next|by|around|about|over the next)?\s*(\d{1,2}|a|one|two|three|four|five|six|twelve)(?:\s*(?:-|to|or)\s*(\d{1,2}|two|three|four|five|six))?\s*(weeks?|months?|mnths?|yrs?|years?)\b/.exec(t)
  const WORDS: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, twelve: 12 }
  if (m && !/\bold\b/.test(t.slice(m.index + m[0].length, m.index + m[0].length + 6))) {
    const hi = m[2] ?? m[1]
    let n = WORDS[hi] ?? Number(hi)
    if (/week/.test(m[3])) n = n / 4
    if (/y/.test(m[3])) n = n * 12
    if (n <= 0.75) return 'immediate'
    if (n <= 3) return 'm1to3'
    if (n <= 6) return 'm3to6'
    if (n <= 12) return 'm6to12'
    return 'exploring'
  }
  if (/\bnext month\b/.test(t)) return 'm1to3'
  if (/\b(this year|by year end|by end of (?:the )?year|next year|within a year)\b/.test(t)) return 'm6to12'
  return undefined
}

/** Who decides: "wife will also decide" → self + spouse (joint); "needs father's approval" → parents (needs approval). */
export function decisionIn(text: string): { makers: DecisionMaker[]; authority?: 'sole' | 'joint' | 'needsApproval' } {
  const t = norm(text).toLowerCase()
  const makers: DecisionMaker[] = []
  const add = (d: DecisionMaker) => { if (!makers.includes(d)) makers.push(d) }
  const decideCtx = /(decide|decision|approv|consult|discuss|final|agree|see the property|visit together|along with|with (?:my|his|her)|will also|also come|both of us|together)/.test(t)
  if (/\b(wife|husband|spouse|better half|missus)\b/.test(t)) add('spouse')
  if (/\b(parents|father|mother|dad|mom|papa|mummy|in-?laws)\b/.test(t)) add('parents')
  if (/\b(family|brother|sister|son|daughter|kids)\b/.test(t) && decideCtx) add('family')
  if (/\b(business partner|partner|co-?founder)\b/.test(t) && !/channel partner/.test(t)) add('partner')
  if (/\b(company|employer|management|board|hr)\b/.test(t) && decideCtx) add('company')
  let authority: 'sole' | 'joint' | 'needsApproval' | undefined
  if (/\b(i (?:alone )?decide|i'?ll decide|my decision|i am the decision maker|sole decision|only me)\b/.test(t)) { add('self'); authority = 'sole' }
  if (makers.some((m) => m !== 'self')) {
    if (/(approv|permission|needs? (?:his|her|their|my) (?:father|mother|parents|wife|husband)|depends on|has to agree|final (?:say|call|decision) (?:is|with))/.test(t)) authority = 'needsApproval'
    else { add('self'); authority = authority ?? 'joint' }
    makers.sort((a, b) => (a === 'self' ? -1 : b === 'self' ? 1 : 0))
  }
  return { makers, authority }
}

export function loanIn(text: string): LoanStatus | undefined {
  const t = norm(text).toLowerCase()
  if (/\bpre[- ]?approved\b|\bpre[- ]?sanctioned\b|\bloan (?:is )?(?:sanctioned|approved)\b/.test(t)) return 'preApproved'
  if (/\b(no loan|without (?:a )?loan|full cash|cash (?:buyer|payment|down)|self[- ]funded|own funds|loan not needed|not taking (?:a )?loan)\b/.test(t)) return 'notNeeded'
  if (/\b(home loan|need(?:s)? (?:a )?loan|loan (?:needed|required)|via loan|with loan|bank loan|financing|emi)\b/.test(t)) return 'needed'
  return undefined
}

const NRI_COUNTRIES: [RegExp, string][] = [
  [/\b(dubai|uae|abu dhabi|sharjah)\b/, 'UAE'], [/\b(usa|us|america|united states|california|new york|texas|seattle)\b/, 'USA'],
  [/\b(uk|london|united kingdom|england)\b/, 'UK'], [/\b(singapore)\b/, 'Singapore'], [/\b(canada|toronto)\b/, 'Canada'],
  [/\b(australia|sydney|melbourne)\b/, 'Australia'], [/\b(qatar|doha)\b/, 'Qatar'], [/\b(saudi|riyadh|jeddah)\b/, 'Saudi Arabia'],
  [/\b(oman|muscat)\b/, 'Oman'], [/\b(kuwait)\b/, 'Kuwait'], [/\b(germany|berlin|munich)\b/, 'Germany'],
]

/** "NRI", "based in Dubai", "from the US", "currently in Singapore" → NRI + country. */
export function nriIn(text: string): { isNri: boolean; country?: string } | undefined {
  const t = norm(text).toLowerCase()
  const nri = /\bnri\b|non[- ]resident/.test(t)
  const abroad = /\b(based in|living in|settled in|working in|staying in|from|currently in|calling from|located in)\s+(?:the\s+)?([a-z ]{2,20})/.exec(t)
  const country = NRI_COUNTRIES.find(([re]) => re.test(abroad?.[2] ?? (nri ? t : '')))?.[1]
  if (nri || country) return { isNri: true, country }
  return undefined
}

export function purposeIn(text: string): BuyerPurpose | undefined {
  const t = norm(text).toLowerCase()
  if (/\b(rental income|rental yield|to rent (?:it )?out|for rental|rent it out)\b/.test(t)) return 'rental'
  if (/\b(invest(?:ment|or|ing)?|returns|appreciation|roi)\b/.test(t)) return 'investment'
  if (/\b(for (?:my|our|the) (?:business|office|company)|business use|office use|commercial use)\b/.test(t)) return 'business'
  if (/\b(self[- ]use|own use|end[- ]use|to live|to stay|family home|for (?:my|our) family|shift(?:ing)? (?:in|there))\b/.test(t)) return 'selfUse'
  return undefined
}

const SOURCE_WORDS: [RegExp, LeadSource][] = [
  [/\b99\s?acres\b/, 'acres99'], [/\bmagic\s?bricks\b/, 'magicbricks'], [/\bhousing(?:\.com)?\b(?! (?:loan|society|board))/, 'housing'],
  [/\bno\s?broker\b/, 'nobroker'], [/\b(facebook|fb ad|fb lead)\b/, 'facebook'], [/\b(instagram|insta)\b/, 'instagram'],
  [/\b(google ads?|google search|adwords|ppc)\b/, 'googleAds'], [/\b(channel partner|cp\b|broker referral|sub[- ]?broker)\b/, 'channelPartner'],
  [/\b(referr(?:ed|al)|reference from|friend of|recommended by)\b/, 'referral'], [/\b(walk[- ]?in|walked in|visited (?:our|the) office|site walk)\b/, 'walkIn'],
  [/\b(website|web form|enquiry form|landing page|site form)\b/, 'website'],
]
/** Where the lead came from, only when the text says it ("saw your ad on 99acres", "referred by …", "walk-in"). */
export function sourceIn(text: string): LeadSource | undefined {
  const t = norm(text).toLowerCase()
  return SOURCE_WORDS.find(([re]) => re.test(t))?.[1]
}

export function furnishingIn(text: string): Furnishing | undefined {
  const t = norm(text).toLowerCase()
  if (/\bsemi[- ]?furnished\b/.test(t)) return 'semi'
  if (/\bun[- ]?furnished\b|\bbare shell\b/.test(t)) return 'unfurnished'
  if (/\b(fully[- ]?)?furnished\b/.test(t)) return 'full'
  return undefined
}

const AMENITY_WORDS: Record<string, RegExp> = {
  swimmingPool: /\b(swimming pool|pool)\b/, gym: /\b(gym|gymnasium|fitness)\b/, lift: /\b(lifts?|elevators?)\b/, gatedCommunity: /\bgated\b/,
  security: /\b(24 ?x ?7 security|security)\b/, cctv: /\bcctv\b/, clubhouse: /\bclub ?house\b/, powerBackup: /\b(power back ?up|dg backup|generator)\b/,
  parkOpenSpace: /\b(park|open space|garden)\b/, rainwaterHarvesting: /\brain ?water\b/, coveredParking: /\b(covered|car) parking\b/,
  kidsPlayArea: /\b(kids'? play|play area|children'?s play)\b/, joggingTrack: /\bjogging\b/, evCharging: /\b(ev charging|ev point|charging point)\b/,
  water24x7: /\b(24 ?x ?7|24\/7) water\b/, visitorParking: /\bvisitor parking\b/,
}
export function amenitiesIn(text: string): string[] {
  const t = norm(text).toLowerCase()
  return Object.entries(AMENITY_WORDS).filter(([, re]) => re.test(t)).map(([k]) => k)
}

export const vastuIn = (text: string) => /\bvaa?stu\b/i.test(text)
export function parkingIn(text: string): 'required' | 'preferred' | undefined {
  const t = norm(text).toLowerCase()
  if (/\b(must have|need|needs|required|want)\s+(?:a\s+)?(?:covered\s+|car\s+)?parking\b|\bparking (?:is )?(?:a )?must\b/.test(t)) return 'required'
  if (/\bparking\b/.test(t)) return 'preferred'
  return undefined
}
const LANGS = ['English', 'Hindi', 'Tamil', 'Kannada', 'Telugu', 'Marathi', 'Malayalam', 'Bengali', 'Gujarati', 'Urdu']
export function languageIn(text: string): string | undefined {
  const t = norm(text).toLowerCase()
  const m = /\b(?:speaks?|prefers?|comfortable in|talk in|language[: ]+|only)\s+([a-z]+)/.exec(t)
  return LANGS.find((l) => l.toLowerCase() === m?.[1])
}
export function familySizeIn(text: string): number | undefined {
  const m = /\bfamily of (\d{1,2})\b|\b(\d{1,2}) (?:family )?members\b/i.exec(text)
  const n = Number(m?.[1] ?? m?.[2])
  return n > 0 && n < 20 ? n : undefined
}
export function transactionIn(text: string): 'newBooking' | 'resale' | undefined {
  const t = norm(text).toLowerCase()
  if (/\b(resale|re-sale|second[- ]hand|pre[- ]owned)\b/.test(t)) return 'resale'
  if (/\b(new booking|new project|fresh booking|from (?:the )?builder|new launch)\b/.test(t)) return 'newBooking'
  return undefined
}
export function rentOrSaleIn(text: string): 'sale' | 'rent' | 'lease' | undefined {
  const t = norm(text).toLowerCase()
  if (/\b(for rent|on rent|rental property|monthly rent|to let|rent is|rent:)\b/.test(t)) return 'rent'
  if (/\b(for lease|on lease|lease)\b/.test(t)) return 'lease'
  if (/\b(for sale|to sell|selling|sale price|buy|purchase)\b/.test(t)) return 'sale'
  return undefined
}

/* ---------- dates and times ---------- */

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')
const withYear = (today: ISODate, m: number, d: number) => {
  const y = Number(today.slice(0, 4))
  const iso = `${y}-${pad(m)}-${pad(d)}`
  return iso < today ? `${y + 1}-${pad(m)}-${pad(d)}` : iso
}

/** A day named in the text, as YYYY-MM-DD: today, tomorrow, day after tomorrow, a weekday (next one), "21 Nov", "21/11", "in 3 days", "next week". */
export function dateIn(text: string, today: ISODate): ISODate | undefined {
  const s = norm(text).toLowerCase()
  if (/\bday after tomorrow\b/.test(s)) return addDaysToDay(today, 2)
  if (/\b(tomorrow|tmrw|tmr|tomo)\b|நாளை/.test(s)) return addDaysToDay(today, 1)
  if (/\b(today|tonight|this evening|this afternoon)\b|இன்று/.test(s)) return today
  const inN = /\bin (\d+) days?\b/.exec(s)
  if (inN) return addDaysToDay(today, Number(inN[1]))
  const dm = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/.exec(s) ?? /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/.exec(s)
  if (dm) {
    const [d, mon] = /^\d/.test(dm[1]) ? [Number(dm[1]), dm[2]] : [Number(dm[2]), dm[1]]
    return withYear(today, MONTHS.indexOf(mon) + 1, d)
  }
  const slash = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(s)
  if (slash && Number(slash[2]) <= 12 && Number(slash[1]) <= 31) {
    if (slash[3]) {
      const y = Number(slash[3]) < 100 ? 2000 + Number(slash[3]) : Number(slash[3])
      return `${y}-${pad(Number(slash[2]))}-${pad(Number(slash[1]))}`
    }
    return withYear(today, Number(slash[2]), Number(slash[1]))
  }
  const wd = DAYS.findIndex((d) => new RegExp(`\\b(${d}|${d.slice(0, 3)})\\b`).test(s))
  if (wd >= 0) {
    const now = parseLocalDay(today).getDay()
    return addDaysToDay(today, ((wd - now + 7) % 7) || 7)
  }
  if (/\bnext week\b/.test(s)) return addDaysToDay(today, 7)
  return undefined
}

/** A time of day: "11 am", "3pm", "11:30", "15:00", "at 4", "4 in the evening", "noon" → "HH:MM". */
export function timeIn(text: string): string | undefined {
  const s = norm(text).toLowerCase()
  if (/\bnoon\b/.test(s)) return '12:00'
  const m = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/.exec(s) ?? /\b(\d{1,2}):(\d{2})\b/.exec(s)
  if (m) {
    let h = Number(m[1])
    const min = m[2] ? Number(m[2]) : 0
    const ap = m[3]?.replace(/\./g, '')
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : undefined
  }
  const at = /\bat (\d{1,2})(?:\s*(?:o'?clock))?\s*(in the (morning|afternoon|evening))?\b/.exec(s)
  if (at) {
    let h = Number(at[1])
    if (at[3] ? at[3] !== 'morning' && h < 12 : h >= 1 && h <= 7) h += 12
    return h < 24 ? `${pad(h)}:00` : undefined
  }
  if (/\bmorning\b/.test(s)) return '10:00'
  if (/\bafternoon\b/.test(s)) return '15:00'
  if (/\bevening\b/.test(s)) return '18:00'
  return undefined
}

/** Local date + "HH:MM" → ISO date-time. */
export function atLocal(day: ISODate, hhmm: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString()
}

/* ---------- fuzzy names over app data ---------- */

/** Edit distance (small strings only). */
export function distance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

/**
 * Records whose name the text mentions: id, full name, or first name (a typo of one letter is allowed for names of
 * five or more letters). Longest name first. Used for leads, users and properties.
 */
export function named<T extends { id: string; name: string }>(text: string, list: T[]): T[] {
  const s = ` ${norm(text).toLowerCase()} `
  const words = s.split(/[^a-z0-9'-]+/).filter(Boolean)
  const hits = list.filter((x) => {
    const full = x.name.toLowerCase()
    const first = full.split(/\s+/)[0]
    if (s.includes(x.id.toLowerCase())) return true
    if (new RegExp(`\\b${escapeRe(full)}\\b`).test(s)) return true
    if (first.length > 2 && new RegExp(`\\b${escapeRe(first)}(?:'s)?\\b`).test(s)) return true
    return first.length >= 5 && words.some((w) => w.length >= 5 && distance(w.replace(/'s$/, ''), first) === 1)
  })
  return hits.sort((a, b) => scoreHit(s, b) - scoreHit(s, a) || b.name.length - a.name.length)
}
const scoreHit = (s: string, x: { id: string; name: string }) =>
  s.includes(x.id.toLowerCase()) ? 3 : s.includes(x.name.toLowerCase()) ? 2 : 1

/** A property the text names: its id ("PRP-1003", "1003") or most of its title / project words. */
export function propertyNamed<T extends { id: string; title: string; projectName?: string }>(text: string, props: T[]): T | undefined {
  const id = /\b(?:prp|prop)[-\s]?(\d{4})\b/i.exec(text)?.[1]
  if (id) return props.find((p) => p.id === `PRP-${id}`)
  const s = norm(text).toLowerCase()
  let best: { p: T; n: number } | undefined
  for (const p of props) {
    const words = `${p.projectName ?? ''} ${p.title}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/^(bhk|apartment|flat|villa|plot|with|near|road)$/.test(w))
    const uniq = [...new Set(words)]
    const n = uniq.filter((w) => new RegExp(`\\b${escapeRe(w)}\\b`).test(s)).length
    if (uniq.length && (n >= 2 || n / uniq.length >= 0.6) && (!best || n > best.n)) best = { p, n }
  }
  return best?.p
}
