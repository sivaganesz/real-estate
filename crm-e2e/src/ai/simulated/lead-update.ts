/**
 * "Update an existing lead" in plain words (master prompt §12.5; the Lead Editing assistant of §12.2). Reads what a
 * message says happened or changed: a call / WhatsApp / meeting (with "no answer"), a new budget, configuration,
 * location, timeline, decision makers, loan, phone or e-mail, a lost reason, a next follow-up date, or just a note.
 * Ported from wireframe-rebuild/src/lib/ai/understand.ts (leadActions / readLeadDetails) and re-keyed to the new
 * Lead model. It only reads what the text says and compares it with the lead, so only real changes are proposed.
 * Pure; no React, no store.
 */
import type { Configuration, Lead, LostReason, Qualification, Requirement, Task } from '@/domain/types'
import { localDay } from '@/lib/dates'
import type { ContactChannel } from '@/services/core/events'
import { lostReasonIn } from './intents'
import {
  amountsIn, budgetIn, configurationsIn, dateIn, decisionIn, emailIn, facingIn, loanIn, norm, phonesIn, placesIn,
  possessionIn, propertyTypesIn, purposeIn, sourceIn, timeIn, timelineIn,
} from './parse'

export type LeadChange = { field: string; from?: unknown; to: unknown }

export type LeadUpdateReading = {
  /** Fields to change (only values that differ from the lead). */
  patch: { requirement?: Partial<Requirement>; qualification?: Partial<Qualification>; phone?: string; altPhone?: string; email?: string; source?: Lead['source'] }
  changes: LeadChange[]
  /** A contact that happened ("called her, no answer"). */
  contact?: { channel: ContactChannel; result?: Task['callResult']; text: string }
  /** A next follow-up the text asks for ("try again tomorrow", "follow up Friday 5pm"). */
  followUp?: { day: string; time?: string; type: Task['type'] }
  lost?: LostReason
  /** Nothing specific was found but something was said about the lead: kept as a note. */
  note?: string
}

const sameList = (a: readonly unknown[] = [], b: readonly unknown[] = []) => a.length === b.length && a.every((x) => b.includes(x))

