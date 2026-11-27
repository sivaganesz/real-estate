/**
 * Plain-words property search: "3BHK Whitefield under 1.2 Cr ready to move east facing" → filters the user can see and
 * remove. Merged from wireframe-rebuild/src/lib/search.ts (parseQuery / applyFilters) and
 * features/properties/search/prop-search.ts (parseSentence, relaxFor), re-keyed to the crm-e2e catalogue.
 * The simulated AI and the Properties search share it; a live AI returns the same shape.
 */
import type { Configuration, Facing, Furnishing, Property, PropertyStatus, PropertyType } from '@/domain/types'
import { AMENITIES, CITIES, PROPERTY_TYPES, categoryOf } from '@/domain/catalogue'
import type { TFunction } from 'i18next'
import { inrShort, num } from './format'
import { configLabel } from './matching'
import { primaryAreaSqft } from './property'

export type PropertySort = '' | 'oldest' | 'priceAsc' | 'priceDesc' | 'areaAsc' | 'areaDesc'
export type PropertyFilters = {
  types: PropertyType[]
  purpose?: Property['purpose']
  cities: string[]
  localities: string[]
  minPrice?: number
  maxPrice?: number
  minArea?: number
  maxArea?: number
  configurations: Configuration[]
  facing: Facing[]
  possession?: 'ready' | 'underConstruction'
  furnishing?: Furnishing
  amenities: string[]
  statuses: PropertyStatus[]
  corner?: boolean
  vastu?: boolean
  /** Words not understood as a filter: matched against id, title, project and place. */
  text?: string
  sort?: PropertySort
}

export const EMPTY_PROPERTY_FILTERS: PropertyFilters = { types: [], cities: [], localities: [], configurations: [], facing: [], amenities: [], statuses: [] }

export const hasPropertyFilters = (f: PropertyFilters) =>
  f.types.length + f.cities.length + f.localities.length + f.configurations.length + f.facing.length + f.amenities.length + f.statuses.length > 0 ||
  !!(f.purpose || f.minPrice || f.maxPrice || f.minArea || f.maxArea || f.possession || f.furnishing || f.corner || f.vastu || f.text)

const CITY_ALIASES: Record<string, string> = { bangalore: 'Bengaluru', blr: 'Bengaluru', madras: 'Chennai', hyd: 'Hyderabad', bombay: 'Mumbai', gurgaon: 'NCR', delhi: 'NCR' }
const FACING_WORDS: [RegExp, Facing][] = [
  [/\bnorth[- ]?east\b|\bne\b/, 'NE'], [/\bnorth[- ]?west\b|\bnw\b/, 'NW'], [/\bsouth[- ]?east\b|\bse\b/, 'SE'], [/\bsouth[- ]?west\b|\bsw\b/, 'SW'],
  [/\beast\b/, 'E'], [/\bwest\b/, 'W'], [/\bnorth\b/, 'N'], [/\bsouth\b/, 'S'],
]
const TYPE_WORDS: [RegExp, PropertyType][] = [
  [/\b(agricultural|agri|farm ?lands?|farms?)\b/, 'agriLand'], [/\b(warehouses?|godowns?)\b/, 'warehouse'],
  [/\b(co-?working)\b/, 'coworking'], [/\b(showrooms?)\b/, 'showroom'], [/\b(shops?|retail)\b/, 'shop'], [/\b(offices?)\b/, 'office'],
  [/\b(villas?|bungalows?)\b/, 'villa'], [/\brow ?houses?\b/, 'rowHouse'], [/\b(independent house|houses?)\b/, 'independentHouse'],
  [/\b(flats?|apartments?)\b/, 'apartment'], [/\b(plots?|sites?)\b/, 'plot'],
]
const AMENITY_WORDS: Record<string, RegExp> = {
  swimmingPool: /\b(swimming pool|pool)\b/, gym: /\b(gym|fitness)\b/, lift: /\b(lift|elevator)\b/, gatedCommunity: /\bgated\b/,
  security: /\bsecurity\b/, cctv: /\bcctv\b/, clubhouse: /\bclub ?house\b/, powerBackup: /\b(power backup|generator)\b/,
  parkOpenSpace: /\b(park|open space)\b/, rainwaterHarvesting: /\brain ?water\b/, coveredParking: /\bcovered parking\b/,
  kidsPlayArea: /\b(kids|play area)\b/, joggingTrack: /\bjogging\b/, evCharging: /\b(ev|charging)\b/, water24x7: /\b24 ?x ?7 water|24\/7 water\b/,
}

