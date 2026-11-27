/**
 * The Properties list logic (ported in behaviour from wireframe-rebuild/src/features/properties/pages/properties-page.tsx:
 * status tabs with counts, filter pills, NL search, grouping, export): pure functions over Property[].
 * The NL parser and the filter predicate live in lib/search.ts; this file combines the pills with the parsed sentence,
 * counts the status tabs, groups by locality and writes the CSV.
 */
import type { Configuration, Facing, Furnishing, Property, PropertyStatus, PropertyType } from '@/domain/types'
import { EMPTY_PROPERTY_FILTERS, propertyMatchesFilters, sortProperties, type PropertyFilters, type PropertySort } from '@/lib/search'
import { pricePerSqft, primaryAreaSqft } from '@/lib/property'

export type StatusTab = 'all' | PropertyStatus | 'draft' | 'archived'
export const STATUS_TABS: StatusTab[] = ['all', 'available', 'onHold', 'booked', 'sold', 'draft', 'archived']

export type BudgetBand = 'u50' | '50to100' | '100to200' | 'o200'
export const BUDGET_BANDS: Record<BudgetBand, { min?: number; max?: number }> = {
  u50: { max: 5_000_000 },
  '50to100': { min: 5_000_000, max: 10_000_000 },
  '100to200': { min: 10_000_000, max: 20_000_000 },
  o200: { min: 20_000_000 },
}

/** What the filter pills hold (each pill one key). */
export type Pills = {
  types: PropertyType[]
  cities: string[]
  localities: string[]
  budget?: BudgetBand
  configurations: Configuration[]
  possession?: 'ready' | 'underConstruction'
  furnishing?: Furnishing
  facing: Facing[]
}
export const EMPTY_PILLS: Pills = { types: [], cities: [], localities: [], configurations: [], facing: [] }

export const pillCount = (p: Pills) =>
  p.types.length + p.cities.length + p.localities.length + p.configurations.length + p.facing.length + Number(!!p.budget) + Number(!!p.possession) + Number(!!p.furnishing)

function union<T>(a: T[], b: T[]): T[] { return [...new Set([...a, ...b])] }

/** Pills and the parsed sentence together (lists union; a pill wins over the sentence for single values). */
export function combineFilters(pills: Pills, parsed: PropertyFilters, sort: PropertySort = ''): PropertyFilters {
  const band = pills.budget ? BUDGET_BANDS[pills.budget] : undefined
  return {
    ...parsed,
    types: union(pills.types, parsed.types),
    cities: union(pills.cities, parsed.cities),
    localities: union(pills.localities, parsed.localities),
    configurations: union(pills.configurations, parsed.configurations),
    facing: union(pills.facing, parsed.facing),
    minPrice: band ? band.min : parsed.minPrice,
    maxPrice: band ? band.max : parsed.maxPrice,
    possession: pills.possession ?? parsed.possession,
    furnishing: pills.furnishing ?? parsed.furnishing,
    sort: sort || parsed.sort,
  }
}

/** Drops one criterion ("type", "price", "amenity:gym") from parsed filters: the ✕ on a "How I read it" chip. */
export function withoutCriterion(f: PropertyFilters, key: string): PropertyFilters {
  const out: PropertyFilters = { ...f }
  if (key.startsWith('amenity:')) out.amenities = f.amenities.filter((a) => a !== key.slice(8))
  switch (key) {
    case 'type': out.types = []; break
    case 'purpose': out.purpose = undefined; break
    case 'city': out.cities = []; out.localities = []; break
    case 'locality': out.localities = []; break
    case 'price': out.minPrice = undefined; out.maxPrice = undefined; break
    case 'area': out.minArea = undefined; out.maxArea = undefined; break
    case 'configuration': out.configurations = []; break
    case 'facing': out.facing = []; break
    case 'possession': out.possession = undefined; break
    case 'furnishing': out.furnishing = undefined; break
    case 'status': out.statuses = []; break
    case 'corner': out.corner = undefined; break
    case 'vastu': out.vastu = undefined; break
    case 'text': out.text = undefined; break
  }
  return out
}

