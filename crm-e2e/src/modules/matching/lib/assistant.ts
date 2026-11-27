/**
 * The property-matching assistant (master prompt §12.2 "Property matching", §14): reads a request such as
 * "properties within Rahul's budget in Whitefield", "3 BHK ready to move for Priya under 1.2 Cr" or "who fits PRP-1004"
 * into a target (a lead or a property) plus extra filters, using the same NL parser as the Properties search.
 * Rule-based (the simulated AI); the page shows its reading as chips with the Demo AI badge, and nothing is written.
 */
import type { ID, Lead, Property } from '@/domain/types'
import { criteriaKeys, parsePropertyQuery, propertyMatchesFilters, type PropertyFilters } from '@/lib/search'
import type { Match } from '@/lib/matching'

export type MatchingReading = {
  mode: 'lead' | 'property' | 'search'
  leadId?: ID
  propertyId?: ID
  /** Other leads whose first name also fits (the user can pick one). */
  alsoLeads: ID[]
  filters: PropertyFilters
  /** The criteria keys read from the sentence (one chip each). */
  criteria: string[]
  /** Nothing usable was understood. */
  empty: boolean
}

const FILLER = /\b(properties|property|homes?|options?|matches|matching|match|show|me|find|get|list|suggest|suitable|best|for|of|the|a|an|within|inside|in budget|budget|fits?|fitting|who|which|leads?|buyers?|clients?|customers?|would|like|could|can|please|that|and|to|interested|want|wants|looking|good)\b/g

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A lead named in the text: the full name first, then a unique-enough first name (3+ letters, possessive allowed). */
export function findLead(text: string, leads: Pick<Lead, 'id' | 'name'>[]): { lead?: Pick<Lead, 'id' | 'name'>; also: ID[]; matched?: string } {
  const lower = text.toLowerCase()
  const full = leads.find((l) => new RegExp(`\\b${esc(l.name.toLowerCase())}(?:'s)?\\b`).test(lower))
  if (full) return { lead: full, also: [], matched: full.name }
  const byFirst = leads.filter((l) => {
    const first = l.name.split(/\s+/)[0]?.toLowerCase() ?? ''
    return first.length >= 3 && new RegExp(`\\b${esc(first)}(?:'s|s')?\\b`).test(lower)
  })
  if (!byFirst.length) return { also: [] }
  return { lead: byFirst[0], also: byFirst.slice(1).map((l) => l.id), matched: byFirst[0].name.split(/\s+/)[0] }
}

/** A property named in the text: its id (PRP-1004, "1004") or its project name. */
export function findProperty(text: string, properties: Pick<Property, 'id' | 'title' | 'projectName'>[]): { property?: Pick<Property, 'id' | 'title' | 'projectName'>; matched?: string } {
  const id = /\b(?:prp[- ]?)?(\d{4})\b/i.exec(text)
  if (id) {
    const p = properties.find((x) => x.id.toLowerCase() === `prp-${id[1]}`)
    if (p) return { property: p, matched: id[0] }
  }
  const lower = text.toLowerCase()
  const p = properties.find((x) => x.projectName && new RegExp(`\\b${esc(x.projectName.toLowerCase())}\\b`).test(lower))
  return p ? { property: p, matched: p.projectName } : {}
}

export function readMatchingRequest(text: string, leads: Pick<Lead, 'id' | 'name'>[], properties: Pick<Property, 'id' | 'title' | 'projectName'>[]): MatchingReading {
  let rest = ` ${text} `
  const { lead, also, matched: leadWords } = findLead(text, leads)
  const { property, matched: propWords } = findProperty(text, properties)
  if (leadWords) rest = rest.replace(new RegExp(`${esc(leadWords)}(?:'s|s')?`, 'i'), ' ')
  if (propWords) rest = rest.replace(new RegExp(esc(propWords), 'i'), ' ')
  const asksForPeople = /\b(leads?|buyers?|clients?|customers?|who)\b/i.test(text)
  const parsed = parsePropertyQuery(rest.replace(/'s\b/g, ' ').toLowerCase().replace(FILLER, ' '))
  // a request names its target; words the parser did not know are not a search inside the matches
  const filters: PropertyFilters = { ...parsed, text: undefined }
  const criteria = criteriaKeys(filters)
  const mode: MatchingReading['mode'] = property && (asksForPeople || !lead) ? 'property' : lead ? 'lead' : 'search'
  return {
    mode,
    leadId: mode === 'lead' ? lead?.id : undefined,
    propertyId: mode === 'property' ? property?.id : undefined,
    alsoLeads: mode === 'lead' ? also : [],
    filters,
    criteria,
    empty: !lead && !property && !criteria.length,
  }
}

/** Matches narrowed by the extra filters the request added (price filters are the request's own, not the budget). */
export const narrowMatches = (matches: Match[], filters: PropertyFilters) =>
  criteriaKeys(filters).length ? matches.filter((m) => propertyMatchesFilters(m.property, filters)) : matches
