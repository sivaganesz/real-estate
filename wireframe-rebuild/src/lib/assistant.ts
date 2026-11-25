/**
 * The property assistant (Add property, Edit with AI).
 * In the product, one AI call per message returns facts in a fixed shape — { key, value, note } — and code checks them.
 * The wireframe produces the same shape with simple rules, so the screens won't change when the real AI arrives.
 * Rules the assistant keeps (CTO-approved): it never invents a fact; it asks only for missing required facts, one at a time;
 * a person publishes.
 */
import { CITIES, PROPERTY_TYPES, PURPOSES, TYPE_ORDER } from '@/data/catalogue'
import type { FactDef } from '@/data/catalogue'
import type { ExtraDetail, FactSource, Facing, Property, PropertyStatus, PropertyTypeKey, Purpose, SpecValue } from '@/data/types'

/* ---------- the draft the assistant fills ---------- */

export type Draft = {
  title?: string
  /** The team changed the title by hand: stop suggesting one. */
  titleEdited?: boolean
  purpose?: Purpose
  type?: PropertyTypeKey
  city?: string
  locality?: string
  price?: number
  /** Hide the price on the listing ("price on request"). */
  priceOnRequest?: boolean
  areaSqft?: number
  facing?: Facing
  specs: Record<string, SpecValue>
  amenities: string[]
  /** Approval ids claimed (RERA, building approval). Each starts as "document pending". */
  approvals: string[]
  exactLocation: boolean
  photos: number
  description?: string
  /** Details only this property has (from a "new detail" card, or "＋ Something else" in the form). */
  extraDetails?: ExtraDetail[]
  /** Edit mode only. */
  status?: PropertyStatus
  /** Where each value came from, by fact key (`price`, `spec:bhk`, `title`…). */
  sources?: Record<string, FactSource>
}

export const EMPTY_DRAFT: Draft = { specs: {}, amenities: [], approvals: [], exactLocation: false, photos: 0, sources: {} }

/** One fact read from a message. `key` is a draft field, or `spec:<fact key>` for a type's own fact. */
export type Fact = {
  key: string
  value: SpecValue | string[] | boolean
  /** What the assistant worked out, shown under the fact (an i18n key + values). */
  note?: { k: string; v?: Record<string, string | number> }
}

/* ---------- reading a message ---------- */

