/**
 * The Leads list's rules — follow-up tabs, filters, "needs attention" groups, sorting and the sentence search —
 * kept pure so Today, Pipeline, Reports and the Leads list count leads the same way (foundation-plan §5.5, §7.5).
 * Ported from wireframe-rebuild/src/features/leads/lead-list.ts and adapted to the new model: the next follow-up is
 * derived from the lead's earliest open task, readiness became the score + temperature, stages are the new keys.
 */
import type { Appointment, Classification, ID, Lead, LeadSource, LostReason, PipelineStageKey, Priority, PropertyType, SavedView, Settings, Task, Temperature } from '@/domain/types'
import { CITIES, LEAD_SOURCES, LOST_REASONS, OPEN_STAGES, STAGES, TEMPERATURES } from '@/domain/catalogue'
import { daysSince, localDay, minutesBetween } from './dates'

/** One row of the list: the lead and what is worked out about it (scores come from lib/scoring, memoised by the caller). */
export type LeadItem = {
  lead: Lead
  score: number
  temperature: Temperature
  cls: Classification
  /** Earliest open task due time for this lead (the derived "next follow-up"). */
  nextFollowUpAt?: string
  /** A future (or today's) scheduled site visit or a completed one exists. */
  hasVisit: boolean
  /** Derived priority, when the caller supplies `facts.priority`. */
  priority?: Priority
}

export type LeadFacts = {
  score: (l: Lead) => { score: number; temperature: Temperature }
  cls: (l: Lead) => Classification
  tasks: Pick<Task, 'leadId' | 'status' | 'dueAt'>[]
  appointments: Pick<Appointment, 'leadId' | 'type' | 'status'>[]
  /** Optional: the lead's priority from its temperature (lib/scoring priorityFor). */
  priority?: (l: Lead, temperature: Temperature) => Priority
}

export function leadItems(leads: Lead[], facts: LeadFacts): LeadItem[] {
  const next = new Map<ID, string>()
  for (const t of facts.tasks) {
    if (t.status !== 'open' || !t.leadId) continue
    const cur = next.get(t.leadId)
    if (!cur || t.dueAt < cur) next.set(t.leadId, t.dueAt)
  }
  const visited = new Set(facts.appointments
    .filter((a) => a.type === 'siteVisit' && (a.status === 'completed' || a.status === 'scheduled' || a.status === 'rescheduled'))
    .map((a) => a.leadId))
  return leads.map((lead) => {
    const s = facts.score(lead)
    const temperature = lead.temperatureOverride ?? s.temperature
    return {
      lead, score: s.score, temperature, cls: facts.cls(lead), nextFollowUpAt: next.get(lead.id), hasVisit: visited.has(lead.id),
      priority: facts.priority?.(lead, temperature),
    }
  })
}

/* ---------- follow-up tabs ---------- */

export type LeadTab = 'all' | 'overdue' | 'today' | 'upcoming' | 'closed'
export const LEAD_TABS: LeadTab[] = ['all', 'overdue', 'today', 'upcoming', 'closed']

export const isActive = (l: Pick<Lead, 'stage'>) => OPEN_STAGES.includes(l.stage)
export const isOverdue = (x: LeadItem, now: Date) => isActive(x.lead) && !!x.nextFollowUpAt && x.nextFollowUpAt < now.toISOString()
export const isDueToday = (x: LeadItem, now: Date) =>
  isActive(x.lead) && !!x.nextFollowUpAt && x.nextFollowUpAt >= now.toISOString() && localDay(x.nextFollowUpAt) === localDay(now)

/** Who to call now: overdue, due later today, later on, or closed (booked/converted/lost). "All" is everyone. */
export function inTab(x: LeadItem, tab: LeadTab, now: Date): boolean {
  switch (tab) {
    case 'all': return true
    case 'overdue': return isOverdue(x, now)
    case 'today': return isDueToday(x, now)
    case 'upcoming': return isActive(x.lead) && !!x.nextFollowUpAt && localDay(x.nextFollowUpAt) > localDay(now)
    case 'closed': return !isActive(x.lead)
  }
}

/* ---------- needs attention ---------- */

export type LeadAttention = 'overdue' | 'noFollowUp' | 'hotNoVisit' | 'uncontacted'
export const LEAD_ATTENTION: LeadAttention[] = ['overdue', 'uncontacted', 'noFollowUp', 'hotNoVisit']

