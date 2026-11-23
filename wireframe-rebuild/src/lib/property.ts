/**
 * Property rules (from spec-system-wireframe): what's required to publish, the listing's completion score,
 * what needs attention, the price check against similar properties, and what customers may see of nearby places.
 */
import { PROPERTY_TYPES, REQUIRED_CORE } from '@/data/catalogue'
import { DEMO_TODAY } from '@/data/seed'
import type { Comparable, Database, NearbyPlace, Property, Settings } from '@/data/types'
import { daysBetween } from './format'

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

export const isListed = (p: Property) => p.status !== 'draft' && !p.archived
export const isOnOffer = (p: Property) => p.status === 'available' && !p.archived
export const pendingApprovals = (p: Property): string[] => p.approvals.filter((a) => a.status === 'pending').map((a) => a.approvalId)
export const photoCount = (p: Property) => p.media.filter((m) => m.kind === 'photo').length

/* ---------- completion score (spec-system-wireframe listedScore, same weights) ---------- */

export const PHOTO_TARGET = 5
export type ScoreKey = 'purpose' | 'type' | 'city' | 'locality' | 'price' | 'area' | 'keyDetails' | 'photos' | 'legal' | 'amenities'
export type ScoreItem = { key: ScoreKey; points: number; max: number; missing?: string[] }

/**
 * Purpose, type, city, locality, price, area 10 each · key details 15 (the type's core fields) · any photo 10 ·
 * legal documents 10 (share of approval badges with their document; or any document when there are no badges) · amenities 5.
 */
export function listingScore(p: Property): { score: number; items: ScoreItem[]; missing: ScoreItem[] } {
  const def = PROPERTY_TYPES[p.type]
  const core = def.core.filter((k) => def.facts.some((f) => f.key === k))
  const coreEmpty = core.filter((k) => p.specs[k] === undefined || p.specs[k] === '')
  const docs = p.approvals.length ? p.approvals.filter((a) => a.status !== 'pending').length / p.approvals.length : p.documents.length ? 1 : 0
  const part = (key: ScoreKey, max: number, v: number | boolean, missing?: string[]): ScoreItem =>
    ({ key, max, points: Math.round(max * (v === true ? 1 : v === false ? 0 : v)), missing })
  const items: ScoreItem[] = [
    part('purpose', 10, !!p.purpose), part('type', 10, !!p.type), part('city', 10, !!p.location.city), part('locality', 10, !!p.location.locality),
    part('price', 10, p.price > 0), part('area', 10, p.areaSqft > 0),
    part('keyDetails', 15, core.length ? (core.length - coreEmpty.length) / core.length : 0, coreEmpty),
    part('photos', 10, photoCount(p) > 0), part('legal', 10, docs, pendingApprovals(p)), part('amenities', 5, p.amenities.length > 0),
  ]
  const score = items.reduce((t, i) => t + i.points, 0)
  return { score, items, missing: items.filter((i) => i.points < i.max) }
}

/* ---------- needs attention ---------- */

export type AttentionKey = 'details' | 'price' | 'stale' | 'docs'
export type Attention = { key: AttentionKey; values?: Record<string, string | number> }
export const ATTENTION_KEYS: AttentionKey[] = ['details', 'price', 'stale', 'docs']
export const STALE_DAYS = 45

/** What the system flags on a listing: missing details, a price out of range, no visits in 45 days, a document pending. */
export function attentionFor(p: Property, db: Database, today: string): Attention[] {
  if (p.archived || p.status === 'sold' || p.status === 'draft') return []
  const out: Attention[] = []
  const sc = listingScore(p)
  if (sc.score < 80) out.push({ key: 'details', values: { score: sc.score } })
  const pc = priceCheck(p, db)
  if (pc.position && pc.position !== 'within' && pc.avg && pc.pricePerSqft) {
    out.push({ key: 'price', values: { pct: Math.abs(Math.round(((pc.pricePerSqft - pc.avg) / pc.avg) * 100)), dir: pc.position } })
  }
  const days = p.listedAt ? daysBetween(p.listedAt, today) : 0
  const visited = db.leads.some((l) => l.visits.some((v) => v.propertyId === p.id))
  if (p.status === 'available' && days >= STALE_DAYS && !visited) out.push({ key: 'stale', values: { days } })
  if (pendingApprovals(p).length) out.push({ key: 'docs', values: { count: pendingApprovals(p).length } })
  return out
}

/* ---------- price check ---------- */

export const COMP_DAYS = 365
export const COMP_AREA = 0.25

export type FoundComparable = Comparable & { ref: string }