const UNIT_RE = '(l|lakh|lakhs|lac|lacs|cr|crore|crores|k)'
/** A price under this with no unit is ambiguous (₹45, 45 lakh or 45 crore?), so the assistant asks. */
export const PRICE_ASK_BELOW = 1000
/** A rupee amount. Without a unit it is taken as rupees; a small bare number ("45") is asked about instead — see PRICE_ASK_BELOW. */
function money(n: string, unit?: string): number {
  const v = parseFloat(n.replace(/,/g, ''))
  if (!unit) return v
  if (unit.startsWith('c')) return Math.round(v * 1e7)
  if (unit === 'k') return Math.round(v * 1e3)
  return Math.round(v * 1e5)
}
const AREA_UNITS: [RegExp, number, string][] = [
  [/([\d,.]+)\s*(?:sq\.?\s*ft\.?|sqft|sft|square\s*feet|sq\s*feet)/g, 1, ''],
  [/([\d,.]+)\s*(?:sq\.?\s*yd\.?|sq\s*yards?|square\s*yards?)/g, 9, 'fromSqYd'],
  [/([\d,.]+)\s*(?:sq\.?\s*m\b|sqm|square\s*met(?:er|re)s?)/g, 10.764, 'fromSqM'],
  [/([\d.]+)\s*cents?\b/g, 435.6, 'fromCents'],
  [/([\d.]+)\s*grounds?\b/g, 2400, 'fromGrounds'],
  [/([\d.]+)\s*acres?\b/g, 43560, 'fromAcres'],
]
const AMENITY_WORDS: [RegExp, string][] = [
  [/\blifts?\b|\belevator/, 'Lift'], [/\bgym\b/, 'Gym'], [/\b(swimming )?pool\b/, 'Swimming pool'], [/\bcctv\b/, 'CCTV'],
  [/\bsecurity\b/, 'Security'], [/\bpower back ?up\b|\bgenerator\b/, 'Power backup'], [/\bpark\b|\bopen space\b/, 'Park / open space'],
  [/\bclub ?house\b/, 'Clubhouse'], [/\bgated\b/, 'Gated community'], [/\brain ?water\b/, 'Rainwater harvesting'],
  [/\bvisitor parking\b/, 'Visitor parking'], [/\bloading (bay|dock)\b/, 'Loading bay'],
]
const FACING_WORDS: [RegExp, Facing][] = [
  [/north[- ]?east/, 'NE'], [/north[- ]?west/, 'NW'], [/south[- ]?east/, 'SE'], [/south[- ]?west/, 'SW'],
  [/\beast\b/, 'E'], [/\bwest\b/, 'W'], [/\bnorth\b/, 'N'], [/\bsouth\b/, 'S'],
]
const STATUS_WORDS: [RegExp, PropertyStatus][] = [
  [/under negotiation|negotiating/, 'negotiation'], [/\bsold\b/, 'sold'], [/\breserved\b/, 'reserved'],
  [/\bon hold\b/, 'onHold'], [/\bbooked\b/, 'booked'], [/available again|back on (the )?market|\bavailable\b/, 'available'],
]
const cap = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** Read every fact a message states. `asking` is the fact the assistant just asked for, so a bare answer ("4") lands there. */
export function readMessage(text: string, draft: Draft, asking?: string): Fact[] {
  const facts: Fact[] = []
  const add = (f: Fact) => { if (!facts.some((x) => x.key === f.key)) facts.push(f) }
  const raw = text.trim()
  const q = ` ${raw.toLowerCase().replace(/₹/g, ' ₹')} `

  // labelled lines: "title: …", "description: …"
  const labelled = raw.match(/^(title|description)\s*:\s*(.+)$/is)
  if (labelled) {
    add({ key: labelled[1].toLowerCase(), value: labelled[2].trim() })
    return facts
  }

  // a pasted map link or WhatsApp location = the exact location
  if (/(maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps|maps\.google|location:\s*https?:)/.test(q)) add({ key: 'exactLocation', value: true, note: { k: 'fromLink' } })

  // purpose
  if (/\b(for rent|rent|rental|to let)\b/.test(q) && !/\brental income\b/.test(q)) add({ key: 'purpose', value: 'rent' })
  else if (/\blease\b/.test(q) && !/\blease (ends|till|until)\b/.test(q)) add({ key: 'purpose', value: 'lease' })
  else if (/\b(for sale|sell|selling|sale|resale)\b/.test(q)) add({ key: 'purpose', value: 'sale' })

  // type (and the detail that comes with it)
  let type: PropertyTypeKey | undefined
  if (/\b(agri|agricultural|farm ?land|farm)\b/.test(q)) type = 'agri'
  else if (/\b(industrial|factory)\b/.test(q) || /\bshed\b/.test(q)) {
    type = 'industrial'
    add({ key: 'spec:subType', value: /\b(factory|shed)\b/.test(q) ? 'Factory / shed' : /\bbuilding\b/.test(q) ? 'Industrial building' : 'Industrial plot' })
  } else if (/\b(warehouse|godown)\b/.test(q)) { type = 'commercial'; add({ key: 'spec:commCategory', value: 'Warehouse / Godown' }) }
  else if (/\b(shop|showroom)\b/.test(q)) { type = 'commercial'; add({ key: 'spec:commCategory', value: 'Shop / Showroom' }) }
  else if (/\boffice\b/.test(q)) { type = 'commercial'; add({ key: 'spec:commCategory', value: 'Office space' }) }
  else if (/\bcommercial building\b/.test(q)) { type = 'commercial'; add({ key: 'spec:commCategory', value: 'Commercial building' }) }
  else if (/\bvilla\b/.test(q)) { type = 'house'; add({ key: 'spec:subType', value: 'Villa (gated community)' }) }
  else if (/\brow house\b/.test(q)) { type = 'house'; add({ key: 'spec:subType', value: 'Row house' }) }
  else if (/\b(independent|individual) house\b|\bhouse\b/.test(q)) { type = 'house'; add({ key: 'spec:subType', value: 'Independent house' }) }
  else if (/\b(flat|apartment)s?\b|\bbhk\b/.test(q)) type = 'flat'
  else if (/\b(plot|site|land)\b/.test(q)) type = 'plot'
  if (type) add({ key: 'type', value: type })
  const t = type ?? draft.type

  // rooms and floors
  const bhk = q.match(/(\d)\s*\+?\s*bhk/)
  if (bhk) {
    if (t === 'house') add({ key: 'spec:bedrooms', value: Number(bhk[1]) })
    else add({ key: 'spec:bhk', value: Number(bhk[1]) >= 5 ? '4+ BHK' : `${bhk[1]} BHK` })
  }
  const beds = q.match(/(\d+)\s*(?:bed ?rooms?|beds?)\b/)
  if (beds) add({ key: 'spec:bedrooms', value: Number(beds[1]) })
  const baths = q.match(/(\d+)\s*(?:bath ?rooms?|baths?|toilets?)\b/)
  if (baths) add({ key: 'spec:bathrooms', value: Number(baths[1]) })
  const floor = q.match(/(\d+)\s*(?:st|nd|rd|th)\s*floor\b/) ?? q.match(/\bfloor\s*(?:no\.?|number)?\s*(\d+)\b/)
  if (floor) add({ key: 'spec:floor', value: t === 'commercial' ? cap(`${floor[1]} floor`) : Number(floor[1]) })
  else if (/\bground floor\b/.test(q)) add({ key: 'spec:floor', value: t === 'commercial' ? 'Ground' : 0 })
  const gPlus = q.match(/\bg\s*\+\s*(\d+)\b/)
  if (gPlus) add({ key: t === 'house' ? 'spec:floors' : 'spec:totalFloors', value: Number(gPlus[1]) + 1, note: { k: 'gPlus', v: { n: gPlus[1] } } })
  const floors = q.match(/(\d+)\s*(?:floors|storeys?|stories|floor building)\b/)
  if (floors && !gPlus) add({ key: t === 'house' ? 'spec:floors' : 'spec:totalFloors', value: Number(floors[1]) })

  // facing
  for (const [re, f] of FACING_WORDS) if (re.test(q)) { add({ key: 'facing', value: f }); break }

  // price
  const rent = q.match(/([\d,.]+)\s*(k)?\s*(?:per month|\/\s*month|a month|pm)\b/)
  const priced =
    q.match(new RegExp(`(?:₹|rs\\.?|inr)\\s*([\\d,.]+)\\s*${UNIT_RE}?\\b`)) ??
    q.match(new RegExp(`(?:price|rate|cost|asking|rent)\\s*(?:is|of|:)?\\s*(?:now)?\\s*([\\d,.]+)\\s*${UNIT_RE}?\\b`)) ??
    q.match(new RegExp(`([\\d.]+)\\s*${UNIT_RE}\\b(?!\\s*(?:sq|ft|acre))`))
  if (rent) add({ key: 'price', value: money(rent[1], rent[2] ?? (parseFloat(rent[1]) < 1000 ? 'k' : undefined)) })
  else if (priced) {
    const v = money(priced[1], priced[2])
    if (!priced[2] && v < PRICE_ASK_BELOW) add({ key: 'priceUnit', value: v }) // "asking 45" — lakh or crore? the page asks
    else add({ key: 'price', value: v, note: /\bonwards\b/.test(q) ? { k: 'onwards' } : undefined })
  }

  // area: dimensions first (plots), then units
  const dims = q.match(/(\d+)\s*(?:ft|feet|')?\s*[x×*]\s*(\d+)\s*(?:ft|feet|')?/)
  if (dims && (t === 'plot' || !t)) {
    const a = Number(dims[1]), b = Number(dims[2])
    add({ key: 'spec:length', value: Math.max(a, b) })
    add({ key: 'spec:width', value: Math.min(a, b) })
    add({ key: 'area', value: a * b, note: { k: 'fromDims', v: { a, b } } })
  }
  for (const [re, factor, note] of AREA_UNITS) {
    for (const m of q.matchAll(re)) {
      const n = parseFloat(m[1].replace(/,/g, ''))
      const sqft = Math.round(n * factor)
      const after = q.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 14)
      const before = q.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0)
      if (note === 'fromAcres' && t === 'agri') add({ key: 'spec:acres', value: n })
      if (/\b(land|plot)\b/.test(after) && t === 'house') add({ key: 'spec:landArea', value: sqft })
      else if (/\bcarpet\b/.test(before + after)) add({ key: 'spec:carpet', value: sqft })
      else add({ key: 'area', value: sqft, note: note ? { k: note, v: { n } } : undefined })
    }
  }

  // plot and access details
  const road = q.match(/(\d+)\s*(?:ft|feet|')\s*(?:wide\s*)?road/)
  if (road) add({ key: 'spec:roadWidth', value: Number(road[1]) })
  if (/\bcorner\b/.test(q) && (t === 'plot' || !t)) add({ key: 'spec:corner', value: 'Corner' })
  if (/ready to move|ready-to-move|ready for occupation/.test(q)) add({ key: 'spec:possession', value: 'Ready to move' })
  else if (/under construction/.test(q) && t === 'flat') add({ key: 'spec:possession', value: 'Under construction' })
  if (/\b(tenanted|rented out|with (a )?tenant|leased out)\b/.test(q)) add({ key: 'spec:occupancy', value: 'Tenanted' })
  else if (/\bvacant\b/.test(q)) add({ key: 'spec:occupancy', value: 'Vacant' })
  if (t === 'agri') {
    const ws = q.match(/\b(borewell|open well|canal|river)\b/)
    if (ws) add({ key: 'spec:waterSource', value: { borewell: 'Borewell', 'open well': 'Open well', canal: 'Canal', river: 'River / channel' }[ws[1]]! })
  } else if (t === 'plot' || t === 'house') {
    const bore = /\bborewell\b/.test(q), muni = /\b(municipal|corporation|metro) water\b/.test(q)
    if (bore || muni) add({ key: 'spec:water', value: bore && muni ? 'Municipal + borewell' : bore ? 'Borewell' : 'Municipal supply' })
  }
  const kva = q.match(/(\d+)\s*kva\b/)
  if (kva) add({ key: 'spec:powerKva', value: Number(kva[1]) })
  if (/\b(car parking|covered parking|parking)\b/.test(q) && !/\bvisitor parking\b/.test(q)) {
    if (t === 'flat') add({ key: 'spec:parking', value: '1 covered' })
    if (t === 'house') add({ key: 'spec:parking', value: '1 car' })
  }

  // approvals and amenities
  const approvals: string[] = []
  if (/\brera\b/.test(q)) approvals.push('rera')
  if (/\b(dtcp|cmda|approved layout|building approval|plan approval|approved plan)\b/.test(q)) approvals.push('dtcp')
  if (approvals.length) add({ key: 'approvals', value: approvals })
  const amen = AMENITY_WORDS.filter(([re]) => re.test(q)).map(([, a]) => a)
  if (amen.length) add({ key: 'amenities', value: amen })

  // place: known localities and cities, then "<Locality>, <City>"
  for (const [city, locs] of Object.entries(CITIES)) {
    for (const loc of locs) {
      // a name in brackets is another name for the place ("OMR"), unless it only names the city ("K.K. Nagar (Trichy)")
      const alias = loc.match(/\(([^)]+)\)/)?.[1]
      const cityWord = alias && (Object.keys(CITIES).some((c) => c.toLowerCase() === alias.toLowerCase()) || /^(trichy|kovai)$/i.test(alias))
      const names = [loc, loc.replace(/\s*\(.*\)/, ''), ...(alias && !cityWord ? [alias] : [])]
      if (names.some((n) => new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(q))) {
        add({ key: 'locality', value: loc }); add({ key: 'city', value: city })
      }
    }
  }
  for (const city of Object.keys(CITIES)) if (new RegExp(`\\b${city.toLowerCase()}\\b`).test(q)) add({ key: 'city', value: city })
  if (/\btrichy\b/.test(q)) add({ key: 'city', value: 'Tiruchirappalli' })
  if (/\bkovai\b/.test(q)) add({ key: 'city', value: 'Coimbatore' })
  const newLoc = raw.match(new RegExp(`\\b(?:in|at)\\s+([A-Z][A-Za-z.]+(?:\\s[A-Z][A-Za-z.]+)?)\\s*,\\s*(${Object.keys(CITIES).join('|')})\\b`))
  if (newLoc) { add({ key: 'locality', value: newLoc[1] }); add({ key: 'city', value: newLoc[2] }) }

  // status words (Edit with AI)
  for (const [re, s] of STATUS_WORDS) if (re.test(q)) { add({ key: 'status', value: s }); break }

  // a bare answer to the question just asked
  if (asking && !facts.some((f) => f.key === asking)) {
    const ans = answerTo(asking, raw, t)
    if (ans) add(ans)
  }
  return facts
}

