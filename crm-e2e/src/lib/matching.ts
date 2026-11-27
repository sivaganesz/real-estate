/**
 * Two-way property matching (foundation-plan §7.7): properties for a lead, and leads for a property.
 *
 * Base: wireframe-rebuild/src/lib/matching.ts (hard filters, five weighted parts, configurable weights, labels,
 * closeOnBudget, excludedForLead). Merged in from estate-platform apps/api/src/services/matching.ts: plain-language
 * reasons (over budget by how much, "may feel too small", must-have text matching, on hold), the shortlist memory
 * (liked / visited / shared, "not interested" never comes back), fewer bedrooms excluded, and the per-project cap.
 *
 * Step 1, hard filters → excluded: not live, booked or sold, purpose, type, city, way over budget, fewer bedrooms,
 * marked not interested. Step 2, score M = Σ weight × part (each part 0–100, weights from settings.matching).
 * Reasons carry an i18n key (matching:reason.<key>) and params; `tParams` name params whose value is itself an i18n key.
 */
import type { TFunction } from 'i18next'
import type { ActorId, DB, ID, Lead, Property, Settings, ShortlistItem, User } from '@/domain/types'
import { CONFIGURATION_BEDROOMS, OPEN_STAGES, STAGE_RANK } from '@/domain/catalogue'
import { fmtDate, inrShort, num } from './format'
import { can } from './permissions'
import { pendingApprovals, usableAreaSqft } from './property'

export type MatchPart = 'budget' | 'location' | 'size' | 'amenities' | 'preferences'
/** The order the score's parts are shown in, with the default formula M = 0.30B + 0.25L + 0.20S + 0.15A + 0.10P. */
export const MATCH_PARTS: MatchPart[] = ['budget', 'location', 'size', 'amenities', 'preferences']

export type MatchLabel = 'strong' | 'good' | 'weak' | 'conditional' | 'budgetMismatch' | 'excluded'

/** ok: true ✓ · false ✗ · null "check / note" (amber). */
export type Reason = { ok: boolean | null; key: string; params?: Record<string, string | number>; tParams?: Record<string, string> }

export type Match = {
  property: Property
  lead: Lead
  /** 0–100; shown as a percentage. */
  score: number
  label: MatchLabel
  excluded: boolean
  reasons: Reason[]
  /** The five parts of the score, each 0–100, before the weights. */
  parts: Record<MatchPart, number>
  /** The most the lead will pay: maximum budget plus their flexibility (Infinity when no budget is known). */
  ceiling: number
  /** What the shortlist remembers about this pair. */
  memory?: ShortlistItem['status']
}

type MatchSettings = Pick<Settings, 'matching'>

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))
const near = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
/** "2BHK" → "2 BHK", "4BHK+" → "4+ BHK". */
export const configLabel = (c: string) => c.replace(/^(\d(?:\.5)?)BHK(\+?)$/, '$1$2 BHK')
/** "coveredParking" → "covered parking": amenity keys as words, for free-text must-have matching. */
const words = (key: string) => key.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase()
const FACING_WORD: Record<string, string> = { n: 'north', e: 'east', s: 'south', w: 'west', ne: 'north east', nw: 'north west', se: 'south east', sw: 'south west' }

/* ---------- parts ---------- */

/** Basic infrastructure for the property's family (rebuild infraScore), 0–100. */
function infraScore(p: Property): number {
  const has = (k: string) => p.amenities.includes(k)
  const s = p.specs
  const parking = p.parking.covered + p.parking.open > 0
  let checks: boolean[]
  switch (p.type) {
    case 'apartment':
      checks = [has('lift') || Number(s.lifts) > 0 || (p.floor ?? 99) <= 1, parking, has('powerBackup') || s.powerBackup === 'full' || s.powerBackup === 'partial', has('security') || has('gatedCommunity')]
      break
    case 'villa': case 'independentHouse': case 'rowHouse':
      checks = [parking, !!s.water && s.water !== 'tanker', !!s.power || has('powerBackup'), has('security') || has('gatedCommunity') || !!p.gatedCommunity]
      break
    case 'plot': case 'agriLand':
      checks = [(p.roadWidthFt ?? 0) >= 20, !!(s.water ?? s.waterSource) && s.water !== 'notAvailable', !!s.electricity && s.electricity !== 'notAvailable', !!s.drainage && s.drainage !== 'notAvailable']
      break
    default:
      checks = [(p.roadWidthFt ?? 0) >= 30 || s.truckAccess === 'container', parking || has('visitorParking') || has('loadingBay'), !!s.powerKva || has('powerBackup')]
  }
  return (checks.filter(Boolean).length / checks.length) * 100
}