function money(n: string, unit?: string): number {
  const v = parseFloat(n)
  const u = (unit ?? '').trim()
  if (/^c/.test(u)) return Math.round(v * 1e7)
  if (/^l/.test(u)) return Math.round(v * 1e5)
  if (u === 'k') return Math.round(v * 1e3)
  return v < 1000 ? Math.round(v * 1e5) : v // a bare small number in a price phrase means lakhs
}
const areaSqft = (n: string, u: string) => {
  const v = parseFloat(n)
  return /cent/.test(u) ? Math.round(v * 435.6) : /acre/.test(u) ? Math.round(v * 43560) : /sq\.? ?y|yard/.test(u) ? Math.round(v * 9) : v
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Reads a sentence into filters. Words it does not know are kept as free text. */
export function parsePropertyQuery(input: string): PropertyFilters {
  let t = ` ${input.toLowerCase().replace(/[,;!?]/g, ' ').replace(/₹/g, ' ').replace(/\s+/g, ' ')} `
  const f: PropertyFilters = structuredClone(EMPTY_PROPERTY_FILTERS)
  const cut = (x: string | RegExp) => { t = t.replace(x, ' ') }
  const N = '(\\d+(?:\\.\\d+)?)'
  const U = '(crores?|cr|lakhs?|lacs?|lac|l|k)?'
  const A = '(sq\\.? ?ft\\.?|sqft|square feet|sft|sq\\.? ?yds?|square yards?|cents?|acres?)'
  let m: RegExpExecArray | null

  // area first, so its numbers are not read as a price
  if ((m = new RegExp(`${N} ?(?:-|to) ?${N} ?${A}`).exec(t))) { f.minArea = areaSqft(m[1], m[3]); f.maxArea = areaSqft(m[2], m[3]); cut(m[0]) }
  else if ((m = new RegExp(`(?:under|below|less than|upto|up to|max) ${N} ?${A}`).exec(t))) { f.maxArea = areaSqft(m[1], m[2]); cut(m[0]) }
  else if ((m = new RegExp(`(?:(above|over|more than|at least|min|around|about) )?${N} ?${A}`).exec(t))) {
    const v = areaSqft(m[2], m[3])
    if (/around|about/.test(m[1] ?? '')) { f.minArea = Math.round(v * 0.85); f.maxArea = Math.round(v * 1.15) } else f.minArea = v
    cut(m[0])
  }
  // configuration
  if ((m = /(\d(?:\.5)?) ?(?:bhk|bed ?rooms?|beds?)\b/.exec(t))) {
    const n = parseFloat(m[1])
    f.configurations.push(n >= 4 ? '4BHK+' : (`${m[1]}BHK` as Configuration))
    cut(m[0])
  }
  if (/\b1 ?rk\b/.test(t)) { f.configurations.push('1RK'); cut(/\b1 ?rk\b/) }
  // price
  if ((m = new RegExp(`(?:between )?${N} ?${U} ?(?:-|to|and) ?${N} ?${U}(?= )`).exec(t))) { f.minPrice = money(m[1], m[2] || m[4]); f.maxPrice = money(m[3], m[4]); cut(m[0]) }
  else {
    if ((m = new RegExp(`(?:under|below|less than|within|upto|up to|max|maximum|budget(?: of| is)?) ${N} ?${U}(?= )`).exec(t))) { f.maxPrice = money(m[1], m[2]); cut(m[0]) }
    if ((m = new RegExp(`(?:above|over|more than|min|minimum|at least|starting) ${N} ?${U}(?= )`).exec(t))) { f.minPrice = money(m[1], m[2]); cut(m[0]) }
    if ((m = new RegExp(`(?:around|about|approx|approximately) ${N} ?${U}(?= )`).exec(t))) { const v = money(m[1], m[2]); f.minPrice = Math.round(v * 0.85); f.maxPrice = Math.round(v * 1.15); cut(m[0]) }
  }
  // possession
  if (/\b(ready to move|ready-to-move|rtm|ready)\b/.test(t)) { f.possession = 'ready'; cut(/\b(ready to move|ready-to-move|rtm|ready)\b/) }
  else if (/\bunder ?construction\b/.test(t)) { f.possession = 'underConstruction'; cut(/\bunder ?construction\b/) }
  // facing
  if (/facing/.test(t)) {
    for (const [re, val] of FACING_WORDS) if (re.test(t)) { f.facing.push(val); cut(new RegExp(re.source + '(?:[- ]?facing)?')); break }
    cut(/\bfacing\b/)
  }
  // furnishing
  if (/\bsemi[- ]?furnished\b/.test(t)) { f.furnishing = 'semi'; cut(/\bsemi[- ]?furnished\b/) }
  else if (/\bunfurnished\b/.test(t)) { f.furnishing = 'unfurnished'; cut(/\bunfurnished\b/) }
  else if (/\b(fully )?furnished\b/.test(t)) { f.furnishing = 'full'; cut(/\b(fully )?furnished\b/) }
  // purpose
  if (/\b(for rent|rent|rental|to let)\b/.test(t)) { f.purpose = 'rent'; cut(/\b(for rent|rental|rent|to let)\b/) }
  else if (/\blease\b/.test(t)) { f.purpose = 'lease'; cut(/\b(for )?lease\b/) }
  else if (/\b(for sale|buy|sale)\b/.test(t)) { f.purpose = 'sale'; cut(/\b(for sale|buy|sale)\b/) }
  // type
  for (const [re, type] of TYPE_WORDS) if (re.test(t)) { if (!f.types.includes(type)) f.types.push(type); cut(new RegExp(re.source, 'g')) }
  if (!f.types.length && f.configurations.length) f.types.push('apartment')
  if (!f.types.length && /\bcommercial\b/.test(t)) { f.types.push('office', 'shop', 'showroom', 'coworking', 'warehouse'); cut(/\bcommercial\b/) }
  // flags
  if (/\bcorner\b/.test(t)) { f.corner = true; cut(/\bcorner\b/) }
  if (/\bvastu\b/.test(t)) { f.vastu = true; cut(/\bvastu( compliant)?\b/) }
  for (const [key, re] of Object.entries(AMENITY_WORDS)) if (re.test(t)) { f.amenities.push(key); cut(re) }
  // status
  if (/\bon hold\b/.test(t)) { f.statuses.push('onHold'); cut(/\bon hold\b/) }
  if (/\bsold\b/.test(t)) { f.statuses.push('sold'); cut(/\bsold\b/) }
  if (/\bbooked\b/.test(t)) { f.statuses.push('booked'); cut(/\bbooked\b/) }
  if (/\b(available|unsold)\b/.test(t)) { f.statuses.push('available'); cut(/\b(available|unsold)\b/) }
  // sort
  if (/\b(cheapest|lowest price|low to high|affordable)\b/.test(t)) { f.sort = 'priceAsc'; cut(/\b(cheapest|lowest price|low to high|affordable)\b/) }
  else if (/\b(most expensive|highest price|high to low|premium|luxury)\b/.test(t)) { f.sort = 'priceDesc'; cut(/\b(most expensive|highest price|high to low|premium|luxury)\b/) }
  // places: localities first (they tell the city too), then cities and aliases
  for (const [city, locs] of Object.entries(CITIES)) {
    for (const loc of locs) {
      const re = new RegExp(`\\b${escape(loc.toLowerCase())}\\b`)
      if (re.test(t)) { if (!f.localities.includes(loc)) f.localities.push(loc); if (!f.cities.includes(city)) f.cities.push(city); cut(re) }
    }
  }
  for (const city of Object.keys(CITIES)) {
    const re = new RegExp(`\\b${escape(city.toLowerCase())}\\b`)
    if (re.test(t)) { if (!f.cities.includes(city)) f.cities.push(city); cut(re) }
  }
  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    const re = new RegExp(`\\b${alias}\\b`)
    if (re.test(t)) { if (!f.cities.includes(city)) f.cities.push(city); cut(re) }
  }

  const STOP = new Set(['in', 'at', 'for', 'with', 'near', 'the', 'a', 'an', 'and', 'or', 'of', 'to', 'show', 'me', 'find', 'any', 'all', 'property', 'properties', 'homes', 'home', 'under', 'within', 'move', 'lakh', 'lakhs', 'cr', 'crore', 'l'])
  const rest = t.split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w) && !/^\d/.test(w))
  if (rest.length) f.text = rest.join(' ')
  return f
}