/** Interpret a short reply as the answer to `asking`. */
function answerTo(asking: string, raw: string, type?: PropertyTypeKey): Fact | null {
  const n = raw.match(/[\d,.]+/)?.[0]
  if (asking === 'price' && n) {
    const unit = raw.toLowerCase().match(new RegExp(`[\\d.]\\s*${UNIT_RE}\\b`))?.[1]
    const v = money(n, unit)
    return !unit && v < PRICE_ASK_BELOW ? { key: 'priceUnit', value: v } : { key: 'price', value: v }
  }
  if (asking === 'area' && n) return { key: 'area', value: Number(n.replace(/,/g, '')) }
  if (asking === 'title') return { key: 'title', value: raw }
  if (asking === 'locality' && raw.length < 40) return { key: 'locality', value: cap(raw) }
  if (asking === 'city' && raw.length < 30) return { key: 'city', value: Object.keys(CITIES).find((c) => c.toLowerCase() === raw.toLowerCase()) ?? cap(raw) }
  if (asking.startsWith('spec:') && type) {
    const def = PROPERTY_TYPES[type].facts.find((f) => f.key === asking.slice(5))
    if (!def) return null
    if (def.kind === 'number' && n) return { key: asking, value: Number(n.replace(/,/g, '')) }
    if (def.kind === 'select') {
      const opt = def.options!.find((o) => o.toLowerCase().includes(raw.toLowerCase()) || raw.toLowerCase().includes(o.toLowerCase().split(' ')[0]))
      if (opt) return { key: asking, value: opt }
    }
    if (def.kind === 'text') return { key: asking, value: raw }
  }
  return null
}

