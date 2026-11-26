/**
 * Two-way matching: properties for a lead, and leads for a property.
 * Reused from the old wireframe (logic.js → matchScore), typed.
 * Step 1: hard filters (any failure → excluded). Step 2: weighted score M = Σ w·component (each 0–100).
 * An approval claimed without its document makes it a "conditional" match, never a top recommendation.
 */
import type { Lead, Property, Settings } from '@/data/types'
import { isOnOffer, pendingApprovals } from './property'

export type MatchPart = 'budget' | 'location' | 'size' | 'amenities' | 'preferences'
/** The order the score's parts are shown in, with the formula M = 0.30B + 0.25L + 0.20S + 0.15A + 0.10P. */
export const MATCH_PARTS: MatchPart[] = ['budget', 'location', 'size', 'amenities', 'preferences']

export type MatchLabel = 'strong' | 'good' | 'weak' | 'conditional' | 'budgetMismatch' | 'excluded'

export type Reason = { ok: boolean | null; key: string; values?: Record<string, string | number> }

export type Match = {
  property: Property
  lead: Lead
  score: number
  label: MatchLabel
  excluded: boolean
  reasons: Reason[]
  /** The five parts of the score, each 0–100, before the weights (Settings → match weights). */
  parts: Record<MatchPart, number>
  /** The most the lead will pay: maximum budget plus their flexibility. */
  ceiling: number
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

function infraScore(p: Property): number {
  const s = p.specs
  const has = (k: string) => p.amenities.includes(k)
  let checks: boolean[]
  if (p.type === 'plot') {
    checks = [!!s.water && s.water !== 'Not available', s.electricity === 'Available at site', !!s.drainage && s.drainage !== 'Not available', ['Tar road', 'Concrete road'].includes(String(s.roadInfra))]
  } else if (p.type === 'house') {
    checks = [!!s.water && s.water !== 'Tanker dependent', !!s.power, ['New', 'Good'].includes(String(s.condition))]
  } else if (p.type === 'flat') {
    checks = [Number(s.lifts) > 0 || Number(s.floor) <= 1, !!s.parking && s.parking !== 'None', has('Power backup'), has('Security')]
  } else {
    checks = [Number(s.roadWidth) >= 30, !!s.parking && s.parking !== 'None', !!s.permittedUsage]
  }
  return (checks.filter(Boolean).length / checks.length) * 100
}

function preferenceChecks(l: Lead, p: Property): Reason[] {
  const r = l.requirement, s = p.specs, out: Reason[] = []
  if (p.type === 'plot') {
    if (r.facing) out.push({ ok: p.facing === r.facing, key: 'facing', values: { want: r.facing } })
    if (r.minRoadFt) out.push({ ok: Number(s.roadWidth) >= r.minRoadFt, key: 'road', values: { want: r.minRoadFt } })
    if (r.corner && r.corner !== 'any') out.push({ ok: (s.corner === 'Corner') === (r.corner === 'corner'), key: r.corner })
  } else if (p.type === 'flat') {
    if (r.bhk) out.push({ ok: s.bhk === r.bhk, key: 'bhk', values: { want: r.bhk } })
    if (r.parking === 'required') out.push({ ok: !!s.parking && s.parking !== 'None', key: 'parking' })
    if (r.possession && r.possession !== 'any') out.push({ ok: (s.possession === 'Ready to move') === (r.possession === 'ready'), key: r.possession })
  } else if (p.type === 'house') {
    if (r.bhk) out.push({ ok: Number(s.bedrooms) >= parseInt(r.bhk, 10), key: 'bhk', values: { want: r.bhk } })
    if (r.parking === 'required') out.push({ ok: !!s.parking && s.parking !== 'None', key: 'parking' })
  } else if (p.type === 'commercial') {
    if (r.commCategory) out.push({ ok: s.commCategory === r.commCategory, key: 'category', values: { want: r.commCategory } })
    if (r.occupancy && r.occupancy !== 'any') out.push({ ok: String(s.occupancy).toLowerCase() === r.occupancy, key: r.occupancy })
  }
  return out
}

export function matchScore(lead: Lead, p: Property, settings: Settings): Match {
  const w = settings.matchWeights, b = lead.budget, r = lead.requirement
  const ceiling = b.max * (1 + b.flexPct / 100)
  const hard = [
    { key: 'available', ok: p.status === 'available' },
    { key: 'type', ok: p.type === r.type },
    { key: 'city', ok: r.cities.includes(p.location.city) },
    { key: 'budget', ok: p.price <= ceiling },
  ]
  const failed = hard.filter((h) => !h.ok)
  const legalOk = pendingApprovals(p).length === 0

  const B = p.price <= b.preferred ? 100 : p.price <= b.max ? 100 - (30 * (p.price - b.preferred)) / Math.max(1, b.max - b.preferred) : p.price <= ceiling ? 55 : 0
  const L = !r.cities.includes(p.location.city) ? 0 : r.localities.length ? (r.localities.includes(p.location.locality) ? 100 : 70) : 100
  const sizeDev = r.sizeSqft ? Math.abs(p.areaSqft - r.sizeSqft) / r.sizeSqft : 0
  const S = r.sizeSqft ? clamp(Math.round(100 - sizeDev * 200)) : 100
  const infra = infraScore(p)
  const A = r.amenities.length ? 0.5 * infra + 0.5 * (r.amenities.filter((a) => p.amenities.includes(a)).length / r.amenities.length) * 100 : infra
  const prefs = preferenceChecks(lead, p)
  const P = prefs.length ? (prefs.filter((x) => x.ok).length / prefs.length) * 100 : 100
  const score = Math.round(w.budget * B + w.location * L + w.size * S + w.amenities * A + w.preferences * P)

  let label: MatchLabel
  if (failed.length) label = failed.length === 1 && failed[0].key === 'budget' ? 'budgetMismatch' : 'excluded'
  else if (!legalOk || S < 60) label = 'conditional'
  else if (score >= 80) label = 'strong'
  else if (score >= 65) label = 'good'
  else label = 'weak'

  const reasons: Reason[] = []
  if (!failed.length) {
    reasons.push({ ok: true, key: p.price <= b.preferred ? 'withinPreferred' : p.price <= b.max ? 'withinMax' : 'usesFlex' })
    if (r.sizeSqft) reasons.push({ ok: S >= 60, key: sizeDev === 0 ? 'sizeExact' : 'sizeOff', values: { pct: Math.round(sizeDev * 100) } })
    if (r.localities.length) reasons.push({ ok: r.localities.includes(p.location.locality), key: r.localities.includes(p.location.locality) ? 'preferredLocality' : 'otherLocality' })
    reasons.push(...prefs)
    // warnings (ok: null) — shown as amber chips on the buyer, not as reasons against
    if (!legalOk) reasons.push({ ok: null, key: 'docPending', values: { list: pendingApprovals(p).join(',') } })
    if (r.approvalRequired) {
      const n = p.approvals.length
      reasons.push(n && legalOk ? { ok: true, key: 'approvalsUploaded' } : n ? { ok: null, key: 'approvalsPending' } : { ok: false, key: 'noApprovalBadges' })
    }
  } else {
    failed.forEach((f) => reasons.push({ ok: false, key: 'fail_' + f.key }))
  }
  const parts = { budget: Math.round(B), location: Math.round(L), size: Math.round(S), amenities: Math.round(A), preferences: Math.round(P) }
  return { property: p, lead, score, label, excluded: failed.length > 0, reasons, ceiling, parts }
}

const isActiveLead = (l: Lead) => l.stage !== 'lost' && l.stage !== 'closed'

/** Leads that fit a property, best first. Excluded and inactive leads are left out. */
export function leadsForProperty(p: Property, leads: Lead[], settings: Settings): Match[] {
  if (!isOnOffer(p)) return []
  return leads
    .filter(isActiveLead)
    .map((l) => matchScore(l, p, settings))
    .filter((m) => !m.excluded)
    .sort((a, b) => Number(a.label === 'conditional') - Number(b.label === 'conditional') || b.score - a.score)
}

/** Properties that fit a lead, best first (clean before conditional). */
export function propertiesForLead(lead: Lead, properties: Property[], settings: Settings): Match[] {
  return properties
    .map((p) => matchScore(lead, p, settings))
    .filter((m) => !m.excluded)
    .sort((a, b) => Number(a.label === 'conditional') - Number(b.label === 'conditional') || b.score - a.score)
}

/** Leads for whom everything fits except the price, and the price is within 15% of what they'll pay — worth a call about the gap. */
export function closeOnBudget(p: Property, leads: Lead[], settings: Settings): Match[] {
  if (!isOnOffer(p)) return []
  return leads
    .filter(isActiveLead)
    .map((l) => matchScore(l, p, settings))
    .filter((m) => m.label === 'budgetMismatch' && p.price <= m.ceiling * 1.15)
    .sort((a, b) => b.ceiling - a.ceiling)
}

/**
 * Properties left out for a lead, and why: every listed property (not drafts or archived ones) that fails a hard filter.
 * Those that fail on price alone come first, closest to the budget first — they are worth a conversation.
 */
export function excludedForLead(lead: Lead, properties: Property[], settings: Settings): Match[] {
  return properties
    .filter((p) => p.status !== 'draft' && !p.archived)
    .map((p) => matchScore(lead, p, settings))
    .filter((m) => m.excluded)
    .sort((a, b) => Number(b.label === 'budgetMismatch') - Number(a.label === 'budgetMismatch') || a.property.price - b.property.price)
}
