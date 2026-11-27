/**
 * The Leads list's rules — follow-up tabs, filters, "needs attention" groups, sorting and the sentence search —
 * kept pure so Today, Pipeline, Reports and the Leads list count leads the same way (foundation-plan §5.5, §7.5).
 * Ported from wireframe-rebuild/src/features/leads/lead-list.ts and adapted to the new model: the next follow-up is
 * derived from the lead's earliest open task, readiness became the score + temperature, stages are the new keys.
 */
import type { Appointment, Classification, ID, Lead, LeadSource, PipelineStageKey, PropertyType, Task, Temperature } from '@/domain/types'
import { CITIES, OPEN_STAGES } from '@/domain/catalogue'
import { localDay } from './dates'

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
}

export type LeadFacts = {
  score: (l: Lead) => { score: number; temperature: Temperature }
  cls: (l: Lead) => Classification
  tasks: Pick<Task, 'leadId' | 'status' | 'dueAt'>[]
  appointments: Pick<Appointment, 'leadId' | 'type' | 'status'>[]
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
    return { lead, score: s.score, temperature: lead.temperatureOverride ?? s.temperature, cls: facts.cls(lead), nextFollowUpAt: next.get(lead.id), hasVisit: visited.has(lead.id) }
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
  (['q', 'cls', 'nri', 'maxBudget', 'minBudget', 'attn'] as const).filter((k) => f[k] !== undefined && f[k] !== '').length +
  (['stages', 'owners', 'sources', 'types', 'cities', 'temperatures'] as const).filter((k) => f[k]?.length).length

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