/* ---------- applying facts ---------- */

/** Put facts into the draft. `source` is recorded for each one: 'ai' for the chat, 'team' for a value typed on the card. */
export function applyFacts(d: Draft, facts: Fact[], source: FactSource = 'ai'): Draft {
  const next: Draft = structuredClone(d)
  next.sources ??= {}
  for (const f of facts) {
    if (f.key === 'priceUnit') continue // a question for the team, not a value
    next.sources[f.key] = source
    if (f.key.startsWith('spec:')) next.specs[f.key.slice(5)] = f.value as SpecValue
    else if (f.key === 'amenities') next.amenities = [...new Set([...next.amenities, ...(f.value as string[])])]
    else if (f.key === 'approvals') next.approvals = [...new Set([...next.approvals, ...(f.value as string[])])]
    else if (f.key === 'area') next.areaSqft = f.value as number
    else if (f.key === 'title') { next.title = String(f.value); next.titleEdited = true }
    else (next as Record<string, unknown>)[f.key] = f.value
  }
  // the type changed: keep only that type's facts
  if (next.type && next.type !== d.type && d.type) {
    const keys = new Set(PROPERTY_TYPES[next.type].facts.map((x) => x.key))
    next.specs = Object.fromEntries(Object.entries(next.specs).filter(([k]) => keys.has(k)))
  }
  if (!next.titleEdited) {
    next.title = suggestTitle(next)
    if (next.title) next.sources.title = 'ai'
  }
  return next
}

/**
 * Set one field from the details form, or clear it with an empty value. It is recorded as the team's own value.
 * A new type keeps only that type's details and drops a purpose the type doesn't allow (a plot can't be rented).
 */
export function setFact(d: Draft, key: string, value: Fact['value'] | undefined, source: FactSource = 'team'): Draft {
  if (value !== undefined && value !== '') {
    const next = applyFacts(d, [{ key, value }], source)
    if (key === 'type' && value !== d.type) {
      const def = PROPERTY_TYPES[next.type!]
      const keys = new Set(def.facts.map((x) => x.key))
      next.specs = Object.fromEntries(Object.entries(next.specs).filter(([k]) => keys.has(k)))
      if (next.purpose && !def.purposes.includes(next.purpose)) {
        next.purpose = undefined
        delete next.sources?.purpose
      }
    }
    return next
  }
  const next: Draft = structuredClone(d)
  next.sources ??= {}
  delete next.sources[key]
  if (key.startsWith('spec:')) delete next.specs[key.slice(5)]
  else if (key === 'area') next.areaSqft = undefined
  else if (key === 'title') { next.title = undefined; next.titleEdited = false }
  else (next as Record<string, unknown>)[key] = undefined
  if (!next.titleEdited) {
    next.title = suggestTitle(next)
    if (next.title) next.sources.title = 'ai'
  }
  return next
}

