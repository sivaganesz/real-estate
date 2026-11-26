/**
 * The Leads list's rules: the follow-up tabs, the filters, the "needs attention" groups, sorting, and the ✨ sentence search.
 * Kept apart from the page so the Lead pipeline and the dashboard can count leads the same way.
 */
import { CITIES } from '@/data/catalogue'
import type { BuyerPurpose, Classification, Database, Lead, LeadStage, PropertyTypeKey } from '@/data/types'
import { classificationOf } from '@/lib/classification'
import { readiness, type ReadinessBand } from '@/lib/readiness'

/** One row of the list: the lead and what's worked out about it. */
export type LeadItem = { lead: Lead; ready: { total: number; band: ReadinessBand }; cls: Classification }

export const leadItems = (leads: Lead[], db: Database): LeadItem[] =>
  leads.map((lead) => ({ lead, ready: readiness(lead, db), cls: classificationOf(lead, db) }))

/* ---------- follow-up tabs ---------- */

export type LeadTab = 'all' | 'overdue' | 'today' | 'upcoming' | 'closed'
export const LEAD_TABS: LeadTab[] = ['all', 'overdue', 'today', 'upcoming', 'closed']

export const isActive = (l: Lead) => l.stage !== 'closed' && l.stage !== 'lost'
export const isOverdue = (l: Lead, today: string) => isActive(l) && !!l.nextFollowUp && l.nextFollowUp < today
export const isDueToday = (l: Lead, today: string) => isActive(l) && l.nextFollowUp === today

/** Who to call now: overdue, due today, later, or closed / lost. "All" is everyone. */
export function inTab(l: Lead, tab: LeadTab, today: string): boolean {
  switch (tab) {
    case 'all': return true
    case 'overdue': return isOverdue(l, today)
    case 'today': return isDueToday(l, today)
    case 'upcoming': return isActive(l) && !!l.nextFollowUp && l.nextFollowUp > today
    case 'closed': return !isActive(l)
  }
}

/* ---------- needs attention (opened with the button, as on the Properties list) ---------- */

export type LeadAttention = 'overdue' | 'noFollowUp' | 'hotNoVisit'
export const LEAD_ATTENTION: LeadAttention[] = ['overdue', 'noFollowUp', 'hotNoVisit']

export function attentionOf(x: LeadItem, today: string): LeadAttention[] {
  const l = x.lead
  if (!isActive(l)) return []
  const out: LeadAttention[] = []
  if (isOverdue(l, today)) out.push('overdue')
  if (!l.nextFollowUp) out.push('noFollowUp')
  // ready to buy, but no site visit done or booked yet
  if (x.ready.band === 'high' && !l.visits.some((v) => v.status === 'completed' || v.status === 'scheduled')) out.push('hotNoVisit')
  return out
}

/* ---------- filters ---------- */

export type LeadSort = 'ready' | 'followUp' | 'newest'
export type LeadFilters = {
  q?: string
  stage?: LeadStage
  owner?: string
  purpose?: BuyerPurpose
  type?: PropertyTypeKey
  cls?: Classification
  city?: string
  /** Several values per section (the Today design's Filter panel): a lead matches if it has any of them. */
  stages?: LeadStage[]
  types?: PropertyTypeKey[]
  cities?: string[]
  owners?: string[]
  /** Budget the lead can go up to — "under 50 lakh" keeps leads whose top budget is at most this. */
  maxBudget?: number
  minBudget?: number
  attn?: LeadAttention
  sort?: LeadSort
  /** The ✨ sentence, as typed and as last run. */
  aiText?: string
  aiRan?: string
  aiMiss?: boolean
}

export function matchesLead(x: LeadItem, f: LeadFilters, today: string): boolean {
  const l = x.lead
  if (f.q) {
    const hay = [l.id, l.name, l.phone, l.email, l.source, ...l.requirement.cities, ...l.requirement.localities].join(' ').toLowerCase()
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false
  }
  if (f.stage && l.stage !== f.stage) return false
  if (f.owner && (f.owner === '__none' ? !!l.ownerId : l.ownerId !== f.owner)) return false
  if (f.purpose && l.purpose !== f.purpose) return false
  if (f.type && l.requirement.type !== f.type) return false
  if (f.cls && x.cls !== f.cls) return false
  if (f.city && !l.requirement.cities.includes(f.city)) return false
  if (f.maxBudget && l.budget.max > f.maxBudget) return false
  if (f.minBudget && l.budget.max < f.minBudget) return false
  if (f.attn && !attentionOf(x, today).includes(f.attn)) return false
  if (f.stages?.length && !f.stages.includes(l.stage)) return false
  if (f.types?.length && !f.types.includes(l.requirement.type)) return false
  if (f.cities?.length && !l.requirement.cities.some((c) => f.cities!.includes(c))) return false
  if (f.owners?.length && !f.owners.includes(l.ownerId ?? '__none')) return false
  return true
}