const CONTACT_RE = /\b(called|call(?:ed)? (?:him|her|them)|spoke|phoned|talked|rang|whats ?app(?:ed)?|messaged|texted|emailed|mailed|met)\b/i
const NO_ANSWER_RE = /\b(no answer|didn'?t (?:pick|answer)|did not (?:pick|answer)|not reachable|unreachable|switched off|not picking|no response|ringing)\b/i
const BUSY_RE = /\b(busy|call(?:ed)? back later|in a meeting)\b/i
const WRONG_RE = /\bwrong number\b/i
const FOLLOW_RE = /\b(try again|call (?:him |her |them )?(?:back|again)|follow[- ]?up|remind me|check back|ping (?:him|her|them)|next call|call on|call tomorrow|call him|call her)\b/i
const LOST_RE = /\b(not interested|lost|bought (?:elsewhere|another|somewhere)|dropped|dead lead|no longer looking|postponed|cancelled the plan)\b/i

export function readLeadUpdate(text: string, lead: Lead, ctx: { now: Date }): LeadUpdateReading {
  const s = norm(text)
  const lower = s.toLowerCase()
  const today = localDay(ctx.now)
  const out: LeadUpdateReading = { patch: {}, changes: [] }
  const req: Partial<Requirement> = {}
  const qual: Partial<Qualification> = {}
  const change = (field: string, from: unknown, to: unknown) => out.changes.push({ field, from, to })

  // a contact that happened
  const contact = CONTACT_RE.exec(s)
  if (contact) {
    const w = contact[1].toLowerCase()
    const channel: ContactChannel = /whats|messag|text/.test(w) ? 'whatsapp' : /mail/.test(w) ? 'email' : 'call'
    const result: Task['callResult'] | undefined = channel !== 'call' ? undefined
      : NO_ANSWER_RE.test(s) ? 'notReachable' : WRONG_RE.test(s) ? 'wrongNumber' : BUSY_RE.test(s) ? 'busy' : 'connected'
    out.contact = { channel, result, text: s }
  } else if (NO_ANSWER_RE.test(s)) {
    out.contact = { channel: 'call', result: 'notReachable', text: s }
  }

  // contact details (only when the text says they changed, or the lead has none)
  const phones = phonesIn(s)
  if (phones[0] && phones[0] !== lead.phone && phones[0] !== lead.altPhone) {
    if (/\b(alt(?:ernate)?|second|other|another|also)\b/i.test(s)) { out.patch.altPhone = phones[0]; change('altPhone', lead.altPhone, phones[0]) }
    else { out.patch.phone = phones[0]; change('phone', lead.phone, phones[0]) }
  }
  const email = emailIn(s)
  if (email && email !== lead.email) { out.patch.email = email; change('email', lead.email, email) }
  const source = /\b(source|came (?:from|via)|through|via)\b/i.test(s) ? sourceIn(s) : undefined
  if (source && source !== lead.source) { out.patch.source = source; change('source', lead.source, source) }

  // requirement: budget only near a budget word (so an offer or a property price is not read as a budget)
  const r = lead.requirement
  const budgetAt = lower.search(/\b(budget|can (?:go|stretch)|stretch|max(?:imum)?|up ?to|upto|afford|range|under|within|below)\b/)
  if (budgetAt >= 0 && !/\b(offer(?:ed)?|counter|seller|asking)\b/.test(lower)) {
    const b = budgetIn(s.slice(budgetAt))
    if (b?.max && b.max !== r.budgetMax) { req.budgetMax = b.max; change('requirement.budgetMax', r.budgetMax, b.max) }
    if (b?.min && b.min !== r.budgetMin) { req.budgetMin = b.min; change('requirement.budgetMin', r.budgetMin, b.min) }
    if (b?.preferred && b.preferred !== r.budgetPreferred) req.budgetPreferred = b.preferred
  } else if (!contact && amountsIn(s).length === 1 && /\b(budget|lakh|lac|cr|crore)\b/.test(lower) && !/\b(offer|counter|seller|asking|price of)\b/.test(lower)) {
    const v = amountsIn(s)[0].value
    if (v !== r.budgetMax) { req.budgetMax = v; change('requirement.budgetMax', r.budgetMax, v) }
  }
  const configs = configurationsIn(s)
  if (configs.length && !sameList(configs, r.configurations)) {
    const next: Configuration[] = /\b(also|or|as well|too)\b/.test(lower) ? [...new Set([...r.configurations, ...configs])] : configs
    req.configurations = next
    change('requirement.configurations', r.configurations, next)
  }
  const types = propertyTypesIn(s)
  if (types.length && !sameList(types, r.propertyTypes) && /\b(wants?|looking|now|prefers?|instead|change|switch)\b/.test(lower)) {
    req.propertyTypes = types
    change('requirement.propertyTypes', r.propertyTypes, types)
  }
  const places = placesIn(s)
  if (places.localities.length && !sameList(places.localities, r.localities)) {
    const next = /\b(also|as well|too|add)\b/.test(lower) ? [...new Set([...r.localities, ...places.localities])] : places.localities
    req.localities = next
    change('requirement.localities', r.localities, next)
    const cities = [...new Set([...(places.cities.length ? places.cities : r.cities)])]
    if (!sameList(cities, r.cities)) req.cities = cities
  } else if (places.cities.length && !places.localities.length && !sameList(places.cities, r.cities)) {
    req.cities = places.cities
    change('requirement.cities', r.cities, places.cities)
  }
  const possession = possessionIn(s, today)
  if (possession.pref && possession.pref !== r.possession) { req.possession = possession.pref; change('requirement.possession', r.possession, possession.pref) }
  const facing = facingIn(s)
  if (facing.length && !sameList(facing, r.facing)) { req.facing = facing; change('requirement.facing', r.facing, facing) }

  // qualification
  const q = lead.qualification
  const timeline = timelineIn(s)
  if (timeline && timeline !== q.timeline) { qual.timeline = timeline; change('qualification.timeline', q.timeline, timeline) }
  const decision = decisionIn(s)
  if (decision.makers.length && !sameList(decision.makers, q.decisionMakers)) {
    qual.decisionMakers = decision.makers
    if (decision.authority) qual.authority = decision.authority
    change('qualification.decisionMakers', q.decisionMakers, decision.makers)
  }
  const loan = loanIn(s)
  if (loan && loan !== q.loan) { qual.loan = loan; change('qualification.loan', q.loan, loan) }
  const purpose = purposeIn(s)
  if (purpose && purpose !== q.buyerPurpose) { qual.buyerPurpose = purpose; change('qualification.buyerPurpose', q.buyerPurpose, purpose) }

  if (Object.keys(req).length) out.patch.requirement = req
  if (Object.keys(qual).length) out.patch.qualification = qual

  // lost, with a reason
  if (LOST_RE.test(s) && lead.stage !== 'lost') out.lost = lostReasonIn(s) ?? 'other'

  // the next follow-up
  const day = dateIn(s, today)
  if (day && (FOLLOW_RE.test(s) || out.contact) && !out.lost) {
    out.followUp = { day, time: timeIn(s), type: /\bwhats ?app\b/i.test(s) ? 'whatsapp' : /\b(call|ring|phone)\b/i.test(s) ? 'call' : 'followUp' }
  }

  // nothing specific, but something was said: a note (only for a sentence, not a stray word)
  const said = !out.contact && !out.changes.length && !out.followUp && !out.lost
  if (said) {
    const noteText = /\b(?:note|notes)\s*[:-]\s*(.+)$/i.exec(s)?.[1] ?? s.replace(/^(?:add (?:a )?note (?:for|on|to) [^:,-]+[:,-]?\s*|update [^:,-]+[:,-]\s*)/i, '')
    if (noteText.split(/\s+/).length >= 3) out.note = noteText.trim()
  }
  return out
}