/** The AI's suggested title — the team can change it any time. Built only from facts already given. */
export function suggestTitle(d: Draft): string | undefined {
  if (!d.type || !d.locality) return undefined
  const s = d.specs
  const facing = d.facing ? { E: 'East', N: 'North', W: 'West', S: 'South', NE: 'North-east', NW: 'North-west', SE: 'South-east', SW: 'South-west' }[d.facing] + '-facing ' : ''
  const head: Record<PropertyTypeKey, string> = {
    plot: `${facing}plot`.replace(/^./, (c) => c.toUpperCase()),
    flat: `${s.bhk ? s.bhk + ' ' : ''}flat`.replace(/^./, (c) => c.toUpperCase()),
    house: String(s.subType ?? '').startsWith('Villa') ? `${s.bedrooms ? s.bedrooms + '-bedroom ' : ''}villa`.replace(/^./, (c) => c.toUpperCase())
      : `${s.bedrooms ? s.bedrooms + '-bedroom ' : ''}independent house`.replace(/^./, (c) => c.toUpperCase()),
    commercial: String(s.commCategory ?? 'Commercial space').split(' / ')[0],
    agri: s.acres ? `${s.acres} acres of farm land` : 'Farm land',
    industrial: String(s.subType ?? 'Industrial property'),
  }
  return `${head[d.type]} in ${d.locality}`
}

/* ---------- what's still needed ---------- */

export const CORE_ORDER = ['purpose', 'type', 'city', 'locality', 'price', 'area'] as const

/** Required facts in the order the assistant asks for them: the core ones, then the type's two key details. Title is suggested, not asked. */
export function requiredKeys(d: Draft): string[] {
  return [...CORE_ORDER, ...(d.type ? PROPERTY_TYPES[d.type].required.map((k) => `spec:${k}`) : ['spec:?', 'spec:??'])]
}

export function isSet(d: Draft, key: string): boolean {
  if (key.startsWith('spec:')) { const v = d.specs[key.slice(5)]; return v !== undefined && v !== '' }
  if (key === 'area') return !!d.areaSqft
  const v = (d as Record<string, unknown>)[key]
  return v !== undefined && v !== '' && v !== null
}

export const missingKeys = (d: Draft) => requiredKeys(d).filter((k) => !isSet(d, k)).concat(isSet(d, 'title') ? [] : ['title'])

export type Question = { key: string; options?: { label: string; value: SpecValue; i18n?: boolean }[]; hint?: boolean }

/** The next thing to ask — one at a time, with one-tap answers where the answer is a choice. */
export function nextQuestion(d: Draft): Question | null {
  const key = requiredKeys(d).find((k) => !isSet(d, k))
  if (!key) return isSet(d, 'title') ? null : { key: 'title' }
  return questionFor(d, key)
}

/** The question for one fact, with one-tap answers where the answer is a choice. */
export function questionFor(d: Draft, key: string): Question {
  if (key === 'title' || key === 'exactLocation') return { key }
  if (key === 'purpose') return { key, options: (d.type ? PROPERTY_TYPES[d.type].purposes : PURPOSES).map((p) => ({ label: `purpose.${p}`, value: p, i18n: true })) }
  if (key === 'type') return { key, options: TYPE_ORDER.map((ty) => ({ label: `type.${ty}`, value: ty, i18n: true })) }
  if (key === 'city') return { key, options: Object.keys(CITIES).map((c) => ({ label: c, value: c })) }
  if (key === 'locality') return { key, options: (CITIES[d.city ?? ''] ?? []).slice(0, 6).map((l) => ({ label: l, value: l })), hint: true }
  if (key === 'price' || key === 'area') return { key, hint: true }
  const def = PROPERTY_TYPES[d.type!].facts.find((f) => f.key === key.slice(5))!
  if (def.kind === 'select') return { key, options: def.options!.map((o) => ({ label: o, value: o })) }
  if (def.key === 'floor') return { key, options: [0, 1, 2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: n })), hint: true }
  if (def.key === 'bedrooms') return { key, options: [1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n })) }
  return { key, hint: true }
}

/* ---------- draft ⇄ property ---------- */

export function draftToProperty(d: Draft, id: string, by: string, at: string, status: PropertyStatus): Property {
  return {
    id,
    title: d.title ?? '',
    description: d.description,
    type: d.type!,
    purpose: d.purpose ?? 'sale',
    status,
    facing: d.facing,
    areaSqft: d.areaSqft ?? 0,
    price: d.price ?? 0,
    priceOnRequest: d.priceOnRequest || undefined,
    specs: { ...d.specs },
    amenities: [...d.amenities],
    location: { state: 'Tamil Nadu', city: d.city ?? '', locality: d.locality ?? '', exact: d.exactLocation, nearby: [] },
    media: Array.from({ length: d.photos }, (_, i) => ({ id: `${id}-ph${i + 1}`, kind: 'photo' as const, url: '', isCover: i === 0 })),
    approvals: d.approvals.map((a) => ({ approvalId: a, status: 'pending' as const })),
    documents: [],
    comparables: [],
    listedAt: status === 'draft' ? undefined : at,
    created: { by, at },
    updated: { by, at },
    history: [],
    sources: { ...d.sources },
    extraDetails: d.extraDetails?.length ? structuredClone(d.extraDetails) : undefined,
  }
}