/** Similar properties in our own records: same type and city, area within ±25%, listed or sold in the last 12 months. Live. */
export function comparablesFromRecords(p: Property, db: Database): FoundComparable[] {
  const no = new Set(p.dismissedComparables ?? [])
  return db.properties
    .filter((o) => o.id !== p.id && !o.archived && o.status !== 'draft' && o.type === p.type && o.location.city === p.location.city && o.areaSqft > 0 && o.price > 0 && p.areaSqft > 0
      && Math.abs(o.areaSqft - p.areaSqft) / p.areaSqft <= COMP_AREA && (!o.listedAt || daysBetween(o.listedAt, DEMO_TODAY) <= COMP_DAYS) && !no.has(o.id))
    .sort((a, b) => Number(b.location.locality === p.location.locality) - Number(a.location.locality === p.location.locality) || Math.abs(a.areaSqft - p.areaSqft) - Math.abs(b.areaSqft - p.areaSqft))
    .map((o) => {
      const sold = o.status === 'sold' || o.status === 'booked'
      return {
        id: `auto-${o.id}`, ref: o.id, locality: `${o.location.locality}, ${o.location.city}`, type: PROPERTY_TYPES[o.type].label, areaSqft: o.areaSqft,
        pricePerSqft: Math.round(o.price / o.areaSqft), kind: sold ? 'transaction' : 'asking', date: o.listedAt ?? o.created.at,
        source: o.id, differences: differencesBetween(p, o),
      }
    })
}

/** What differs, in a few words — the AI's note, which the team can change. */
function differencesBetween(p: Property, o: Property): string {
  const d: string[] = []
  const pct = Math.round(((o.areaSqft - p.areaSqft) / p.areaSqft) * 100)
  if (o.location.locality !== p.location.locality) d.push(`in ${o.location.locality}`)
  if (pct) d.push(`${Math.abs(pct)}% ${pct > 0 ? 'larger' : 'smaller'}`)
  const a = p.specs, b = o.specs
  if (a.corner && b.corner && a.corner !== b.corner) d.push(String(b.corner).toLowerCase())
  if (a.roadWidth && b.roadWidth && a.roadWidth !== b.roadWidth) d.push(`${b.roadWidth} ft road`)
  if (a.bhk && b.bhk && a.bhk !== b.bhk) d.push(String(b.bhk))
  return d.slice(0, 3).join(', ') || 'very similar'
}

export type PriceCheck = {
  pricePerSqft: number | null
  comparables: (Comparable & { ref?: string })[]
  count: number
  avg?: number
  min?: number
  max?: number
  soldAvg?: number
  /** Neutral wording only — never "bargain" or "best price". */
  position?: 'within' | 'below' | 'above'
  costs: { stampDuty: number; registration: number; other: number; pct: number; total: number }
  allIn: number
}

export function priceCheck(p: Property, db: Database): PriceCheck {
  const settings: Settings = db.settings
  const ppsf = p.areaSqft > 0 ? Math.round(p.price / p.areaSqft) : null
  const comparables = [...comparablesFromRecords(p, db), ...p.comparables]
  const vals = comparables.map((c) => c.pricePerSqft).filter((v) => v > 0)
  const sold = comparables.filter((c) => c.kind === 'transaction' && c.pricePerSqft > 0).map((c) => c.pricePerSqft)
  const c = settings.buyerCostsPct
  const part = (pct: number) => Math.round((p.price * pct) / 100)
  const costs = { stampDuty: part(c.stampDuty), registration: part(c.registration), other: part(c.other), pct: c.stampDuty + c.registration + c.other, total: 0 }
  costs.total = costs.stampDuty + costs.registration + costs.other
  const out: PriceCheck = { pricePerSqft: ppsf, comparables, count: vals.length, costs, allIn: p.price + costs.total }
  if (vals.length && ppsf) {
    out.avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    out.min = Math.min(...vals)
    out.max = Math.max(...vals)
    out.position = ppsf < out.min ? 'below' : ppsf > out.max ? 'above' : 'within'
  }
  if (sold.length) out.soldAvg = Math.round(sold.reduce((a, b) => a + b, 0) / sold.length)
  return out
}

/* ---------- nearby places: team view vs customer view ---------- */

export type PlaceView = 'team' | 'customer'

/** "~" when the distance is Google's estimate: no exact location, or the route has not been checked. */
export const isApproxDistance = (p: Property, place: NearbyPlace) => !p.location.exact || !place.routeChecked

/**
 * Customer view = exactly what the listing, brochure and WhatsApp message may say:
 * - everyday places close by (route-check categories) only once a person has checked the route;
 * - planned / proposed infrastructure only labelled as such (never as existing).
 */
export function placesFor(p: Property, settings: Settings, view: PlaceView): NearbyPlace[] {
  const sorted = [...p.location.nearby].sort((a, b) => a.distanceKm - b.distanceKm)
  if (view === 'team') return sorted
  return sorted.filter((pl) => {
    const cat = settings.placeCategories.find((c) => c.id === pl.categoryId)
    return !(cat?.routeCheck && pl.status === 'existing' && !pl.routeChecked)
  })
}
