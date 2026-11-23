/**
 * Plain-words property search: "east-facing plots in Madurai under 30 L" → filters the user can see and remove.
 * In the product the AI does this (one call, fixed-shape JSON back); the wireframe uses simple rules with the same output shape.
 */
import { CITIES } from '@/data/catalogue'
import type { Facing, Property, PropertyTypeKey, Purpose } from '@/data/types'

export type Filters = {
  types: PropertyTypeKey[]
  purpose?: Purpose
  cities: string[]
  localities: string[]
  minPrice?: number
  maxPrice?: number
  facing?: Facing
  bhk?: string
  commCategory?: string
  /** Words not understood as a filter: matched against title, code and locality. */
  text?: string
}

export const EMPTY_FILTERS: Filters = { types: [], cities: [], localities: [] }

export const hasFilters = (f: Filters) =>
  f.types.length > 0 || f.cities.length > 0 || f.localities.length > 0 || !!(f.purpose || f.minPrice || f.maxPrice || f.facing || f.bhk || f.commCategory || f.text)

const CITY_ALIASES: Record<string, string> = { trichy: 'Tiruchirappalli', kovai: 'Coimbatore', madras: 'Chennai' }
const FACING_WORDS: [RegExp, Facing][] = [
  [/north[- ]?east/, 'NE'], [/north[- ]?west/, 'NW'], [/south[- ]?east/, 'SE'], [/south[- ]?west/, 'SW'],
  [/\beast\b/, 'E'], [/\bwest\b/, 'W'], [/\bnorth\b/, 'N'], [/\bsouth\b/, 'S'],
]
const COMM_WORDS: [RegExp, string][] = [
  [/\b(warehouse|godown)s?\b/, 'Warehouse / Godown'], [/\b(shop|showroom|retail)s?\b/, 'Shop / Showroom'],
  [/\b(office)s?\b/, 'Office space'], [/\bcommercial building\b/, 'Commercial building'], [/\b(shed)s?\b/, 'Industrial shed'],
]
const UNIT = '(l|lakh|lakhs|lac|lacs|cr|crore|crores|k)?'
const STOP = new Set(['in', 'at', 'for', 'with', 'near', 'the', 'a', 'an', 'and', 'or', 'of', 'to', 'show', 'me', 'find', 'any', 'all', 'property', 'properties', 'facing', 'sale', 'buy'])

function money(n: string, unit?: string): number {
  const v = parseFloat(n)
  if (!unit) return v >= 1000 ? v : v * 1e5 // a bare "30" in a price phrase means lakhs
  if (unit.startsWith('c')) return v * 1e7
  if (unit === 'k') return v * 1e3
  return v * 1e5
}