export function propertyToDraft(p: Property): Draft {
  return {
    title: p.title, titleEdited: true, purpose: p.purpose, type: p.type, city: p.location.city, locality: p.location.locality,
    price: p.price, priceOnRequest: p.priceOnRequest, areaSqft: p.areaSqft, facing: p.facing, specs: { ...p.specs }, amenities: [...p.amenities],
    approvals: p.approvals.map((a) => a.approvalId), exactLocation: p.location.exact, photos: p.media.filter((m) => m.kind === 'photo').length,
    description: p.description, status: p.status, extraDetails: structuredClone(p.extraDetails ?? []),
  }
}

/* ---------- Edit with AI: what would change ---------- */

export type Change = { key: string; from: unknown; to: unknown }

/** Facts that differ from the current property. Type changes are not allowed in an edit. */
export function changesFor(d: Draft, facts: Fact[]): Change[] {
  const after = applyFacts({ ...d, titleEdited: true }, facts.filter((f) => f.key !== 'type'))
  const out: Change[] = []
  for (const f of facts) {
    if (f.key === 'type') continue
    const read = (x: Draft) => (f.key.startsWith('spec:') ? x.specs[f.key.slice(5)] : f.key === 'area' ? x.areaSqft : (x as Record<string, unknown>)[f.key])
    const from = read(d), to = read(after)
    if (Array.isArray(to)) {
      // lists (amenities, approvals) only grow in an edit: show just what's added
      const added = to.filter((x) => !(from as unknown[] | undefined)?.includes(x))
      if (added.length) out.push({ key: f.key, from: undefined, to: added })
    } else if (JSON.stringify(from) !== JSON.stringify(to)) out.push({ key: f.key, from, to })
  }
  return out
}

/** Write a confirmed edit back onto the stored property (Edit with AI → Apply). New approvals start as "document pending". */
export function writeDraftToProperty(p: Property, d: Draft) {
  p.title = d.title ?? p.title
  p.description = d.description
  p.purpose = d.purpose ?? p.purpose
  p.price = d.price ?? p.price
  p.areaSqft = d.areaSqft ?? p.areaSqft
  p.facing = d.facing
  p.specs = { ...d.specs }
  p.amenities = [...d.amenities]
  p.location.city = d.city ?? p.location.city
  p.location.locality = d.locality ?? p.location.locality
  if (d.exactLocation) p.location.exact = true
  for (const a of d.approvals) if (!p.approvals.some((x) => x.approvalId === a)) p.approvals.push({ approvalId: a, status: 'pending' })
  if (d.status) p.status = d.status
}

/** What a sample builder's brochure says (the wireframe's stand-in for reading a real PDF). */
export const SAMPLE_BROCHURE = {
  file: 'Green-Meadows-villas.pdf',
  page: 2,
  photos: 6,
  text: '3 BHK villa for sale in Saravanampatti, Coimbatore. 2,650 sq.ft built-up on 3,200 sq.ft land. 4 bathrooms. East facing. ' +
    'Price ₹1.65 Cr. DTCP approved. Gated community, clubhouse, power backup, CCTV. Borewell and corporation water. Car parking.',
}
export const SAMPLE_SHEET = { file: 'ABC Realty — plots.xlsx', rows: 48 }

/* ---------- the conversation, kept on the draft so it can be picked up again ---------- */

/**
 * A decision card: something the assistant can't settle alone, asked one at a time with buttons (spec-system-wireframe's queue).
 * dup — looks like a property we already have · newAmenity / newDetail — not on our lists · priceUnit — "45": lakh or crore? ·
 * priceCheck — the price per sq.ft. is far from similar listed properties · pin — a map link was pasted: is the pin right?
 */
export type Decision =
  | { kind: 'dup'; id: string }
  | { kind: 'newAmenity'; name: string }
  | { kind: 'newDetail'; label: string; value: string; number: boolean }
  | { kind: 'priceUnit'; n: number }
  | { kind: 'priceCheck'; ppsf: number; min: number; max: number; n: number }
  | { kind: 'pin' }

/** The buttons on each card, in order; the first is the suggested one. `manager` adds the choices that change master data. */
export function decisionChoices(x: Decision, o: { manager: boolean; hasType: boolean }): string[] {
  switch (x.kind) {
    case 'dup': return ['new', 'same']
    case 'newAmenity': return o.manager ? ['list', 'only', 'skip'] : ['only', 'skip']
    case 'newDetail': return o.manager && o.hasType ? ['type', 'only', 'skip'] : ['only', 'skip']
    case 'priceUnit': return ['lakh', 'crore', 'rupees']
    case 'priceCheck': return ['ok', 'change']
    case 'pin': return ['ok', 'again', 'later']
  }
}

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')