/** A free-text must-have ("East facing", "covered parking", "near metro") against the listing (estate text matcher). */
function mustHaveCheck(text: string, p: Property): boolean | null {
  const lower = text.toLowerCase().trim()
  const facing = /(north|east|south|west)(?:[\s-](east|west))?\s*facing/.exec(lower)
  if (facing) return !!p.facing && FACING_WORD[p.facing.toLowerCase()] === facing.slice(1).filter(Boolean).join(' ')
  if (p.amenities.some((a) => words(a).includes(lower) || lower.includes(words(a)))) return true
  if (/covered parking|car parking|parking/.test(lower)) return p.parking.covered > 0 || (!/covered/.test(lower) && p.parking.open > 0)
  if (/vastu/.test(lower)) return !!p.vastuCompliant
  if (/corner/.test(lower)) return !!p.corner
  if (/gated/.test(lower)) return !!p.gatedCommunity || p.amenities.includes('gatedCommunity')
  if (/borewell|water/.test(lower) && /borewell/i.test(String(p.specs.water ?? p.specs.waterSource ?? ''))) return true
  if (/kva|power/.test(lower) && p.specs.powerKva) return Number(p.specs.powerKva) >= Number(/\d+/.exec(lower)?.[0] ?? 0)
  return /near|school|metro|hospital|station|airport|view/.test(lower) ? null : false
}

/* ---------- the score ---------- */