export function attentionOf(x: LeadItem, now: Date): LeadAttention[] {
  const l = x.lead
  if (!isActive(l)) return []
  const out: LeadAttention[] = []
  if (isOverdue(x, now)) out.push('overdue')
  if (l.ownerId && !l.firstContactAt && l.stage === 'new') out.push('uncontacted')
  if (!x.nextFollowUpAt) out.push('noFollowUp')
  if (x.temperature === 'hot' && !x.hasVisit) out.push('hotNoVisit')
  return out
}

/* ---------- filters ---------- */

export type LeadSort = 'score' | 'followUp' | 'newest' | 'name'
export type LeadFilters = {
  q?: string
  stages?: PipelineStageKey[]
  owners?: (ID | '__none')[]
  sources?: LeadSource[]
  types?: PropertyType[]
  cities?: string[]
  temperatures?: Temperature[]
  cls?: Classification
  nri?: boolean
  /** "under 50 lakh" keeps leads whose top budget is at most this. */
  maxBudget?: number
  minBudget?: number
  attn?: LeadAttention
  priorities?: Priority[]
  localities?: string[]
  /** Created within the last N days (1 = today). */
  createdWithin?: number
  /** Lost leads with one of these reasons (Reports click-through). */
  lostReasons?: LostReason[]
  sort?: LeadSort
}

export function matchesLead(x: LeadItem, f: LeadFilters, now: Date): boolean {
  const l = x.lead
  const r = l.requirement
  if (f.q) {
    const hay = [l.id, l.name, l.phone, l.email, l.source, ...r.cities, ...r.localities].join(' ').toLowerCase()
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w) || hay.replace(/\s/g, '').includes(w))) return false
  }
  if (f.stages?.length && !f.stages.includes(l.stage)) return false
  if (f.owners?.length && !f.owners.includes(l.ownerId ?? '__none')) return false
  if (f.sources?.length && !f.sources.includes(l.source)) return false
  if (f.types?.length && !r.propertyTypes.some((t) => f.types!.includes(t))) return false
  if (f.cities?.length && !r.cities.some((c) => f.cities!.includes(c))) return false
  if (f.temperatures?.length && !f.temperatures.includes(x.temperature)) return false
  if (f.cls && x.cls !== f.cls) return false
  if (f.nri !== undefined && l.isNri !== f.nri) return false
  if (f.maxBudget && (r.budgetMax ?? 0) > f.maxBudget) return false
  if (f.minBudget && (r.budgetMax ?? 0) < f.minBudget) return false
  if (f.attn && !attentionOf(x, now).includes(f.attn)) return false
  if (f.priorities?.length && (!x.priority || !f.priorities.includes(x.priority))) return false
  if (f.localities?.length && !r.localities.some((loc) => f.localities!.includes(loc))) return false
  if (f.createdWithin && daysSince(l.createdAt, now) >= f.createdWithin) return false
  if (f.lostReasons?.length && (!l.lost || !f.lostReasons.includes(l.lost.reason))) return false
  return true
}

export function sortLeads(list: LeadItem[], by: LeadSort = 'score'): LeadItem[] {
  const out = [...list]
  if (by === 'score') return out.sort((a, b) => b.score - a.score || a.lead.name.localeCompare(b.lead.name))
  if (by === 'followUp') return out.sort((a, b) => (a.nextFollowUpAt ?? '9999').localeCompare(b.nextFollowUpAt ?? '9999'))
  if (by === 'name') return out.sort((a, b) => a.lead.name.localeCompare(b.lead.name))
  return out.sort((a, b) => b.lead.createdAt.localeCompare(a.lead.createdAt))
}

/** Filters that are set (for "Clear all"); the sort does not count. */
export const filterCount = (f: LeadFilters) =>
  (['q', 'cls', 'nri', 'maxBudget', 'minBudget', 'attn', 'createdWithin'] as const).filter((k) => f[k] !== undefined && f[k] !== '').length +
  (['stages', 'owners', 'sources', 'types', 'cities', 'temperatures', 'priorities', 'localities', 'lostReasons'] as const).filter((k) => f[k]?.length).length

/** Counts per tab, with the same rules everywhere. */
export const tabCounts = (items: LeadItem[], now: Date): Record<LeadTab, number> =>
  Object.fromEntries(LEAD_TABS.map((t) => [t, items.filter((x) => inTab(x, t, now)).length])) as Record<LeadTab, number>

/* ---------- sentence search ("investors in Pune under 80 lakh") ---------- */