/** Is a property in this tab? "All" means every listing that is not archived. */
export function inTab(p: Pick<Property, 'status' | 'listing'>, tab: StatusTab): boolean {
  if (tab === 'archived') return p.listing === 'archived'
  if (tab === 'draft') return p.listing === 'draft'
  if (p.listing === 'archived') return false
  return tab === 'all' || p.status === tab
}

export function tabCounts(list: Property[]): Record<StatusTab, number> {
  return Object.fromEntries(STATUS_TABS.map((tab) => [tab, list.filter((p) => inTab(p, tab)).length])) as Record<StatusTab, number>
}

/** The visible list: filters (without status, which the tabs own), then the tab, then the sort. */
export function filterList(list: Property[], f: PropertyFilters, tab: StatusTab): { inFilters: Property[]; shown: Property[] } {
  const inFilters = list.filter((p) => propertyMatchesFilters(p, f))
  const shown = sortProperties(inFilters.filter((p) => inTab(p, tab)), f.sort)
  return { inFilters, shown }
}

export type LocalityGroup = {
  key: string
  locality: string
  city: string
  properties: Property[]
  minPrice: number
  maxPrice: number
  avgPricePerSqft: number | null
  byStatus: Record<PropertyStatus, number>
}

/** "By locality": groups with counts, the price range, the average ₹/sq ft and a status split; biggest group first. */
export function groupByLocality(list: Property[]): LocalityGroup[] {
  const map = new Map<string, Property[]>()
  for (const p of list) {
    const key = `${p.location.city}|${p.location.locality}`
    map.set(key, [...(map.get(key) ?? []), p])
  }
  const groups: LocalityGroup[] = []
  for (const [key, props] of map) {
    const prices = props.map((p) => p.price).filter((n) => n > 0)
    const ppsf = props.map(pricePerSqft).filter((n): n is number => n !== null)
    const byStatus: Record<PropertyStatus, number> = { available: 0, onHold: 0, booked: 0, sold: 0 }
    for (const p of props) byStatus[p.status]++
    groups.push({
      key, city: props[0].location.city, locality: props[0].location.locality || props[0].location.city, properties: props,
      minPrice: prices.length ? Math.min(...prices) : 0, maxPrice: prices.length ? Math.max(...prices) : 0,
      avgPricePerSqft: ppsf.length ? Math.round(ppsf.reduce((a, b) => a + b, 0) / ppsf.length) : null,
      byStatus,
    })
  }
  return groups.sort((a, b) => b.properties.length - a.properties.length || a.locality.localeCompare(b.locality))
}

/** Listings added per week, oldest first (the sparkline under "Live listings"). */
export function weeklyAdds(list: Pick<Property, 'createdAt'>[], now: Date, weeks = 8): number[] {
  const out = Array.from({ length: weeks }, () => 0)
  const end = now.getTime()
  for (const p of list) {
    const age = Math.floor((end - new Date(p.createdAt).getTime()) / (7 * 86_400_000))
    if (age >= 0 && age < weeks) out[weeks - 1 - age]++
  }
  return out
}

/* ---------- CSV ---------- */

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export type CsvColumn = { header: string; value: (p: Property) => string | number | undefined }

/** The column set of an export; headers come from the caller (translated). */
export function propertyCsvColumns(h: (key: string) => string, label: { type: (p: Property) => string; status: (p: Property) => string }): CsvColumn[] {
  return [
    { header: h('id'), value: (p) => p.id },
    { header: h('title'), value: (p) => p.title },
    { header: h('type'), value: label.type },
    { header: h('configuration'), value: (p) => p.configuration },
    { header: h('city'), value: (p) => p.location.city },
    { header: h('locality'), value: (p) => p.location.locality },
    { header: h('price'), value: (p) => p.price || undefined },
    { header: h('area'), value: (p) => primaryAreaSqft(p) || undefined },
    { header: h('pricePerSqft'), value: (p) => pricePerSqft(p) ?? undefined },
    { header: h('status'), value: label.status },
    { header: h('project'), value: (p) => p.projectName },
    { header: h('rera'), value: (p) => p.rera?.number },
  ]
}

export function toCsv(list: Property[], columns: CsvColumn[]): string {
  const rows = [columns.map((c) => cell(c.header)).join(','), ...list.map((p) => columns.map((c) => cell(c.value(p))).join(','))]
  return rows.join('\r\n')
}

export { EMPTY_PROPERTY_FILTERS }