export function matchScore(lead: Lead, p: Property, settings: MatchSettings, now: Date): Match {
  const w = settings.matching.weights
  const r = lead.requirement
  const memory = lead.shortlist.find((s) => s.propertyId === p.id)
  const max = r.budgetMax
  const ceiling = max ? max * (1 + (r.budgetFlexPct ?? 10) / 100) : Infinity
  const wantBeds = r.configurations.map((c) => CONFIGURATION_BEDROOMS[c])
  const propBeds = p.configuration ? CONFIGURATION_BEDROOMS[p.configuration] : p.bedrooms

  // Step 1: hard filters
  const fails: Reason[] = []
  if (p.listing !== 'live') fails.push({ ok: false, key: 'fail.listing', tParams: { listing: `catalogue:listing.${p.listing}` } })
  if (p.status === 'booked' || p.status === 'sold') fails.push({ ok: false, key: 'fail.status', tParams: { status: `catalogue:propertyStatus.${p.status}` } })
  if (r.purpose !== p.purpose) fails.push({ ok: false, key: 'fail.purpose', tParams: { purpose: `catalogue:purpose.${p.purpose}` } })
  if (r.propertyTypes.length && !r.propertyTypes.includes(p.type)) fails.push({ ok: false, key: 'fail.type', tParams: { type: `catalogue:propertyType.${p.type}` } })
  if (r.cities.length && !r.cities.some((c) => near(c, p.location.city))) fails.push({ ok: false, key: 'fail.city', params: { city: p.location.city } })
  if (wantBeds.length && propBeds && propBeds < Math.min(...wantBeds)) fails.push({ ok: false, key: 'fail.bedrooms', params: { has: configLabel(p.configuration ?? `${propBeds}BHK`), want: configLabel(r.configurations[0]) } })
  if (memory?.status === 'notInterested') fails.push({ ok: false, key: 'fail.notInterested' })
  const overPct = max && p.price > max ? Math.round(((p.price - max) / max) * 100) : 0
  let budgetBand = false
  if (p.price > 0 && p.price > ceiling) {
    if (p.price > ceiling * 1.2) fails.push({ ok: false, key: 'fail.budget', params: { over: inrShort(p.price - (max ?? 0)), pct: overPct } })
    else budgetBand = true
  }

  // Step 2: the parts
  const reasons: Reason[] = []
  // B: budget (rebuild curve + estate "well under" refinement)
  let B: number
  if (!p.price) {
    B = 70
    reasons.push({ ok: null, key: 'priceOnRequest' })
  } else if (!max) {
    B = 70
    reasons.push({ ok: null, key: 'budgetUnknown', params: { price: inrShort(p.price) } })
  } else {
    const pref = Math.min(r.budgetPreferred ?? max, max)
    if (p.price <= pref) B = 100
    else if (p.price <= max) B = 100 - (30 * (p.price - pref)) / Math.max(1, max - pref)
    else if (p.price <= ceiling) B = 55
    else B = 0
    if (p.price <= max) {
      if (r.budgetMin && p.price < r.budgetMin * 0.75) {
        B -= 10
        reasons.push({ ok: null, key: 'wellUnder', params: { price: inrShort(p.price) } })
      } else reasons.push({ ok: true, key: 'withinBudget', params: { price: inrShort(p.price), max: inrShort(max) } })
    } else if (p.price <= ceiling) reasons.push({ ok: null, key: 'overBudget', params: { over: inrShort(p.price - max), pct: overPct } })
    else reasons.push({ ok: false, key: 'overBudgetFar', params: { over: inrShort(p.price - max), pct: overPct } })
  }

  // L: location
  let L = 100
  if (r.localities.length) {
    if (r.localities.some((l) => near(l, p.location.locality))) reasons.push({ ok: true, key: 'preferredLocality', params: { locality: p.location.locality } })
    else {
      L = 70
      reasons.push({ ok: null, key: 'otherLocality', params: { locality: p.location.locality, wanted: r.localities.join(', ') } })
    }
  } else if (r.cities.length) reasons.push({ ok: true, key: 'inCity', params: { city: p.location.city } })

  // S: size = configuration and area, averaged over what is known
  const sizeParts: number[] = []
  if (wantBeds.length && propBeds) {
    const label = configLabel(p.configuration ?? `${propBeds}BHK`)
    if (p.configuration && r.configurations.includes(p.configuration)) {
      sizeParts.push(100)
      reasons.push({ ok: true, key: 'configExact', params: { config: label } })
    } else if (propBeds >= Math.min(...wantBeds) && propBeds <= Math.max(...wantBeds)) {
      sizeParts.push(90)
      reasons.push({ ok: true, key: 'configExact', params: { config: label } })
    } else if (propBeds > Math.max(...wantBeds)) {
      sizeParts.push(80)
      reasons.push({ ok: true, key: 'configMore', params: { config: label, want: configLabel(r.configurations[0]) } })
    }
  }
  const area = usableAreaSqft(p)
  if ((r.areaMinSqft || r.areaMaxSqft) && area) {
    const lo = r.areaMinSqft ?? 0
    const hi = r.areaMaxSqft ?? Infinity
    if (area >= lo && area <= hi) {
      sizeParts.push(100)
      reasons.push({ ok: true, key: 'areaFits', params: { area: num(area), want: num(lo || hi) } })
    } else if (area < lo) {
      const dev = (lo - area) / lo
      sizeParts.push(clamp(Math.round(100 - dev * 200)))
      reasons.push(area >= lo * 0.9
        ? { ok: null, key: 'areaSlightlySmaller', params: { area: num(area), want: num(lo) } }
        : { ok: false, key: 'areaSmaller', params: { area: num(area), want: num(lo) } })
    } else {
      const dev = (area - hi) / hi
      sizeParts.push(clamp(Math.round(100 - dev * 100)))
      reasons.push({ ok: null, key: 'areaLarger', params: { area: num(area), want: num(hi) } })
    }
  }
  const S = sizeParts.length ? sizeParts.reduce((a, b) => a + b, 0) / sizeParts.length : 100

  // A: amenities asked for (hit rate) blended with basic infrastructure
  const infra = infraScore(p)
  let A = infra
  if (r.amenities.length) {
    const hits = r.amenities.filter((a) => p.amenities.includes(a))
    A = 0.5 * infra + 0.5 * (hits.length / r.amenities.length) * 100
    for (const a of r.amenities) reasons.push({ ok: p.amenities.includes(a), key: p.amenities.includes(a) ? 'hasAmenity' : 'missingAmenity', params: { amenity: a }, tParams: { amenity: `catalogue:amenity.${a}` } })
  }

  // P: preferences (possession, facing, Vastu, parking, furnishing, transaction, free-text must-haves)
  const prefs: boolean[] = []
  const pref = (ok: boolean | null, reason: Reason) => {
    if (ok !== null) prefs.push(ok)
    reasons.push({ ...reason, ok })
  }
  if (r.possession === 'ready') pref(p.possession.status === 'ready', { ok: null, key: p.possession.status === 'ready' ? 'readyToMove' : 'notReady', params: { date: p.possession.date ? fmtDate(p.possession.date) : '' } })
  else if (r.possession === 'underConstruction') pref(p.possession.status === 'underConstruction', { ok: null, key: p.possession.status === 'underConstruction' ? 'underConstruction' : 'readyNotUc' })
  if (r.possessionBy && p.possession.status === 'underConstruction' && p.possession.date) {
    pref(p.possession.date <= r.possessionBy, { ok: null, key: p.possession.date <= r.possessionBy ? 'possessionInTime' : 'possessionLate', params: { date: fmtDate(p.possession.date) } })
  }
  if (r.facing.length) pref(!!p.facing && r.facing.includes(p.facing), { ok: null, key: p.facing && r.facing.includes(p.facing) ? 'facingOk' : 'facingOff', tParams: { facing: `catalogue:facing.${p.facing ?? r.facing[0]}` } })
  if (r.vastu) pref(!!p.vastuCompliant, { ok: null, key: p.vastuCompliant ? 'vastuOk' : 'vastuMissing' })
  if (r.parking === 'required') pref(p.parking.covered > 0, { ok: null, key: p.parking.covered > 0 ? 'parkingOk' : 'parkingMissing' })
  if (r.furnishing && r.furnishing !== 'any' && p.furnishing) pref(p.furnishing === r.furnishing, { ok: null, key: p.furnishing === r.furnishing ? 'furnishingOk' : 'furnishingOff', tParams: { furnishing: `catalogue:furnishing.${p.furnishing}` } })
  if (r.transaction && r.transaction !== 'any') pref(p.transaction === r.transaction, { ok: null, key: p.transaction === r.transaction ? 'transactionOk' : 'transactionOff', tParams: { transaction: `catalogue:transaction.${p.transaction}` } })
  for (const m of r.mustHaves) {
    const has = mustHaveCheck(m, p)
    pref(has, { ok: null, key: has === true ? 'mustHave' : has === false ? 'mustHaveMissing' : 'mustHaveCheck', params: { text: has === false ? m.toLowerCase() : m } })
  }
  const P = prefs.length ? (prefs.filter(Boolean).length / prefs.length) * 100 : 100

  let score = Math.round(w.budget * B + w.location * L + w.size * S + w.amenities * A + w.preferences * P)

  // on hold for another buyer (estate): still shown, lower
  if (p.status === 'onHold') {
    score -= 15
    reasons.push({ ok: null, key: p.heldUntil ? 'onHoldUntil' : 'onHold', params: { date: p.heldUntil ? fmtDate(p.heldUntil) : '' } })
  }
  const pending = pendingApprovals(p)
  if (pending.length) reasons.push({ ok: null, key: 'docPending', params: { list: pending.join(', ') } })

  // shortlist memory (estate)
  if (memory?.status === 'liked') reasons.unshift({ ok: true, key: 'liked' })
  else if (memory?.status === 'visited') reasons.push({ ok: null, key: 'visited' })
  else if (memory?.status === 'shared') {
    const days = Math.max(0, Math.floor((now.getTime() - new Date(memory.at).getTime()) / 86_400_000))
    reasons.push({ ok: null, key: days === 0 ? 'sharedToday' : days === 1 ? 'sharedYesterday' : 'sharedDaysAgo', params: { days } })
  } else if (memory?.status === 'shortlisted') reasons.push({ ok: null, key: 'shortlisted' })
  score = clamp(score)

  const misses = reasons.filter((x) => x.ok === false).length
  const excluded = fails.length > 0
  let label: MatchLabel
  if (excluded) label = 'excluded'
  else if (budgetBand) label = 'budgetMismatch'
  else if (pending.length || S < 60) label = 'conditional'
  else if (score >= 80 && misses === 0) label = 'strong'
  else if (score >= 65 && misses <= 1) label = 'good'
  else label = 'weak'

  const parts = { budget: Math.round(B), location: Math.round(L), size: Math.round(S), amenities: Math.round(A), preferences: Math.round(P) }
  return { property: p, lead, score: excluded ? 0 : score, label, excluded, reasons: excluded ? fails : reasons, parts, ceiling, memory: memory?.status }
}