export function parseQuery(input: string): Filters {
  let q = ` ${input.toLowerCase().replace(/₹/g, ' ').replace(/,/g, '')} `
  const f: Filters = { types: [], cities: [], localities: [] }
  const take = (re: RegExp) => { q = q.replace(re, ' ') }

  // price
  const between = q.match(new RegExp(`between\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\s*(?:and|to|-)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}`))
  if (between) {
    f.minPrice = money(between[1], between[2] || between[4]); f.maxPrice = money(between[3], between[4]); take(new RegExp(between[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  const max = q.match(new RegExp(`(?:under|below|less than|upto|up to|within|max|budget)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\b`))
  if (max) { f.maxPrice = money(max[1], max[2]); take(new RegExp(max[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) }
  const min = q.match(new RegExp(`(?:above|over|more than|min|from)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\b`))
  if (min) { f.minPrice = money(min[1], min[2]); take(new RegExp(min[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) }

  // BHK
  const bhk = q.match(/(\d)\s*\+?\s*bhk/)
  if (bhk) { f.bhk = `${bhk[1]} BHK`; take(/(\d)\s*\+?\s*bhk/) }

  // facing
  for (const [re, val] of FACING_WORDS) {
    if (re.test(q)) { f.facing = val; take(new RegExp(re.source + '([- ]?facing)?')); break }
  }

  // purpose
  if (/\b(rent|rental)\b/.test(q)) { f.purpose = 'rent'; take(/\bfor rent\b|\brent(al)?\b/) }
  else if (/\blease\b/.test(q)) { f.purpose = 'lease'; take(/\bfor lease\b|\blease\b/) }
  else if (/\b(sale|buy)\b/.test(q)) { f.purpose = 'sale'; take(/\bfor sale\b/) }

  // type
  const addType = (t: PropertyTypeKey) => { if (!f.types.includes(t)) f.types.push(t) }
  if (/\bagri(cultural)?\b|\bfarm( ?land)?\b/.test(q)) { addType('agri'); take(/\bagri(cultural)?( land)?\b|\bfarm( ?land)?\b/) }
  if (/\bindustrial\b/.test(q)) { addType('industrial'); take(/\bindustrial( land| plot)?\b/) }
  if (/\b(plot|plots|land|site|sites)\b/.test(q)) { addType('plot'); take(/\b(plot|plots|land|site|sites)\b/g) }
  if (/\b(flat|flats|apartment|apartments)\b/.test(q) || (f.bhk && !/\b(house|villa)/.test(q))) { addType('flat'); take(/\b(flat|flats|apartment|apartments)\b/g) }
  if (/\b(house|houses|villa|villas|independent)\b/.test(q)) { addType('house'); take(/\b(independent )?(house|houses|villa|villas)\b/g) }
  for (const [re, cat] of COMM_WORDS) {
    if (re.test(q)) { f.commCategory = cat; addType('commercial'); take(re); break }
  }
  if (/\bcommercial\b/.test(q)) { addType('commercial'); take(/\bcommercial\b/) }

  // place: localities first (more specific), then cities
  for (const [city, locs] of Object.entries(CITIES)) {
    for (const loc of locs) {
      const names = [loc, ...(loc.match(/\(([^)]+)\)/)?.slice(1) ?? []), loc.replace(/\s*\(.*\)/, '')]
      for (const n of names) {
        const re = new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
        if (re.test(q)) { if (!f.localities.includes(loc)) f.localities.push(loc); if (!f.cities.includes(city)) f.cities.push(city); take(re); break }
      }
    }
  }
  for (const city of Object.keys(CITIES)) {
    const re = new RegExp(`\\b${city.toLowerCase()}\\b`)
    if (re.test(q)) { if (!f.cities.includes(city)) f.cities.push(city); take(re) }
  }
  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    const re = new RegExp(`\\b${alias}\\b`)
    if (re.test(q)) { if (!f.cities.includes(city)) f.cities.push(city); take(re) }
  }

  const rest = q.split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))
  if (rest.length) f.text = rest.join(' ')
  return f
}

export function applyFilters(list: Property[], f: Filters): Property[] {
  const text = f.text?.toLowerCase().split(/\s+/).filter(Boolean) ?? []
  return list.filter((p) => {
    if (f.types.length && !f.types.includes(p.type)) return false
    if (f.purpose && p.purpose !== f.purpose) return false
    // a locality narrows its own city; a city with no locality chosen matches all of it
    if (f.cities.length && !f.cities.includes(p.location.city)) return false
    const citiesWithLocality = new Set(f.localities.map((l) => Object.entries(CITIES).find(([, ls]) => ls.includes(l))?.[0]))
    if (citiesWithLocality.has(p.location.city) && !f.localities.includes(p.location.locality)) return false
    if (f.minPrice && p.price < f.minPrice) return false
    if (f.maxPrice && p.price > f.maxPrice) return false
    if (f.facing && p.facing !== f.facing) return false
    if (f.bhk && p.type === 'flat' && p.specs.bhk !== f.bhk) return false
    if (f.bhk && p.type === 'house' && Number(p.specs.bedrooms) !== parseInt(f.bhk, 10)) return false
    if (f.commCategory && p.specs.commCategory !== f.commCategory) return false
    if (text.length) {
      const hay = `${p.id} ${p.title} ${p.location.locality} ${p.location.city} ${p.description ?? ''}`.toLowerCase()
      if (!text.every((w) => hay.includes(w))) return false
    }
    return true
  })
}