/** Does a property pass the filters? `skip` lists criteria keys to leave out (used to suggest what to relax). */
export function propertyMatchesFilters(p: Property, f: PropertyFilters, skip: string[] = []): boolean {
  const on = (k: string) => !skip.includes(k)
  if (on('type') && f.types.length && !f.types.includes(p.type)) return false
  if (on('purpose') && f.purpose && p.purpose !== f.purpose) return false
  if (on('city') && f.cities.length && !f.cities.includes(p.location.city)) return false
  if (on('locality') && f.localities.length) {
    // a locality narrows its own city; another city named without a locality matches all of it
    const citiesWithLocality = new Set(f.localities.map((l) => Object.entries(CITIES).find(([, ls]) => ls.includes(l))?.[0]))
    if (citiesWithLocality.has(p.location.city) && !f.localities.includes(p.location.locality)) return false
  }
  if (on('price') && ((f.minPrice && p.price < f.minPrice) || (f.maxPrice && p.price > f.maxPrice))) return false
  const area = primaryAreaSqft(p)
  if (on('area') && ((f.minArea && area < f.minArea) || (f.maxArea && area > f.maxArea))) return false
  if (on('configuration') && f.configurations.length && (!p.configuration || !f.configurations.includes(p.configuration))) return false
  if (on('facing') && f.facing.length && (!p.facing || !f.facing.includes(p.facing))) return false
  if (on('possession') && f.possession && p.possession.status !== f.possession) return false
  if (on('furnishing') && f.furnishing && p.furnishing !== f.furnishing) return false
  if (on('status') && f.statuses.length && !f.statuses.includes(p.status)) return false
  if (on('corner') && f.corner && !p.corner) return false
  if (on('vastu') && f.vastu && !p.vastuCompliant) return false
  for (const a of f.amenities) if (on(`amenity:${a}`) && !p.amenities.includes(a)) return false
  if (on('text') && f.text) {
    const hay = `${p.id} ${p.title} ${p.projectName ?? ''} ${p.builderName ?? ''} ${p.location.locality} ${p.location.city} ${p.description ?? ''}`.toLowerCase()
    if (!f.text.split(/\s+/).every((w) => hay.includes(w))) return false
  }
  return true
}

