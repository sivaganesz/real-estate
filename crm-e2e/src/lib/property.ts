/**
 * Property rules (ported from wireframe-rebuild/src/lib/property.ts, adapted to the crm-e2e model):
 * smart-required fields, the listing's completion score, what needs attention, the price check against similar
 * properties, primary area / price per sq ft, and which listings matching may offer. `DEMO_TODAY` became a `now` argument.
 */
import type { DB, ID, Lead, Property } from '@/domain/types'
import { PROPERTY_TYPES, SQFT_PER_UNIT } from '@/domain/catalogue'

/* ---------- area and price ---------- */

/** The plot area in square feet, whatever unit it was entered in. */
export function plotSqft(p: Pick<Property, 'area'>): number | undefined {
  const { plot, plotUnit, plotLengthFt, plotWidthFt } = p.area
  if (plot) return Math.round(plot * SQFT_PER_UNIT[plotUnit ?? 'sqft'])
  if (plotLengthFt && plotWidthFt) return plotLengthFt * plotWidthFt
  return undefined
}

/** The figure people quote for this type: the first area field the type asks for that is filled (plots in sq ft). */
export function primaryAreaSqft(p: Pick<Property, 'type' | 'area'>): number {
  for (const f of PROPERTY_TYPES[p.type].areaFields) {
    if (f === 'plot' || f === 'plotLengthFt' || f === 'plotWidthFt') {
      const v = plotSqft(p)
      if (v) return v
    } else if (p.area[f]) return Number(p.area[f])
  }
  return p.area.carpet ?? p.area.builtUp ?? p.area.superBuiltUp ?? plotSqft(p) ?? 0
}

/** The living area matching compares with a buyer's size: carpet, then built-up, then super built-up, then the plot. */
export const usableAreaSqft = (p: Pick<Property, 'type' | 'area'>): number =>
  p.area.carpet ?? p.area.builtUp ?? p.area.superBuiltUp ?? plotSqft(p) ?? 0

export function pricePerSqft(p: Pick<Property, 'type' | 'area' | 'price'>): number | null {
  const a = primaryAreaSqft(p)
  return a > 0 && p.price > 0 ? Math.round(p.price / a) : null
}

/* ---------- status ---------- */

/** On offer to buyers: live and available or on hold (booked and sold never appear in matching). */
export const isMatchable = (p: Pick<Property, 'listing' | 'status'>) => p.listing === 'live' && (p.status === 'available' || p.status === 'onHold')
export const isOnOffer = (p: Pick<Property, 'listing' | 'status'>) => p.listing === 'live' && p.status === 'available'
export const isListed = (p: Pick<Property, 'listing'>) => p.listing === 'live'
export const pendingApprovals = (p: Pick<Property, 'approvals'>): string[] => p.approvals.filter((a) => a.docStatus === 'pending').map((a) => a.authority)
export const photoCount = (p: Pick<Property, 'media'>) => p.media.filter((m) => m.kind === 'photo').length
export const coverPhoto = (p: Pick<Property, 'media'>) => p.media.find((m) => m.isCover) ?? p.media.find((m) => m.kind === 'photo')

/* ---------- smart required ---------- */

const empty = (v: unknown) => v === '' || v == null || v === 0 || (Array.isArray(v) && v.length === 0)

/** A field value on the property itself or in its family specs. */
const fieldValue = (p: Property, key: string): unknown => (key in p ? (p as unknown as Record<string, unknown>)[key] : p.specs[key])

/**
 * Keys still empty among the smart-required set: title or configuration, type, city, locality, price, area,
 * plus the type's own required fields (configuration and floor for flats, road width for plots…).
 */
export function missingRequired(p: Property): string[] {
  const missing: string[] = []
  if (empty(p.title) && empty(p.configuration)) missing.push('title')
  if (empty(p.type)) missing.push('type')
  if (empty(p.location.city)) missing.push('city')
  if (empty(p.location.locality)) missing.push('locality')
  if (empty(p.price)) missing.push('price')
  if (!primaryAreaSqft(p)) missing.push('area')
  for (const key of PROPERTY_TYPES[p.type].required) if (empty(fieldValue(p, key)) && !missing.includes(key)) missing.push(key)
  return missing
}

/* ---------- completion score ---------- */

export const PHOTO_TARGET = 5
export type ScoreKey = 'purpose' | 'type' | 'city' | 'locality' | 'price' | 'area' | 'keyDetails' | 'photos' | 'legal' | 'amenities'
export type ScoreItem = { key: ScoreKey; points: number; max: number; missing?: string[] }

/**
 * Purpose, type, city, locality, price, area 10 each · key details 15 (the type's required fields and specs) ·
 * any photo 10 · legal 10 (share of approvals with a document, or RERA) · amenities 5.
 */
export function listingScore(p: Property): { score: number; items: ScoreItem[]; missing: ScoreItem[] } {
  const def = PROPERTY_TYPES[p.type]
  const keys = [...def.required, ...def.specs.filter((s) => !s.internal).map((s) => s.key)]
  const keyEmpty = keys.filter((k) => empty(fieldValue(p, k)))
  const legal = p.approvals.length ? p.approvals.filter((a) => a.docStatus !== 'pending').length / p.approvals.length : p.rera ? 1 : 0
  const part = (key: ScoreKey, max: number, v: number | boolean, missing?: string[]): ScoreItem =>
    ({ key, max, points: Math.round(max * (v === true ? 1 : v === false ? 0 : v)), missing })
  const items: ScoreItem[] = [
    part('purpose', 10, !!p.purpose), part('type', 10, !!p.type), part('city', 10, !!p.location.city), part('locality', 10, !!p.location.locality),
    part('price', 10, p.price > 0), part('area', 10, primaryAreaSqft(p) > 0),
    part('keyDetails', 15, keys.length ? (keys.length - keyEmpty.length) / keys.length : 1, keyEmpty),
    part('photos', 10, photoCount(p) > 0), part('legal', 10, legal, pendingApprovals(p)), part('amenities', 5, p.amenities.length > 0),
  ]
  const score = items.reduce((t, i) => t + i.points, 0)
  return { score, items, missing: items.filter((i) => i.points < i.max) }
}