/** Another property (listed or a draft) of the same type in the same locality, within 10% of the area. Checked once per draft. */
export function findDuplicate(d: Draft, props: Property[], selfId?: string): Property | undefined {
  if (!d.type || !d.locality || !d.areaSqft) return undefined
  const loc = norm(d.locality)
  return props.find((o) => o.id !== selfId && !o.archived && o.type === d.type && norm(o.location.locality) === loc &&
    o.areaSqft > 0 && Math.abs(o.areaSqft - d.areaSqft!) / o.areaSqft <= 0.1)
}

/** The price per sq.ft. against listed properties of the same type, city and purpose (needs two): far below 60% of the lowest or above 160% of the highest. */
export function priceOutlier(d: Draft, props: Property[], selfId?: string): Extract<Decision, { kind: 'priceCheck' }> | undefined {
  if (!d.type || !d.city || !d.price || !d.areaSqft) return undefined
  const xs = props
    .filter((o) => o.id !== selfId && o.status !== 'draft' && !o.archived && o.type === d.type && o.location.city === d.city &&
      o.purpose === (d.purpose ?? o.purpose) && o.price > 0 && o.areaSqft > 0)
    .map((o) => Math.round(o.price / o.areaSqft))
  if (xs.length < 2) return undefined
  const ppsf = Math.round(d.price / d.areaSqft), min = Math.min(...xs), max = Math.max(...xs)
  return ppsf < min * 0.6 || ppsf > max * 1.6 ? { kind: 'priceCheck', ppsf, min, max, n: xs.length } : undefined
}

/** Words that describe the property itself, not an amenity ("with east facing", "with 2 car parks"). */
const NOT_AMENITY = /\b(parking|park(s)?\b|floor|bhk|road|water|borewell|approv|rera|dtcp|cmda|facing|sq|ft|feet|acre|cent|ground|bed ?rooms?|bath ?rooms?|toilets?|price|lakh|crore|tenant|possession|corner|loan|owner|ready)\b/i
/** Labels that aren't a detail ("price is 45 lakhs", "it is ready"). */
const NOT_LABEL = new Set(['it', 'this', 'that', 'there', 'price', 'rent', 'title', 'description', 'property', 'purpose', 'type', 'city', 'locality',
  'area', 'location', 'size', 'rate', 'cost', 'asking', 'facing', 'status', 'plot', 'flat', 'house', 'land', 'shop', 'office', 'villa', 'apartment', 'which', 'what'])

/**
 * What a message mentions that isn't on our lists: amenities after "has / with / includes", and "label: value" details.
 * A "label: value" that names one of the type's fields fills that field instead (`facts`).
 */
