/**
 * Property list search — a port of spec-system-wireframe/property-search.js (rules only; the bar is in search-bar.tsx).
 * A keyword box with an ✨ AI sentence search, one row of filter pills (Type · City · Budget · Size · More) and Sort,
 * status tabs, the "needs attention" strip and paging. The "AI" reads a sentence into the same filters with simple rules;
 * a real build sends the sentence and this filter schema to the AI service and gets the same structure back.
 */
import { AMENITIES, CITIES, PROPERTY_TYPES } from '@/data/catalogue'
import type { Property, PropertyStatus, PropertyTypeKey, Purpose } from '@/data/types'
import type { Attention, AttentionKey } from '@/lib/property'

export type AiFilters = {
  locality?: string
  minPrice?: number
  maxPrice?: number
  minArea?: number
  maxArea?: number
  bhk?: number
  facing?: 'East' | 'West' | 'North' | 'South'
  corner?: boolean
  amen?: string[]
}
/** '' = newest first. Each sortable table column has a pair (low → high, high → low); the Sort pill lists them all. */
export type Sort = '' | 'oldest' | 'priceAsc' | 'priceDesc' | 'areaAsc' | 'areaDesc' | 'scoreAsc' | 'scoreDesc'
export type PSFilters = {
  q?: string
  /** a type key, or "cat:residential" / "cat:commercial" */
  type?: string
  city?: string
  purpose?: Purpose
  /** '' = all active, a status, or '__arch' = the Archived tab */
  status?: string
  sort?: Sort
  attn?: AttentionKey
  ai?: AiFilters
  aiText?: string
  aiRan?: string
  aiMiss?: boolean
}

/** One record in the shape the search reads (from a Property). */
export type PSItem = {
  raw: Property
  id: string
  title: string
  type: PropertyTypeKey
  purpose: Purpose
  city: string
  locality: string
  price: number
  area: number
  facing: string
  specs: Property['specs']
  amenities: string[]
  status: PropertyStatus
  archived: boolean
  date: string
  score: number
  attn: Attention[]
}

export const PAGE_SIZES = [10, 15, 25, 50, 100]
export const SORTS: Sort[] = ['', 'oldest', 'priceAsc', 'priceDesc', 'areaAsc', 'areaDesc', 'scoreAsc', 'scoreDesc']
export const EXAMPLES = ['2 BHK flat in Madurai under 60 lakh', 'East-facing plot in Madurai, 25 to 32 lakh', 'Villa in Coimbatore with swimming pool', 'Shop or office in Chennai', 'Corner plot above 1400 sq.ft.']
export const BUDGETS: [number | '', number | '', string][] = [['', 30e5, 'u30'], [30e5, 60e5, '30to60'], [60e5, 1e7, '60to1cr'], [1e7, 3e7, '1to3cr'], [3e7, '', '3crPlus']]
export const PRICES = [10e5, 20e5, 25e5, 30e5, 40e5, 50e5, 60e5, 75e5, 1e7, 1.5e7, 2e7, 3e7, 5e7]
export const AREAS = [500, 800, 1000, 1200, 1500, 2000, 2400, 3000, 5000, 10000]
export const FACING_WORD: Record<string, AiFilters['facing'] | undefined> = { E: 'East', W: 'West', N: 'North', S: 'South' }

export const categoryOf = (t: PropertyTypeKey) => PROPERTY_TYPES[t].category
const bhkOf = (x: PSItem) => parseInt(String(x.specs.bhk ?? ''), 10) || Number(x.specs.bedrooms) || 0