export function sortProperties(list: Property[], by: PropertySort = ''): Property[] {
  const newest = (a: Property, b: Property) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
  const out = [...list]
  switch (by) {
    case 'oldest': return out.sort((a, b) => newest(b, a))
    case 'priceAsc': return out.sort((a, b) => a.price - b.price || newest(a, b))
    case 'priceDesc': return out.sort((a, b) => b.price - a.price || newest(a, b))
    case 'areaAsc': return out.sort((a, b) => primaryAreaSqft(a) - primaryAreaSqft(b) || newest(a, b))
    case 'areaDesc': return out.sort((a, b) => primaryAreaSqft(b) - primaryAreaSqft(a) || newest(a, b))
    default: return out.sort(newest)
  }
}

export const applyPropertyFilters = (list: Property[], f: PropertyFilters): Property[] =>
  sortProperties(list.filter((p) => propertyMatchesFilters(p, f)), f.sort)

/** Every active criterion key (a pill each; ✕ drops it). */
export function criteriaKeys(f: PropertyFilters): string[] {
  const out: string[] = []
  if (f.types.length) out.push('type')
  if (f.purpose) out.push('purpose')
  if (f.cities.length) out.push('city')
  if (f.localities.length) out.push('locality')
  if (f.minPrice || f.maxPrice) out.push('price')
  if (f.minArea || f.maxArea) out.push('area')
  if (f.configurations.length) out.push('configuration')
  if (f.facing.length) out.push('facing')
  if (f.possession) out.push('possession')
  if (f.furnishing) out.push('furnishing')
  if (f.statuses.length) out.push('status')
  if (f.corner) out.push('corner')
  if (f.vastu) out.push('vastu')
  for (const a of f.amenities) out.push(`amenity:${a}`)
  if (f.text) out.push('text')
  return out
}