export function sortLeads(list: LeadItem[], by: LeadSort = 'ready'): LeadItem[] {
  const out = [...list]
  if (by === 'ready') return out.sort((a, b) => b.ready.total - a.ready.total || a.lead.name.localeCompare(b.lead.name))
  if (by === 'followUp') return out.sort((a, b) => (a.lead.nextFollowUp ?? '9999').localeCompare(b.lead.nextFollowUp ?? '9999'))
  return out.sort((a, b) => b.lead.enquiryDate.localeCompare(a.lead.enquiryDate))
}

/** Filters that are set (for "Clear all"); the sort and the sentence don't count. */
export const filterCount = (f: LeadFilters) =>
  (['q', 'stage', 'owner', 'purpose', 'type', 'cls', 'city', 'maxBudget', 'minBudget', 'attn'] as const).filter((k) => f[k] !== undefined && f[k] !== '').length +
  (['stages', 'types', 'cities', 'owners'] as const).filter((k) => f[k]?.length).length

/* ---------- ✨ sentence search ---------- */

export const LEAD_EXAMPLES = ['Investors in Madurai under 50 lakh', 'Ready-to-buy flat buyers in Chennai', 'Leads in negotiation', 'Potential HNI']

const lakh = (n: string, unit?: string) => {
  const v = parseFloat(n.replace(/,/g, ''))
  return unit && /^c/.test(unit) ? v * 1e7 : unit && /^l/.test(unit) ? v * 1e5 : v >= 1e5 ? v : v * 1e5
}

/** Read a plain sentence into filters ("investors in Madurai under 50 lakh"). Words it doesn't know are left out. */
export function parseLeadSentence(text: string): LeadFilters {
  const q = ` ${text.toLowerCase()} `
  const f: LeadFilters = {}
  for (const city of Object.keys(CITIES)) if (q.includes(` ${city.toLowerCase()}`)) f.city = city
  if (/\btrichy\b/.test(q)) f.city = 'Tiruchirappalli'
  if (/\b(plots?|land site)\b/.test(q)) f.type = 'plot'
  else if (/\b(flats?|apartments?|bhk)\b/.test(q)) f.type = 'flat'
  else if (/\b(houses?|villas?)\b/.test(q)) f.type = 'house'
  else if (/\b(shops?|offices?|warehouses?|commercial)\b/.test(q)) f.type = 'commercial'
  else if (/\b(farm|agri|agricultural)\b/.test(q)) f.type = 'agri'
  else if (/\b(industrial|factory|shed)\b/.test(q)) f.type = 'industrial'
  if (/\bhni\b/.test(q)) f.cls = 'potentialHni'
  else if (/\binvestors?\b/.test(q)) f.cls = 'investor'
  else if (/\bhigh[- ]value\b/.test(q)) f.cls = 'highValue'
  if (/\brental\b/.test(q)) f.purpose = 'rentalIncome'
  else if (/\binvest(ment|ing)?\b/.test(q) && !f.cls) f.purpose = 'investment'
  else if (/\bown use|to live|self use\b/.test(q)) f.purpose = 'ownUse'
  else if (/\bbusiness\b/.test(q)) f.purpose = 'businessUse'
  else if (/\bsecond home|holiday home\b/.test(q)) f.purpose = 'secondHome'
  const stages: [RegExp, LeadStage][] = [[/\bnegotiat/, 'negotiation'], [/\bsite visit|visit scheduled\b/, 'visitScheduled'], [/\bnew (enquir|lead)/, 'new'],
    [/\bcontacted\b/, 'contacted'], [/\bqualified\b/, 'qualified'], [/\brecommended\b/, 'recommended'], [/\blost\b/, 'lost'], [/\bclosed|booked\b/, 'closed']]
  for (const [re, s] of stages) if (re.test(q)) { f.stage = s; break }
  const under = q.match(/\b(?:under|below|upto|up to|within|less than)\s*₹?\s*([\d.,]+)\s*(l|lakh|lakhs|lac|cr|crore|crores)?\b/)
  if (under) f.maxBudget = lakh(under[1], under[2])
  const over = q.match(/\b(?:above|over|more than|from)\s*₹?\s*([\d.,]+)\s*(l|lakh|lakhs|lac|cr|crore|crores)?\b/)
  if (over) f.minBudget = lakh(over[1], over[2])
  if (/\boverdue\b/.test(q)) f.attn = 'overdue'
  return f
}