const amount = (n: string, unit?: string) => {
  const v = parseFloat(n.replace(/,/g, ''))
  return unit && /^c/.test(unit) ? v * 1e7 : unit && /^l/.test(unit) ? v * 1e5 : v >= 1e5 ? v : v * 1e5
}

/** Read a plain sentence into filters. Words it does not know are left out (never guessed). */
export function parseLeadSentence(text: string): LeadFilters {
  const q = ` ${text.toLowerCase()} `
  const f: LeadFilters = {}
  // a city, or one of its localities ("in Whitefield" → Bengaluru); "Bangalore" is the common spelling
  const cities = Object.entries(CITIES)
    .filter(([c, locs]) => q.includes(` ${c.toLowerCase()}`) || locs.some((loc) => q.includes(` ${loc.toLowerCase()}`)) || (c === 'Bengaluru' && /\bbangalore\b/.test(q)))
    .map(([c]) => c)
  if (cities.length) f.cities = cities
  const types: PropertyType[] = []
  if (/\bplots?\b/.test(q)) types.push('plot')
  if (/\b(flats?|apartments?|bhk)\b/.test(q)) types.push('apartment')
  if (/\bvillas?\b/.test(q)) types.push('villa')
  if (/\b(independent house|houses?)\b/.test(q)) types.push('independentHouse')
  if (/\b(offices?)\b/.test(q)) types.push('office')
  if (/\b(shops?)\b/.test(q)) types.push('shop')
  if (types.length) f.types = types
  if (/\bhni\b/.test(q)) f.cls = 'potentialHni'
  else if (/\binvestors?\b/.test(q)) f.cls = 'investor'
  else if (/\bhigh[- ]value\b/.test(q)) f.cls = 'highValue'
  if (/\bnri\b/.test(q)) f.nri = true
  const temps: Temperature[] = (['hot', 'warm', 'cold'] as const).filter((t) => new RegExp(`\\b${t}\\b`).test(q))
  if (temps.length) f.temperatures = temps
  const stages: [RegExp, PipelineStageKey][] = [[/\bnegotiat/, 'negotiation'], [/\b(visit scheduled|site visit)\b/, 'siteVisitScheduled'], [/\bvisit done|visited\b/, 'siteVisitDone'],
    [/\bnew (enquir|lead)/, 'new'], [/\bcontacted\b/, 'contacted'], [/\bqualified\b/, 'qualified'], [/\bbooked\b/, 'booked'], [/\bconverted\b/, 'converted'], [/\blost\b/, 'lost']]
  for (const [re, s] of stages) if (re.test(q)) { f.stages = [s]; break }
  const under = q.match(/\b(?:under|below|upto|up to|within|less than)\s*₹?\s*([\d.,]+)\s*(l|lakh|lakhs|lac|cr|crore|crores)?\b/)
  if (under) f.maxBudget = amount(under[1], under[2])
  const over = q.match(/\b(?:above|over|more than|from)\s*₹?\s*([\d.,]+)\s*(l|lakh|lakhs|lac|cr|crore|crores)?\b/)
  if (over) f.minBudget = amount(over[1], over[2])
  if (/\boverdue\b/.test(q)) f.attn = 'overdue'
  else if (/\b(uncalled|not contacted|uncontacted)\b/.test(q)) f.attn = 'uncontacted'
  if (/\bunassigned\b/.test(q)) f.owners = ['__none']
  return f
}

/* ---------- lead aging (days since contact, SLA breach) ---------- */

export type ContactAging = { days: number | null; breached: boolean; tone: 'muted' | 'warning' | 'danger' }

/**
 * Days since the last contact and whether the first-response SLA is breached (a new lead never contacted after
 * `sla.firstResponseMins`). Tone: muted under 3 days, warning 3–6, danger from 7 or on a breach (DESIGN_SYSTEM §11.3).
 * A lead never contacted ages from its creation. Closed leads never warn.
 */
export function contactAging(
  lead: Pick<Lead, 'lastContactAt' | 'firstContactAt' | 'stage' | 'createdAt'>,
  sla: Pick<Settings['sla'], 'firstResponseMins'>,
  now: Date,
): ContactAging {
  const days = lead.lastContactAt ? daysSince(lead.lastContactAt, now) : null
  const open = isActive(lead)
  const breached = open && lead.stage === 'new' && !lead.firstContactAt && minutesBetween(lead.createdAt, now) > sla.firstResponseMins
  const age = days ?? daysSince(lead.createdAt, now)
  const tone = !open ? 'muted' : breached || age >= 7 ? 'danger' : age >= 3 ? 'warning' : 'muted'
  return { days, breached, tone }
}