/* ---------- lists ---------- */

const isOpenLead = (l: Lead) => OPEN_STAGES.includes(l.stage)
const shown = (m: Match, minScore: number) => !m.excluded && m.label !== 'budgetMismatch' && m.score >= minScore
/** Clean before conditional, then highest score, then cheapest. */
const byFit = (a: Match, b: Match) =>
  Number(a.label === 'conditional') - Number(b.label === 'conditional') || b.score - a.score || a.property.price - b.property.price

/** At most `cap` results per project, so one project does not fill the list with identical units (estate). */
export function capPerProject(list: Match[], cap: number): Match[] {
  const seen = new Map<string, number>()
  return list.filter((m) => {
    const k = m.property.projectName
    if (!k) return true
    seen.set(k, (seen.get(k) ?? 0) + 1)
    return seen.get(k)! <= cap
  })
}

/** Properties that fit a lead, best first. Booked, sold and "not interested" never appear; below minScore is hidden. */
export function propertiesForLead(lead: Lead, properties: Property[], settings: MatchSettings, now: Date, opts: { limit?: number; includeShared?: boolean } = {}): Match[] {
  const list = properties
    .map((p) => matchScore(lead, p, settings, now))
    .filter((m) => shown(m, settings.matching.minScore))
    .filter((m) => opts.includeShared !== false || !m.memory || m.memory === 'suggested')
    .sort(byFit)
  const capped = capPerProject(list, settings.matching.perProjectCap)
  return opts.limit ? capped.slice(0, opts.limit) : capped
}