/* ---------- price check ---------- */

export const COMP_DAYS = 365
export const COMP_AREA = 0.25

export type Comparable = { id: ID; title: string; locality: string; areaSqft: number; pricePerSqft: number; kind: 'asking' | 'transaction'; sameLocality: boolean }
export type PriceCheck = {
  pricePerSqft: number | null
  comparables: Comparable[]
  count: number
  avg?: number
  min?: number
  max?: number
  soldAvg?: number
  /** Neutral wording only: never "bargain" or "best price". */
  position?: 'within' | 'below' | 'above'
  costs: { stampDuty: number; registration: number; other: number; pct: number; total: number }
  allIn: number
}

/** Similar properties in our records: same type and city, area within ±25%, listed in the last 12 months. */
export function comparablesFor(p: Property, properties: Property[], now: Date): Comparable[] {
  const area = primaryAreaSqft(p)
  if (!area) return []
  return properties
    .filter((o) => {
      if (o.id === p.id || o.listing === 'draft' || o.type !== p.type || o.location.city !== p.location.city || o.price <= 0) return false
      const oa = primaryAreaSqft(o)
      if (!oa || Math.abs(oa - area) / area > COMP_AREA) return false
      const listed = o.listedAt ?? o.createdAt
      return (now.getTime() - new Date(listed).getTime()) / 86_400_000 <= COMP_DAYS
    })
    .map((o) => ({
      id: o.id, title: o.title, locality: o.location.locality, areaSqft: primaryAreaSqft(o), pricePerSqft: Math.round(o.price / primaryAreaSqft(o)),
      kind: o.status === 'sold' || o.status === 'booked' ? 'transaction' as const : 'asking' as const, sameLocality: o.location.locality === p.location.locality,
    }))
    .sort((a, b) => Number(b.sameLocality) - Number(a.sameLocality) || Math.abs(a.areaSqft - area) - Math.abs(b.areaSqft - area))
}

export function priceCheck(p: Property, db: Pick<DB, 'properties' | 'settings'>, now: Date): PriceCheck {
  const ppsf = pricePerSqft(p)
  const comparables = comparablesFor(p, db.properties, now)
  const vals = comparables.map((c) => c.pricePerSqft)
  const sold = comparables.filter((c) => c.kind === 'transaction').map((c) => c.pricePerSqft)
  const c = db.settings.costs
  const part = (pct: number) => Math.round((p.price * pct) / 100)
  const costs = { stampDuty: part(c.stampDutyPct), registration: part(c.registrationPct), other: part(c.otherPct), pct: c.stampDutyPct + c.registrationPct + c.otherPct, total: 0 }
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

/* ---------- needs attention ---------- */

export type AttentionKey = 'details' | 'price' | 'stale' | 'docs'
export type Attention = { key: AttentionKey; values?: Record<string, string | number> }
export const ATTENTION_KEYS: AttentionKey[] = ['details', 'price', 'stale', 'docs']
export const STALE_DAYS = 45

/** What the system flags on a listing: missing details, a price out of range, no visits in 45 days, a document pending. */
export function attentionFor(p: Property, db: Pick<DB, 'properties' | 'settings' | 'appointments'>, now: Date): Attention[] {
  if (p.listing !== 'live' || p.status === 'sold') return []
  const out: Attention[] = []
  const sc = listingScore(p)
  if (sc.score < 80) out.push({ key: 'details', values: { score: sc.score } })
  const pc = priceCheck(p, db, now)
  if (pc.position && pc.position !== 'within' && pc.avg && pc.pricePerSqft) {
    out.push({ key: 'price', values: { pct: Math.abs(Math.round(((pc.pricePerSqft - pc.avg) / pc.avg) * 100)), dir: pc.position } })
  }
  const days = Math.floor((now.getTime() - new Date(p.listedAt ?? p.createdAt).getTime()) / 86_400_000)
  const visited = db.appointments.some((a) => a.propertyIds.includes(p.id) && a.type === 'siteVisit')
  if (p.status === 'available' && days >= STALE_DAYS && !visited) out.push({ key: 'stale', values: { days } })
  const pending = pendingApprovals(p).length
  if (pending) out.push({ key: 'docs', values: { count: pending } })
  return out
}

/* ---------- leads linked to a property ---------- */

export type LeadLink = { lead: Lead; shortlisted: boolean; visits: number; deal: boolean; upcomingVisitIds: ID[] }

/** The leads whose records point at this property: shortlist, site visits, the deal. */
export function linkedLeads(propertyId: ID, db: Pick<DB, 'leads' | 'appointments'>, now: Date): LeadLink[] {
  const nowIso = now.toISOString()
  const out: LeadLink[] = []
  for (const lead of db.leads) {
    const visits = db.appointments.filter((a) => a.leadId === lead.id && a.propertyIds.includes(propertyId))
    const link: LeadLink = {
      lead,
      shortlisted: lead.shortlist.some((s) => s.propertyId === propertyId && s.status !== 'notInterested'),
      visits: visits.length,
      deal: lead.deal?.propertyId === propertyId,
      upcomingVisitIds: visits.filter((v) => (v.status === 'scheduled' || v.status === 'confirmed' || v.status === 'rescheduled') && v.start >= nowIso).map((v) => v.id),
    }
    if (link.shortlisted || link.visits || link.deal) out.push(link)
  }
  return out
}