/** Does record x pass the filters f? `skip` lists criteria to leave out (used to suggest what to relax). */
export function matches(x: PSItem, f: PSFilters, skip: string[] = [], typeLabel: (t: PropertyTypeKey) => string = (t) => PROPERTY_TYPES[t].label): boolean {
  const a = f.ai ?? {}, on = (k: string) => !skip.includes(k), st = f.status ?? ''
  if (st === '__arch' && on('status')) { if (!x.archived) return false }
  else if (x.archived || (on('status') && st && x.status !== st)) return false
  if (on('attn') && f.attn && !x.attn.some((i) => i.key === f.attn)) return false
  if (on('type') && f.type && (f.type.startsWith('cat:') ? categoryOf(x.type) !== f.type.slice(4) : x.type !== f.type)) return false
  if (on('city') && f.city && x.city !== f.city) return false
  if (on('locality') && a.locality && x.locality !== a.locality) return false
  if (on('purpose') && f.purpose && x.purpose !== f.purpose) return false
  if (on('q') && f.q) {
    const hay = [x.id, x.title, x.locality, x.city, typeLabel(x.type), categoryOf(x.type), x.purpose, x.facing, x.specs.bhk, x.specs.subType, x.specs.commCategory].join(' ').toLowerCase()
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false // every word, in any order
  }
  if (on('price') && ((a.minPrice && x.price < a.minPrice) || (a.maxPrice && x.price > a.maxPrice))) return false
  if (on('area') && ((a.minArea && x.area < a.minArea) || (a.maxArea && x.area > a.maxArea))) return false
  if (on('bhk') && a.bhk && (a.bhk >= 5 ? bhkOf(x) < 5 : bhkOf(x) !== a.bhk)) return false
  if (on('facing') && a.facing && x.facing.toLowerCase() !== a.facing.toLowerCase()) return false
  if (on('corner') && a.corner && x.specs.corner !== 'Corner') return false
  if ((a.amen ?? []).some((m) => on('amen:' + m) && !x.amenities.includes(m))) return false
  return true
}

/** The number each sort orders by, and its direction (1 = low to high). */
const SORT_BY: Record<Exclude<Sort, '' | 'oldest'>, [(x: PSItem) => number, 1 | -1]> = {
  priceAsc: [(x) => x.price, 1], priceDesc: [(x) => x.price, -1],
  areaAsc: [(x) => x.area, 1], areaDesc: [(x) => x.area, -1],
  scoreAsc: [(x) => x.score, 1], scoreDesc: [(x) => x.score, -1],
}

export function sortList(list: PSItem[], by: Sort = ''): PSItem[] {
  const newest = (x: PSItem, y: PSItem) => (y.date || '').localeCompare(x.date || '') || y.id.localeCompare(x.id)
  if (by === '') return [...list].sort(newest)
  if (by === 'oldest') return [...list].sort((x, y) => newest(y, x))
  const [value, dir] = SORT_BY[by]
  return [...list].sort((x, y) => dir * (value(x) - value(y)) || newest(x, y)) // equal values: newest first
}

/** Every active criterion, as { k, kind, value } — the bar turns it into words. */
export type Criterion = { k: string; kind: string; value?: string | number | [number?, number?] }
export function criteria(f: PSFilters): Criterion[] {
  const a = f.ai ?? {}, out: Criterion[] = []
  if (f.type) out.push({ k: 'type', kind: 'type', value: f.type })
  if (a.bhk) out.push({ k: 'bhk', kind: 'bhk', value: a.bhk })
  if (f.purpose) out.push({ k: 'purpose', kind: 'purpose', value: f.purpose })
  if (a.locality) out.push({ k: 'locality', kind: 'text', value: a.locality })
  if (f.city) out.push({ k: 'city', kind: 'text', value: f.city })
  if (a.minPrice || a.maxPrice) out.push({ k: 'price', kind: 'price', value: [a.minPrice, a.maxPrice] })
  if (a.minArea || a.maxArea) out.push({ k: 'area', kind: 'area', value: [a.minArea, a.maxArea] })
  if (a.facing) out.push({ k: 'facing', kind: 'facing', value: a.facing })
  if (a.corner) out.push({ k: 'corner', kind: 'corner' })
  ;(a.amen ?? []).forEach((m) => out.push({ k: 'amen:' + m, kind: 'amen', value: m }))
  if (f.status) out.push({ k: 'status', kind: 'status', value: f.status })
  if (f.attn) out.push({ k: 'attn', kind: 'attn' })
  if (f.q) out.push({ k: 'q', kind: 'q', value: f.q })
  return out
}