/** Nothing found: the smallest change (drop one criterion, else two) that brings the most records back. */
export function relaxFor(list: Property[], f: PropertyFilters): { drop: string[]; n: number } | null {
  const keys = criteriaKeys(f)
  if (!keys.length) return null
  const count = (drop: string[]) => list.filter((p) => propertyMatchesFilters(p, f, drop)).length
  const singles = keys.map((k) => [k])
  const pairs = keys.flatMap((k, i) => keys.slice(i + 1).map((j) => [k, j]))
  for (const sets of [singles, pairs]) {
    const best = sets.map((drop) => ({ drop, n: count(drop) })).filter((x) => x.n).sort((a, b) => b.n - a.n)[0]
    if (best) return best
  }
  return null
}

/** The type keys of a category (for "commercial" pills). */
export const typesOfCategory = (category: Property['category']): PropertyType[] =>
  (Object.keys(PROPERTY_TYPES) as PropertyType[]).filter((t) => categoryOf(t) === category)

export const KNOWN_AMENITIES: readonly string[] = AMENITIES

/* ---------- chip labels ---------- */

/** A parsed criterion as a short chip label ("3 BHK", "Whitefield", "Under ₹1.2 Cr"), through i18n; used by the Properties search and the matching assistant. */
type T = TFunction | ((key: string, opts?: Record<string, unknown>) => string)

export function criterionLabel(key: string, f: PropertyFilters, t: T): string {
  const tr = (k: string, o?: Record<string, unknown>) => String((t as (k: string, o?: Record<string, unknown>) => string)(k, o))
  if (key.startsWith('amenity:')) return tr(`catalogue:amenity.${key.slice(8)}`)
  switch (key) {
    case 'type': return f.types.map((x) => tr(`catalogue:propertyType.${x}`)).join(', ')
    case 'purpose': return f.purpose ? tr(`catalogue:purpose.${f.purpose}`) : ''
    case 'city': return f.cities.join(', ')
    case 'locality': return f.localities.join(', ')
    case 'price':
      if (f.minPrice && f.maxPrice) return tr('properties:criterion.priceBetween', { min: inrShort(f.minPrice), max: inrShort(f.maxPrice) })
      return f.maxPrice ? tr('properties:criterion.priceUnder', { max: inrShort(f.maxPrice) }) : tr('properties:criterion.priceOver', { min: inrShort(f.minPrice) })
    case 'area':
      if (f.minArea && f.maxArea) return tr('properties:criterion.areaBetween', { min: num(f.minArea), max: num(f.maxArea) })
      return f.maxArea ? tr('properties:criterion.areaUnder', { max: num(f.maxArea) }) : tr('properties:criterion.areaOver', { min: num(f.minArea) })
    case 'configuration': return f.configurations.map(configLabel).join(', ')
    case 'facing': return tr('properties:criterion.facing', { facing: f.facing.map((x) => tr(`catalogue:facing.${x}`)).join(', ') })
    case 'possession': return f.possession ? tr(`catalogue:possession.${f.possession}`) : ''
    case 'furnishing': return f.furnishing ? tr(`catalogue:furnishing.${f.furnishing}`) : ''
    case 'status': return f.statuses.map((x) => tr(`catalogue:propertyStatus.${x}`)).join(', ')
    case 'corner': return tr('properties:criterion.corner')
    case 'vastu': return tr('properties:criterion.vastu')
    case 'text': return tr('properties:criterion.text', { text: f.text })
    default: return key
  }
}