/** Open leads that fit a property, best first. Booked and sold properties have none. */
export function leadsForProperty(property: Property, leads: Lead[], settings: MatchSettings, now: Date, opts: { limit?: number } = {}): Match[] {
  if (property.status === 'booked' || property.status === 'sold' || property.listing !== 'live') return []
  const list = leads
    .filter(isOpenLead)
    .map((l) => matchScore(l, property, settings, now))
    .filter((m) => shown(m, settings.matching.minScore))
    .sort(byFit)
  return opts.limit ? list.slice(0, opts.limit) : list
}

/** Leads for whom everything fits except the price, within 15% of what they will pay: worth a call about the gap. */
export function closeOnBudget(property: Property, leads: Lead[], settings: MatchSettings, now: Date): Match[] {
  if (property.status === 'booked' || property.status === 'sold' || property.listing !== 'live') return []
  return leads
    .filter(isOpenLead)
    .map((l) => matchScore(l, property, settings, now))
    .filter((m) => m.label === 'budgetMismatch' && property.price <= m.ceiling * 1.15)
    .sort((a, b) => b.ceiling - a.ceiling)
}

/** The same "worth a call" list from the lead's side: properties only slightly over their budget. */
export function closeOnBudgetForLead(lead: Lead, properties: Property[], settings: MatchSettings, now: Date): Match[] {
  return properties
    .map((p) => matchScore(lead, p, settings, now))
    .filter((m) => m.label === 'budgetMismatch' && m.property.price <= m.ceiling * 1.15)
    .sort((a, b) => a.property.price - b.property.price)
}