/** Nothing found: the smallest change (drop one filter, else two) that brings records back. */
export function relaxFor(items: PSItem[], f: PSFilters): { drop: Criterion[]; n: number } | null {
  const crit = criteria(f)
  if (!crit.length) return null
  const count = (cs: Criterion[]) => items.filter((x) => matches(x, f, cs.map((c) => c.k))).length
  const singles = crit.map((c) => [c])
  const pairs = crit.flatMap((c, i) => crit.slice(i + 1).map((d) => [c, d]))
  for (const sets of [singles, pairs]) {
    const best = sets.map((cs) => ({ drop: cs, n: count(cs) })).filter((x) => x.n).sort((x, y) => y.n - x.n)[0]
    if (best) return best
  }
  return null
}

/** Drop criteria by key (the "Show N without …" button, a pill's ✕). */
export function dropKeys(f: PSFilters, keys: string[]): PSFilters {
  const n: PSFilters = structuredClone(f), a = n.ai ?? {}
  for (const k of keys) {
    if (k === 'price') { delete a.minPrice; delete a.maxPrice }
    else if (k === 'area') { delete a.minArea; delete a.maxArea }
    else if (k.startsWith('amen:')) { a.amen = (a.amen ?? []).filter((m) => m !== k.slice(5)); if (!a.amen.length) delete a.amen }
    else if (k in a || ['locality', 'bhk', 'facing', 'corner', 'amen'].includes(k)) delete (a as Record<string, unknown>)[k]
    else delete (n as Record<string, unknown>)[k]
    if (k === 'city') delete a.locality
  }
  n.ai = Object.keys(a).length ? a : undefined
  return n
}

/** Set one filter from a pill panel (single choices close the panel — the caller decides). */
export function setValue(f: PSFilters, k: string, v: string | number | boolean | ''): PSFilters {
  const n: PSFilters = structuredClone(f), a: AiFilters = n.ai ?? {}
  if (k === 'budget') {
    const [lo, hi] = String(v).split('-')
    if (lo) a.minPrice = +lo; else delete a.minPrice
    if (hi) a.maxPrice = +hi; else delete a.maxPrice
  } else if (k === 'amen') {
    const set = new Set(a.amen ?? []); if (set.has(String(v))) set.delete(String(v)); else set.add(String(v))
    a.amen = AMENITIES.filter((m) => set.has(m)); if (!a.amen.length) delete a.amen
  } else if (k === 'corner') { if (a.corner) delete a.corner; else a.corner = true }
  else if (['locality', 'minPrice', 'maxPrice', 'minArea', 'maxArea', 'bhk', 'facing'].includes(k)) {
    if (v === '') delete (a as Record<string, unknown>)[k]
    else (a as Record<string, unknown>)[k] = ['locality', 'facing'].includes(k) ? v : +v
  } else { if (v === '') delete (n as Record<string, unknown>)[k]; else (n as Record<string, unknown>)[k] = v }
  if (a.minPrice && a.maxPrice && a.minPrice > a.maxPrice) [a.minPrice, a.maxPrice] = [a.maxPrice, a.minPrice] // min above max: swap
  if (a.minArea && a.maxArea && a.minArea > a.maxArea) [a.minArea, a.maxArea] = [a.maxArea, a.minArea]
  if (k === 'city') delete a.locality
  if (k === 'locality' && v) n.city = Object.keys(CITIES).find((c) => CITIES[c].includes(String(v))) ?? n.city
  n.ai = Object.keys(a).length ? a : undefined
  delete n.aiMiss
  return n
}

