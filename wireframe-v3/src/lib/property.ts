/**
 * Property rules: what's required to publish, how complete a listing is, the to-do list,
 * the legal summary, the price check and what the customer may see of nearby places.
 */
import { PROPERTY_TYPES, REQUIRED_CORE } from '@/data/catalogue'
import type { NearbyPlace, Property, Settings } from '@/data/types'

/* ---------- required to publish ---------- */

/** Keys of required facts that are still empty: the core ones plus the type's two key details. */
export function missingRequired(p: Property): string[] {
  const core: Record<(typeof REQUIRED_CORE)[number], unknown> = {
    title: p.title, purpose: p.purpose, type: p.type, city: p.location.city, locality: p.location.locality, price: p.price, area: p.areaSqft,
  }
  const missing: string[] = Object.entries(core).filter(([, v]) => v === '' || v == null || v === 0).map(([k]) => k)
  for (const key of PROPERTY_TYPES[p.type].required) {
    const v = p.specs[key]
    if (v === '' || v == null) missing.push(key)
  }
  return missing
}

export const requiredCount = () => REQUIRED_CORE.length + 2

/* ---------- legal ---------- */

export function pendingApprovals(p: Property): string[] {
  return p.approvals.filter((a) => a.status === 'pending').map((a) => a.approvalId)
}

/* ---------- completeness and to-do ---------- */

export const PHOTO_TARGET = 5
export const NEARBY_TARGET = 3

export type TodoKey = 'required' | 'photos' | 'exactLocation' | 'approvalDocs' | 'description' | 'nearby' | 'amenities'
export type TodoItem = { key: TodoKey; done: boolean; detail?: string[]; count?: number }

/** Everything that makes a listing complete. Only `required` blocks publishing. */
export function listingChecklist(p: Property): TodoItem[] {
  const photos = p.media.filter((m) => m.kind === 'photo').length
  const missing = missingRequired(p)
  const pending = pendingApprovals(p)
  return [
    { key: 'required', done: missing.length === 0, detail: missing },
    { key: 'photos', done: photos >= PHOTO_TARGET, count: PHOTO_TARGET - photos },
    { key: 'exactLocation', done: p.location.exact },
    { key: 'approvalDocs', done: pending.length === 0, detail: pending },
    { key: 'description', done: !!p.description?.trim() },
    { key: 'nearby', done: p.location.nearby.length >= NEARBY_TARGET },
    { key: 'amenities', done: p.amenities.length > 0 },
  ]
}

export function completion(p: Property): { pct: number; todo: TodoItem[] } {
  const list = listingChecklist(p)
  // the required facts weigh as much as everything else together
  const weight = (i: TodoItem) => (i.key === 'required' ? list.length - 1 : 1)
  const total = list.reduce((a, i) => a + weight(i), 0)
  const done = list.filter((i) => i.done).reduce((a, i) => a + weight(i), 0)
  return { pct: Math.round((done / total) * 100), todo: list.filter((i) => !i.done) }
}

/* ---------- price check ---------- */

export type PriceCheck = {
  pricePerSqft: number | null
  count: number
  avg?: number
  min?: number
  max?: number
  /** Neutral wording only — never "bargain" or "best price". */
  position?: 'within' | 'below' | 'above'
  buyerCostsPct: number
  buyerCosts: number
  allIn: number
}

export function priceCheck(p: Property, settings: Settings): PriceCheck {
  const ppsf = p.areaSqft > 0 ? Math.round(p.price / p.areaSqft) : null
  const vals = p.comparables.map((c) => c.pricePerSqft).filter((v) => v > 0)
  const c = settings.buyerCostsPct
  const pct = c.stampDuty + c.registration + c.other
  const out: PriceCheck = { pricePerSqft: ppsf, count: vals.length, buyerCostsPct: pct, buyerCosts: Math.round((p.price * pct) / 100), allIn: 0 }
  out.allIn = p.price + out.buyerCosts
  if (vals.length && ppsf) {
    out.avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    out.min = Math.min(...vals)
    out.max = Math.max(...vals)
    out.position = ppsf < out.min ? 'below' : ppsf > out.max ? 'above' : 'within'
  }
  return out
}

/* ---------- nearby places: team view vs customer view ---------- */

export type PlaceView = 'team' | 'customer'

/** "~" when the distance is Google's estimate: no exact location, or the route has not been checked. */
export const isApproxDistance = (p: Property, place: NearbyPlace) => !p.location.exact || !place.routeChecked

/**
 * Customer view = exactly what the listing, brochure and WhatsApp message may say:
 * - everyday places close by (route-check categories) only once a person has checked the route;
 * - planned / proposed infrastructure only when labelled as such (never as existing).
 */
export function placesFor(p: Property, settings: Settings, view: PlaceView): NearbyPlace[] {
  const sorted = [...p.location.nearby].sort((a, b) => a.distanceKm - b.distanceKm)
  if (view === 'team') return sorted
  return sorted.filter((pl) => {
    const cat = settings.placeCategories.find((c) => c.id === pl.categoryId)
    if (cat?.routeCheck && pl.status === 'existing' && !pl.routeChecked) return false
    return true
  })
}