export function readNewThings(text: string, d: Draft, known: { amenities: string[]; facts: FactDef[] }): {
  amenities: string[]; details: { label: string; value: string; number: boolean }[]; facts: Fact[]
} {
  const out = { amenities: [] as string[], details: [] as { label: string; value: string; number: boolean }[], facts: [] as Fact[] }
  const plain = text.replace(/https?:\/\/\S+/gi, ' ')
  if (/^\s*(title|description)\s*:/i.test(plain)) return out
  const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  for (const m of plain.matchAll(/\b(?:has|have|having|with|includes?|including|features?|comes with|amenities(?:\s*(?::|are|include))?)\s+(.+?)(?=[.;]|$)/gi)) {
    for (const raw of m[1].split(/,|\band\b|&|\bplus\b/i)) {
      const it = raw.trim().replace(/^(a|an|the|also|its own|own|good|nice|private)\s+/i, '').replace(/\s+(too|also|as well|facility|facilities|available)$/i, '').trim()
      if (!it || /\d/.test(it) || it.split(/\s+/).length > 4 || it.length < 3) continue
      const listed = known.amenities.find((a) => norm(a) === norm(it) || (norm(it).length > 3 && norm(a).includes(norm(it))))
      if (listed) { if (!d.amenities.includes(listed)) out.facts.push({ key: 'amenities', value: [listed] }); continue }
      if (AMENITY_WORDS.some(([re]) => re.test(it.toLowerCase())) || NOT_AMENITY.test(it)) continue
      if (known.facts.some((f) => norm(f.label.replace(/\(.*\)/, '')) === norm(it))) continue
      const name = capFirst(it.toLowerCase())
      if (!d.amenities.some((a) => norm(a) === norm(name)) && !out.amenities.some((a) => norm(a) === norm(name))) out.amenities.push(name)
    }
  }

  for (const clause of plain.split(/[,;\n]|\.(?=\s|$)/)) {
    const m = clause.match(/^\s*(?:and\s+|also\s+|the\s+)?([a-z][a-z /&'-]{1,30}?)\s*(?::|=|\bis\b|\bare\b)\s*(.{1,40}?)\s*$/i)
    if (!m) continue
    const label = m[1].trim(), value = m[2].trim(), key = norm(label)
    if (key.length < 3 || NOT_LABEL.has(key) || !value || /^(a|an|the)$/i.test(value)) continue
    const fact = known.facts.find((f) => norm(f.key) === key || norm(f.label) === key || (key.length >= 5 && norm(f.label).startsWith(key)))
    if (fact) {
      const v = fact.kind === 'number' ? Number(value.replace(/[^\d.]/g, '')) || undefined
        : fact.kind === 'select' ? fact.options!.find((o) => norm(o).includes(norm(value)) || norm(value).includes(norm(o)))
          : capFirst(value)
      if (v !== undefined) out.facts.push({ key: `spec:${fact.key}`, value: v })
      continue
    }
    if ((d.extraDetails ?? []).some((x) => norm(x.label) === key) || out.details.some((x) => norm(x.label) === key)) continue
    out.details.push({ label: capFirst(label.toLowerCase()), value: capFirst(value), number: /^\d[\d,.]*$/.test(value) })
  }
  return out
}

/** Chat messages hold i18n keys and data, never finished sentences, so switching language re-renders them. */
export type ChatMsg =
  | { id: number; from: 'user'; text: string }
  | { id: number; from: 'ai'; kind: 'text'; key: string; values?: Record<string, string | number>; examples?: boolean }
  | { id: number; from: 'ai'; kind: 'read'; facts: Fact[] }
  | { id: number; from: 'ai'; kind: 'ask'; q: Question }
  | { id: number; from: 'ai'; kind: 'photos' }
  | { id: number; from: 'ai'; kind: 'amenities' }
  | { id: number; from: 'ai'; kind: 'approvals' }
  | { id: number; from: 'ai'; kind: 'ready' }
  | { id: number; from: 'ai'; kind: 'decide'; d: Decision }

/** A message before it gets its id. */
export type NewChatMsg = ChatMsg extends infer M ? (M extends ChatMsg ? Omit<M, 'id'> : never) : never

/** Optional steps the assistant offers once the required facts are in; each is offered once. */
export type OptionalStep = 'photos' | 'amenities'
export type AssistantThread = {
  chat: ChatMsg[]
  passed: OptionalStep[]
  /** Decision cards still to answer; the first is shown. */
  pending?: Decision[]
  /** The duplicate check runs once, when type, locality and area are first known. */
  dupChecked?: boolean
}

export type Step = { kind: 'ask'; q: Question } | { kind: 'photos' } | { kind: 'amenities' } | { kind: 'ready' }

/** What the assistant says next: the next required fact; then photos and amenities (both skippable); then "ready to publish". */
export function nextStep(d: Draft, passed: OptionalStep[]): Step {
  const q = nextQuestion(d)
  if (q) return { kind: 'ask', q }
  if (!d.photos && !passed.includes('photos')) return { kind: 'photos' }
  if (!passed.includes('amenities')) return { kind: 'amenities' }
  return { kind: 'ready' }
}

/**
 * The listing's completion score for a draft — the same weights as listingScore():
 * purpose, type, city, locality, price, area 10 each · key details 15 · photos 10 · legal documents 10 · amenities 5.
 * `docsUploaded`: approval documents in (by approval id), and whether any other legal document is in.
 */
export function draftScore(d: Draft, docs: { uploaded: string[]; any: boolean } = { uploaded: [], any: false }): number {
  const core = d.type ? PROPERTY_TYPES[d.type].core.filter((k) => PROPERTY_TYPES[d.type!].facts.some((f) => f.key === k)) : []
  const coreIn = core.filter((k) => isSet(d, `spec:${k}`)).length
  const legal = d.approvals.length ? d.approvals.filter((a) => docs.uploaded.includes(a)).length / d.approvals.length : docs.any ? 1 : 0
  const pts = CORE_ORDER.filter((k) => isSet(d, k)).length * 10 + (core.length ? (15 * coreIn) / core.length : 0) +
    (d.photos > 0 ? 10 : 0) + 10 * legal + (d.amenities.length ? 5 : 0)
  return Math.round(pts)
}

/* ---------- a draft record ⇄ the assistant's working copy ---------- */

/** The assistant's working copy of a saved draft. The title counts as the team's own unless the AI suggested it. */
export function draftFromRecord(p: Property): Draft {
  const d = propertyToDraft(p)
  // a saved draft keeps empty values as 0 / '' — the assistant treats them as not given yet
  if (!d.title) d.title = undefined
  if (!d.price) d.price = undefined
  if (!d.areaSqft) d.areaSqft = undefined
  if (!d.city) d.city = undefined
  if (!d.locality) d.locality = undefined
  // the record always has a purpose; in an assistant draft it counts only once someone gave it
  if (p.sources && !p.sources.purpose) d.purpose = undefined
  return { ...d, titleEdited: !!p.title && p.sources?.title !== 'ai', sources: { ...p.sources } }
}

/** Write the working copy onto the saved draft. Approvals keep their document state; photos are only ever added here. */
export function draftIntoRecord(p: Property, d: Draft) {
  p.title = d.title ?? ''
  p.description = d.description
  if (d.type) p.type = d.type
  p.purpose = d.purpose ?? p.purpose
  p.price = d.price ?? 0
  p.priceOnRequest = d.priceOnRequest || undefined
  p.areaSqft = d.areaSqft ?? 0
  p.facing = d.facing
  p.specs = { ...d.specs }
  p.amenities = [...d.amenities]
  p.location.city = d.city ?? ''
  p.location.locality = d.locality ?? ''
  p.location.exact = d.exactLocation
  p.approvals = d.approvals.map((a) => p.approvals.find((x) => x.approvalId === a) ?? { approvalId: a, status: 'pending' as const })
  const photos = p.media.filter((m) => m.kind === 'photo').length
  for (let i = photos; i < d.photos; i++) p.media.push({ id: `${p.id}-ph${i + 1}`, kind: 'photo', url: '', isCover: i === 0 })
  p.sources = { ...d.sources }
  if (d.extraDetails?.length) p.extraDetails = structuredClone(d.extraDetails)
  else delete p.extraDetails
}