/* ---------- the (simulated) AI: a sentence → the same filters ---------- */

export function parseSentence(text: string, statuses: PropertyStatus[]): PSFilters {
  let t = ' ' + text.toLowerCase().replace(/[,;!?]/g, ' ').replace(/₹/g, ' ').replace(/\s+/g, ' ') + ' '
  const f: PSFilters = {}, a: AiFilters = {}
  const has = (re: RegExp) => re.test(t)
  const cut = (x: string) => { t = t.replace(x, ' ') }
  const money = (n: string, u?: string) => {
    const v = parseFloat(n); u = (u || '').trim()
    if (/^c/.test(u)) return v * 1e7
    if (/^l/.test(u)) return v * 1e5
    if (u === 'k') return v * 1e3
    return v < 1000 ? v * 1e5 : v // a bare small number means lakh
  }
  const sqft = (n: string, u: string) => { const v = parseFloat(n); return /cent/.test(u) ? Math.round(v * 435.6) : /acre/.test(u) ? Math.round(v * 43560) : v }
  const N = '(\\d+(?:\\.\\d+)?)', U = '(crores?|cr|lakhs?|lacs?|l|k)?', A = '(sq\\.? ?ft\\.?|sqft|square feet|sft|cents?|acres?)'
  let m: RegExpMatchArray | null
  // area first, so its numbers are not read as a price
  if ((m = t.match(new RegExp(`${N} ?(?:-|to|and) ?${N} ?${A}`)))) { a.minArea = sqft(m[1], m[3]); a.maxArea = sqft(m[2], m[3]); cut(m[0]) }
  else if ((m = t.match(new RegExp(`(under|below|less than|upto|up to|max|within) ${N} ?${A}`)))) { a.maxArea = sqft(m[2], m[3]); cut(m[0]) }
  else if ((m = t.match(new RegExp(`(?:(above|over|more than|at least|min|minimum|around|about) )?${N} ?${A}`)))) {
    const v = sqft(m[2], m[3])
    if (/around|about/.test(m[1] || '')) { a.minArea = Math.round(v * 0.85); a.maxArea = Math.round(v * 1.15) } else a.minArea = v
    cut(m[0])
  }
  if ((m = t.match(/(\d) ?(?:bhk|bed ?rooms?|beds?)\b/))) { a.bhk = +m[1]; cut(m[0]) }
  // price
  if ((m = t.match(new RegExp(`(?:between )?${N} ?${U} ?(?:-|to|and) ?${N} ?${U}(?= )`)))) { a.minPrice = money(m[1], m[2] || m[4]); a.maxPrice = money(m[3], m[4]); cut(m[0]) }
  else {
    if ((m = t.match(new RegExp(`(under|below|less than|within|upto|up to|max|maximum|budget(?: of| is)?|not more than) ${N} ?${U}(?= )`)))) { a.maxPrice = money(m[2], m[3]); cut(m[0]) }
    if ((m = t.match(new RegExp(`(above|over|more than|min|minimum|at least|starting) ${N} ?${U}(?= )`)))) { a.minPrice = money(m[2], m[3]); cut(m[0]) }
    if ((m = t.match(new RegExp(`(around|about|approx|approximately) ${N} ?${U}(?= )`)))) { const v = money(m[2], m[3]); a.minPrice = Math.round(v * 0.85); a.maxPrice = Math.round(v * 1.15); cut(m[0]) }
  }
  // type / category
  const TYPES: [PropertyTypeKey, RegExp][] = [['agri', /\b(agricultural|agri|farm ?lands?|farms?)\b/], ['industrial', /\b(industrial|sheds?|factory)\b/],
    ['commercial', /\b(office|offices|shops?|showrooms?|warehouses?|godowns?|retail)\b/], ['house', /\b(houses?|villas?|independent|bungalows?)\b/],
    ['flat', /\b(flats?|apartments?)\b/], ['plot', /\b(plots?|sites?|lands?)\b/]]
  const hit = TYPES.filter(([, re]) => has(re)).map(([k]) => k)
  if (hit.length === 1) f.type = hit[0]
  else if (hit.length > 1) { if (hit.every((k) => categoryOf(k) === categoryOf(hit[0]))) f.type = 'cat:' + categoryOf(hit[0]) }
  else if (a.bhk) f.type = 'flat'
  else if (has(/\bresidential\b/)) f.type = 'cat:residential'
  else if (has(/\bcommercial\b/)) f.type = 'cat:commercial'
  // place: locality first (it tells the city too)
  const ALIAS: Record<string, string> = { trichy: 'Tiruchirappalli', kovai: 'Coimbatore', madras: 'Chennai' }
  for (const [c, locs] of Object.entries(CITIES)) for (const l of locs) {
    const names = [l.replace(/ \(.*\)$/, ''), (l.match(/\((.*)\)/) || [])[1]].filter((n): n is string => !!n && n.length > 2 && !CITIES[n])
    if (!a.locality && names.some((n) => t.includes(' ' + n.toLowerCase() + ' '))) { a.locality = l; f.city = c }
  }
  if (!f.city) {
    const c = Object.keys(CITIES).find((x) => t.includes(' ' + x.toLowerCase() + ' ')) ?? Object.entries(ALIAS).find(([k]) => t.includes(' ' + k + ' '))?.[1]
    if (c) f.city = c
  }
  if (has(/\b(rent|rental|to let)\b/)) f.purpose = 'rent'; else if (has(/\blease\b/)) f.purpose = 'lease'; else if (has(/\b(buy|sale|sell|purchase)\b/)) f.purpose = 'sale'
  if ((m = t.match(/\b(north|south|east|west)[- ]?facing\b|\bfacing (north|south|east|west)\b/))) { const d = m[1] || m[2]; a.facing = (d[0].toUpperCase() + d.slice(1)) as AiFilters['facing'] }
  if (has(/\bcorner\b/)) a.corner = true
  const AM: Record<string, RegExp> = {
    'Swimming pool': /\b(swimming pool|pool)\b/, Gym: /\b(gym|fitness)\b/, Lift: /\b(lift|elevator)\b/, 'Gated community': /\bgated\b/, Security: /\bsecurity\b/, CCTV: /\bcctv\b/,
    Clubhouse: /\bclub ?house\b/, 'Power backup': /\b(power backup|backup|generator)\b/, 'Park / open space': /\b(park|open space)\b/, 'Rainwater harvesting': /\brain ?water\b/,
    'Visitor parking': /\bvisitor parking\b/, 'Loading bay': /\bloading\b/,
  }
  const amen = Object.entries(AM).filter(([, re]) => has(re)).map(([k]) => k)
  if (amen.length) a.amen = amen
  // a status named in the sentence ("sold", "on hold", "under negotiation"); "available" / "unsold"; "archived"
  const words: Record<PropertyStatus, string> = { draft: 'draft', available: 'available', negotiation: 'under negotiation', reserved: 'reserved', booked: 'booked', onHold: 'on hold', sold: 'sold' }
  const stHit = statuses.find((s) => s !== 'available' && t.includes(' ' + words[s] + ' '))
  if (stHit) f.status = stHit
  else if (has(/\b(available|unsold)\b/)) f.status = 'available'
  if (has(/\barchived?\b/)) f.status = '__arch'
  if (has(/\b(cheapest|lowest price|low to high|budget friendly|affordable)\b/)) f.sort = 'priceAsc'
  else if (has(/\b(most expensive|highest price|high to low|premium|luxury)\b/)) f.sort = 'priceDesc'
  else if (has(/\b(least complete|missing details|low score)\b/)) f.sort = 'scoreAsc'
  if (Object.keys(a).length) f.ai = a
  return f
}
