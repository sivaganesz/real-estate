/**
 * The property assistant (Add property, Edit with AI).
 * In the product, one AI call per message returns facts in a fixed shape — { key, value, note } — and code checks them.
 * The wireframe produces the same shape with simple rules, so the screens won't change when the real AI arrives.
 * Rules the assistant keeps (CTO-approved): it never invents a fact; it asks only for missing required facts, one at a time;
 * a person publishes.
 */
import { CITIES, PROPERTY_TYPES, PURPOSES, TYPE_ORDER } from '@/data/catalogue'
import type { Facing, Property, PropertyStatus, PropertyTypeKey, Purpose, SpecValue } from '@/data/types'

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
  areaSqft?: number
  facing?: Facing
  specs: Record<string, SpecValue>
  amenities: string[]
  /** Approval ids claimed (RERA, building approval). Each starts as "document pending". */
  approvals: string[]
  exactLocation: boolean
  photos: number
  description?: string
  /** Edit mode only. */
  status?: PropertyStatus
}

export const EMPTY_DRAFT: Draft = { specs: {}, amenities: [], approvals: [], exactLocation: false, photos: 0 }

/** One fact read from a message. `key` is a draft field, or `spec:<fact key>` for a type's own fact. */
export type Fact = {
  key: string
  value: SpecValue | string[] | boolean
  /** What the assistant worked out, shown under the fact (an i18n key + values). */
  note?: { k: string; v?: Record<string, string | number> }
}

/* ---------- reading a message ---------- */

const UNIT_RE = '(l|lakh|lakhs|lac|lacs|cr|crore|crores|k)'
function money(n: string, unit?: string): number {
  const v = parseFloat(n.replace(/,/g, ''))
  if (!unit) return v >= 100000 ? v : v * 1e5 // a bare "62" in a price means 62 lakh
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
  else if (priced) add({ key: 'price', value: money(priced[1], priced[2]), note: /\bonwards\b/.test(q) ? { k: 'onwards' } : undefined })

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
      const names = [loc, loc.replace(/\s*\(.*\)/, ''), ...(loc.match(/\(([^)]+)\)/)?.slice(1) ?? [])]
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
  if (asking === 'price' && n) return { key: 'price', value: money(n, raw.toLowerCase().match(new RegExp(UNIT_RE))?.[1]) }
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

export function applyFacts(d: Draft, facts: Fact[]): Draft {
  const next: Draft = structuredClone(d)
  for (const f of facts) {
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
  if (!next.titleEdited) next.title = suggestTitle(next)
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
  }
}

export function propertyToDraft(p: Property): Draft {
  return {
    title: p.title, titleEdited: true, purpose: p.purpose, type: p.type, city: p.location.city, locality: p.location.locality,
    price: p.price, areaSqft: p.areaSqft, facing: p.facing, specs: { ...p.specs }, amenities: [...p.amenities],
    approvals: p.approvals.map((a) => a.approvalId), exactLocation: p.location.exact, photos: p.media.filter((m) => m.kind === 'photo').length,
    description: p.description, status: p.status,
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