/**
 * "Not shown and why": every live listing left out for this lead. Price-only misses come first (closest to the budget
 * first), then low scores, then hard exclusions.
 */
export function excludedForLead(lead: Lead, properties: Property[], settings: MatchSettings, now: Date): Match[] {
  const rank = (m: Match) => (m.label === 'budgetMismatch' ? 0 : !m.excluded ? 1 : 2)
  return properties
    .filter((p) => p.listing === 'live')
    .map((p) => matchScore(lead, p, settings, now))
    .filter((m) => !shown(m, settings.matching.minScore))
    .sort((a, b) => rank(a) - rank(b) || a.property.price - b.property.price)
}

/** The one-line summary: what fits (up to 4 ✓) and what is missing (✗). */
export function matchSummary(m: Match): { good: Reason[]; missing: Reason[]; notes: Reason[] } {
  return {
    good: m.reasons.filter((r) => r.ok === true).slice(0, 4),
    missing: m.reasons.filter((r) => r.ok === false),
    notes: m.reasons.filter((r) => r.ok === null),
  }
}

type TFn = TFunction
/** A reason as text, through i18n (`matching:reason.<key>`); tParams are translated first. */
export function reasonText(r: Reason, t: TFn): string {
  const extra = Object.fromEntries(Object.entries(r.tParams ?? {}).map(([k, key]) => [k, String(t(key))]))
  return String(t(`matching:reason.${r.key}`, { ...r.params, ...extra }))
}

/** "Within budget · Whitefield · 3 BHK · ready to move; missing: covered parking". */
export function summaryLine(m: Match, t: TFn): string {
  const s = matchSummary(m)
  const good = s.good.map((r) => reasonText(r, t)).join(' · ')
  const missing = s.missing.map((r) => reasonText(r, t)).join(', ')
  return missing ? String(t('matching:summary.withMissing', { good, missing })) : good
}

/** Can the lead be matched at all (enough of a requirement to rank properties)? */
export const isMatchableLead = (l: Pick<Lead, 'requirement'>) =>
  !!(l.requirement.budgetMax || l.requirement.propertyTypes.length || l.requirement.cities.length)

/**
 * For Today (estate): one fresh strong or good match per qualified customer that has not been shared yet, at most 5.
 * Leads further down the pipeline come first.
 */
export function bestMatchesToday(db: Pick<DB, 'leads' | 'properties' | 'settings' | 'users'>, user: User, now: Date, limit = 5): Match[] {
  const leads = db.leads
    .filter((l) => ['contacted', 'qualified', 'siteVisitScheduled', 'siteVisitDone'].includes(l.stage) && isMatchableLead(l))
    .filter((l) => can(user, 'lead.view', l, db))
    .sort((a, b) => STAGE_RANK[b.stage] - STAGE_RANK[a.stage] || b.updatedAt.localeCompare(a.updatedAt))
  const out: Match[] = []
  for (const l of leads) {
    const top = propertiesForLead(l, db.properties, db.settings, now, { limit: 1, includeShared: false })[0]
    if (top && (top.label === 'strong' || top.label === 'good')) out.push(top)
    if (out.length >= limit) break
  }
  return out
}

/** Upserts a shortlist entry on a lead draft (used by services): a stronger status never goes back to "suggested". */
export function upsertShortlist(lead: Pick<Lead, 'shortlist'>, propertyId: ID, status: ShortlistItem['status'], at: string, by: ActorId, opts: { onlyUpgrade?: boolean } = {}): void {
  const order: ShortlistItem['status'][] = ['suggested', 'shortlisted', 'shared', 'visited', 'liked']
  const item = lead.shortlist.find((s) => s.propertyId === propertyId)
  if (!item) {
    lead.shortlist.push({ propertyId, status, at, by })
    return
  }
  if (opts.onlyUpgrade && (item.status === 'notInterested' || order.indexOf(item.status) >= order.indexOf(status))) return
  item.status = status
  item.at = at
  item.by = by
}