/* ---------- saved views: filters <-> stored record ---------- */

const LIST_KEYS = ['stages', 'owners', 'sources', 'types', 'cities', 'temperatures', 'priorities', 'localities'] as const

/** Turns a stored SavedView's filters into LeadFilters. Accepts the seed's short forms ({ temperature: ['hot'] }, { owner: 'unassigned' }). */
export function filtersFromView(v: Pick<SavedView, 'filters' | 'sort'>): LeadFilters {
  const raw = v.filters ?? {}
  const f: Record<string, unknown> = {}
  for (const k of LIST_KEYS) {
    const val = raw[k]
    if (Array.isArray(val) && val.length) f[k] = val.map(String)
  }
  if (Array.isArray(raw.temperature) && raw.temperature.length) f.temperatures = raw.temperature.map(String)
  if (raw.owner === 'unassigned') f.owners = ['__none']
  else if (typeof raw.owner === 'string') f.owners = [raw.owner]
  for (const k of ['q', 'cls', 'attn'] as const) if (typeof raw[k] === 'string' && raw[k]) f[k] = raw[k]
  for (const k of ['maxBudget', 'minBudget', 'createdWithin'] as const) if (typeof raw[k] === 'number') f[k] = raw[k]
  if (typeof raw.nri === 'boolean') f.nri = raw.nri
  const key = v.sort?.key
  f.sort = key === 'createdAt' || key === 'newest' ? 'newest' : key === 'name' ? 'name' : key === 'followUp' ? 'followUp' : 'score'
  return f as LeadFilters
}

/** The part of LeadFilters worth storing (empty lists and blanks dropped) and the sort. */
export function viewFromFilters(f: LeadFilters): Pick<SavedView, 'filters' | 'sort'> {
  const filters: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(f)) {
    if (k === 'sort' || val === undefined || val === '' || (Array.isArray(val) && !val.length)) continue
    filters[k] = val
  }
  const sort = f.sort ?? 'score'
  return { filters, sort: { key: sort, dir: sort === 'name' || sort === 'followUp' ? 'asc' : 'desc' } }
}

/** Same filters and sort (list order does not matter): the saved-views menu ticks the view that is on. */
export function sameFilters(a: LeadFilters, b: LeadFilters): boolean {
  const norm = (f: LeadFilters) => JSON.stringify(Object.entries(viewFromFilters(f).filters)
    .map(([k, v]) => [k, Array.isArray(v) ? [...v].map(String).sort() : v]).sort((x, y) => String(x[0]).localeCompare(String(y[0]))))
  return norm(a) === norm(b) && (a.sort ?? 'score') === (b.sort ?? 'score')
}

/* ---------- CSV export ---------- */

/** RFC 4180 quoting; a leading = + - @ is prefixed with ' so spreadsheet apps do not run it as a formula. */
export function csvCell(v: string | number | undefined | null): string {
  let s = v === undefined || v === null ? '' : String(v)
  if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: (string | number | undefined | null)[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/* ---------- URL filters (chart click-throughs: /leads?stage=…&source=…&owner=…&lostReason=…) ---------- */

const listParam = <T extends string>(v: string | null, allowed?: readonly T[]): T[] =>
  (v ?? '').split(',').map((x) => x.trim()).filter((x): x is T => !!x && (!allowed || (allowed as readonly string[]).includes(x)))

/** The filters a /leads URL carries; unknown values are ignored so a stale link never shows an impossible filter. */
export function leadFiltersFromParams(params: URLSearchParams): LeadFilters {
  const f: LeadFilters = {}
  const stages = listParam(params.get('stage'), STAGES)
  const sources = listParam(params.get('source'), LEAD_SOURCES)
  const owners = listParam<ID>(params.get('owner'))
  const temperatures = listParam(params.get('temp'), TEMPERATURES)
  const lostReasons = listParam(params.get('lostReason'), LOST_REASONS)
  const attn = params.get('attn')
  if (stages.length) f.stages = stages
  if (sources.length) f.sources = sources
  if (owners.length) f.owners = owners
  if (temperatures.length) f.temperatures = temperatures
  if (lostReasons.length) { f.lostReasons = lostReasons; f.stages ??= ['lost'] }
  if (attn && (LEAD_ATTENTION as string[]).includes(attn)) f.attn = attn as LeadAttention
  return f
}
