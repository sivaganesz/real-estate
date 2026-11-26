/**
 * Understanding a message: which job it is (a skill) and the values it carries, in a fixed shape (`Reading`).
 * In the product one AI call returns exactly this shape (Claude with tool use, one tool per skill; step B of the plan);
 * the wireframe fills it with rules so the screens can be shown and won't change when the AI arrives.
 * It only reads what the message says. Anything unclear is left out, and the plan asks for it.
 */
import type { BuyerPurpose, Database, Lead, LeadStage, LostReason, PropertyTypeKey } from '@/data/types'
import { amounts, dateIn, leadsNamed, phoneIn, placesIn, propertyNamed, timeIn } from './parse'

export type LeadQuery = {
  cities: string[]
  readyMin?: number
  noVisit?: boolean
  overdue?: boolean
  dueToday?: boolean
  noFollowUp?: boolean
  stage?: LeadStage
  purpose?: BuyerPurpose
  type?: PropertyTypeKey
  /** "how many …" — the answer leads with the count. */
  count?: boolean
}

export type NewLeadFields = {
  name?: string
  phone?: string
  email?: string
  purpose?: BuyerPurpose
  type?: PropertyTypeKey
  bhk?: string
  cities: string[]
  localities: string[]
  min?: number
  max?: number
  sizeSqft?: number
  contactPref?: 'call' | 'whatsapp' | 'email'
  source?: string
  consent?: boolean
}

export type LeadAction =
  | { kind: 'log'; type: 'call' | 'whatsapp' | 'meeting' | 'note'; text: string; responded?: boolean }
  | { kind: 'book'; propertyId?: string; date?: string; time?: string }
  | { kind: 'outcome'; status: 'completed' | 'noShow' | 'cancelled'; interest?: 'high' | 'medium' | 'low'; feedback: string }
  | { kind: 'budget'; min?: number; max?: number }
  | { kind: 'followUp'; date: string }
  | { kind: 'offer'; propertyId?: string; offered?: number; counter?: number }
  | { kind: 'lost'; reason: LostReason }
  | { kind: 'share'; propertyId: string; channel: 'whatsapp' | 'link' }
  | { kind: 'consent'; how: 'whatsapp' | 'call' | 'inPerson' | 'form' }

export type Reading =
  | { kind: 'findLeads'; q: LeadQuery }
  | { kind: 'findProperties'; text: string }
  | { kind: 'addProperty'; text: string }
  | { kind: 'addLead'; fields: NewLeadFields }
  | { kind: 'lead'; leadId?: string; candidates: string[]; actions: LeadAction[] }
  | { kind: 'unknown' }

export type Context = { db: Database; today: string; leads: Lead[]; /** The lead whose page you're on. */ leadId?: string }

const TYPE_WORDS: [RegExp, PropertyTypeKey][] = [
  [/\b(plots?|land for (a )?house|site)\b/i, 'plot'],
  [/\b(flats?|apartments?|\d\s*bhk)\b/i, 'flat'],
  [/\b(villas?|independent house|houses?|bungalow)\b/i, 'house'],
  [/\b(shops?|showroom|office|warehouse|commercial)\b/i, 'commercial'],
  [/\b(agri(cultural)?|farm ?land|farm)\b/i, 'agri'],
  [/\b(industrial|factory|shed)\b/i, 'industrial'],
]
const typeIn = (s: string) => TYPE_WORDS.find(([re]) => re.test(s))?.[1]

const PURPOSE_WORDS: [RegExp, BuyerPurpose][] = [
  [/\b(rental income|for rent(al)?|rent it out)\b/i, 'rentalIncome'],
  [/\b(invest(ment|or|ing)?)\b/i, 'investment'],
  [/\b(own use|to live|family home|for (the|his|her|their) family|self use)\b/i, 'ownUse'],
  [/\b(business use|for (the|his|her|their) business|office use)\b/i, 'businessUse'],
  [/\b(second home|holiday home|weekend home)\b/i, 'secondHome'],
]
const purposeIn = (s: string) => PURPOSE_WORDS.find(([re]) => re.test(s))?.[1]

const SOURCE_WORDS: [RegExp, string][] = [
  [/\bwalk[- ]?in\b/i, 'Walk-in'], [/\bwebsite\b/i, 'Website'], [/\breferr(al|ed)\b/i, 'Referral'],
  [/\b(portal|99acres|magicbricks|housing\.com)\b/i, 'Property portal'], [/\b(instagram|facebook|social media)\b/i, 'Social media'],
  [/\bchannel partner|broker\b/i, 'Channel partner'], [/\bphone enquiry|called in\b/i, 'Phone enquiry'],
]

const CONSENT_RE = /\b((ok|okay|agreed|agrees|happy|fine)\s+(to|with|for)\s+(a\s+)?(follow[- ]?ups?|be (followed|contacted)|calls?|whatsapp)|consent(ed)?( given)?|follow[- ]?up ok)\b/i
const QUESTION_RE = /^\s*(who|which|what|how many|show|find|list|any|are there|do we have|get me)\b|\?\s*$/i
const LEAD_WORDS_RE = /\b(leads?|customers?|buyers?|investors?|people|enquir(y|ies)|follow[- ]?ups?)\b/i
/** Words that say something happened or should happen to a lead (so a property word in the message isn't a search). */
const ACTION_RE = /\b(called|call|spoke|met|meeting|visit(ed)?|see it|offer(ed)?|counter|seller|budget|send|share|forward|follow[- ]?up|try again|consent|agreed|whats ?app(ed)?|said|liked|wants|interested|bought|cancel|no[- ]?show|book)\b/i
const PROPERTY_WORDS_RE =/\b(propert(y|ies)|plots?|flats?|apartments?|villas?|houses?|shops?|offices?|listings?)\b/i

export function understand(text: string, ctx: Context): Reading {
  const s = text.trim()
  if (!s) return { kind: 'unknown' }
  const named = leadsNamed(s, ctx.leads)
  const onLead = ctx.leadId && !named.length ? ctx.leadId : undefined

  // a question: about leads, or about properties (answered on the Properties list)
  if (QUESTION_RE.test(s) && !named.length) {
    if (LEAD_WORDS_RE.test(s) || /\bready\b/i.test(s)) return { kind: 'findLeads', q: leadQuery(s) }
    if (PROPERTY_WORDS_RE.test(s)) return { kind: 'findProperties', text: s }
  }
  // a new lead or a new property
  if (/\b(new|add( a)?)\s+(lead|enquiry|customer|buyer)\b/i.test(s) || (phoneIn(s) && !named.length && !onLead && !/\bprop/i.test(s))) {
    return { kind: 'addLead', fields: newLead(s) }
  }
  if (/\b(new|add( a)?|list( a)?)\s+(property|plot|flat|apartment|villa|house|shop|office)\b|\bfor sale\b/i.test(s) && !named.length && !onLead) {
    return { kind: 'addProperty', text: s }
  }
  // a property search said as a phrase ("Plots in Madurai under 30 lakh"): property words, no lead named, nothing done
  if (PROPERTY_WORDS_RE.test(s) && !named.length && !ACTION_RE.test(s)) return { kind: 'findProperties', text: s }
  // something about a lead: named, or the one whose page you're on
  const actions = leadActions(s, ctx, named[0]?.id ?? onLead)
  if (actions.length) return { kind: 'lead', leadId: named.length === 1 || onLead ? (named[0]?.id ?? onLead) : undefined, candidates: named.map((l) => l.id), actions }
  if (PROPERTY_WORDS_RE.test(s) && !named.length) return { kind: 'findProperties', text: s }
  if (LEAD_WORDS_RE.test(s)) return { kind: 'findLeads', q: leadQuery(s) }
  return { kind: 'unknown' }
}

function leadQuery(s: string): LeadQuery {
  const q: LeadQuery = { cities: placesIn(s).cities }
  if (/\b(high[- ]priority|hot|very ready)\b/i.test(s)) q.readyMin = 80
  else if (/\bready\b/i.test(s)) q.readyMin = 60
  if (/\b(no|without( a)?|not booked( a)?|haven'?t (booked|visited))\s+(site\s+)?visits?\b|\bnot visited\b/i.test(s)) q.noVisit = true
  if (/\b(overdue|late|missed)\b/i.test(s)) q.overdue = true
  if (/\bdue today\b|\btoday'?s follow/i.test(s)) q.dueToday = true
  if (/\bno (next )?follow[- ]?up\b/i.test(s)) q.noFollowUp = true
  if (/\bnegotiat/i.test(s)) q.stage = 'negotiation'
  else if (/\bnew (leads|enquir)/i.test(s)) q.stage = 'new'
  else if (/\bqualified\b/i.test(s)) q.stage = 'qualified'
  if (/\binvestors?\b/i.test(s)) q.purpose = 'investment'
  else q.purpose = purposeIn(s)
  q.type = typeIn(s.replace(LEAD_WORDS_RE, ''))
  if (/^\s*how many\b/i.test(s)) q.count = true
  return q
}

/** Edit lead: what a message says about an existing lead's details (no name — edits rarely rename someone). */
export function readLeadDetails(text: string): NewLeadFields {
  const f = newLead(text)
  delete f.name
  delete f.consent // consent is recorded on the profile, with how and when
  return f
}

function newLead(s: string): NewLeadFields {
  const places = placesIn(s)
  const a = amounts(s)
  const one = a.length === 1 ? a[0] : undefined
  const f: NewLeadFields = {
    phone: phoneIn(s),
    email: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/.exec(s)?.[0],
    purpose: purposeIn(s),
    type: typeIn(s),
    bhk: /\b(\d)\s*bhk\b/i.exec(s) ? `${/\b(\d)\s*bhk\b/i.exec(s)![1]} BHK` : undefined,
    cities: places.cities,
    localities: places.localities,
    min: a.length >= 2 ? Math.min(a[0], a[1]) : undefined,
    max: a.length >= 2 ? Math.max(a[0], a[1]) : one,
    sizeSqft: Number(/(\d[\d,]*)\s*(sq\.?\s?ft|sqft|square feet)/i.exec(s)?.[1]?.replace(/,/g, '')) || undefined,
    contactPref: /\bwhats ?app\b/i.test(s) ? 'whatsapp' : /\bemail\b/i.test(s) ? 'email' : /\b(call|phone)\b/i.test(s) ? 'call' : undefined,
    source: SOURCE_WORDS.find(([re]) => re.test(s))?.[1],
    consent: CONSENT_RE.test(s) || undefined,
  }
  // the name: capitalised words after "lead"/"enquiry"/"customer", or at the start
  const m = /\b(?:lead|enquiry|customer|buyer)\s*[:,-]?\s*([A-Z][\p{L}.]*(?:\s+[A-Z][\p{L}.]*){0,3})/u.exec(s) ?? /^([A-Z][\p{L}.]*(?:\s+[A-Z][\p{L}.]*){0,2})\b/u.exec(s)
  if (m && !placesIn(m[1]).cities.length && !typeIn(m[1])) f.name = m[1].trim()
  return f
}

const LOST: [RegExp, LostReason][] = [
  [/\bbought (elsewhere|another|somewhere|from someone)\b/i, 'boughtElsewhere'],
  [/\bloan (was )?(rejected|not approved|declined)\b/i, 'loan'],
  [/\b(budget (is )?(too low|not enough)|can'?t afford)\b/i, 'budget'],
  [/\b(postponed?|not (buying|looking) (now|this year)|next year)\b/i, 'postponed'],
  [/\b(stopped responding|not responding|no response for)\b/i, 'notResponding'],
]

function leadActions(s: string, ctx: Context, leadId?: string): LeadAction[] {
  const lead = ctx.leads.find((l) => l.id === leadId)
  const props = ctx.db.properties.filter((p) => !p.archived)
  const out: LeadAction[] = []
  const prop = propertyNamed(s, props)
  const date = dateIn(s, ctx.today)
  const time = timeIn(s)

  // lost: one clear reason, and nothing else is done with it
  const lost = LOST.find(([re]) => re.test(s))
  if (lost) out.push({ kind: 'lost', reason: lost[1] })

  // what happened: a call, a WhatsApp, a meeting — logged as written
  const type = /\bwhats ?app(ed)?\b/i.test(s) && !/\bon whats ?app\b.*\bsend|send\b.*\bwhats ?app/i.test(s) ? 'whatsapp'
    : /\b(called|call(ed)? (him|her|them)|spoke|phoned|talked)\b/i.test(s) ? 'call'
      : /\b(met|meeting|came to (the )?office)\b/i.test(s) ? 'meeting' : undefined
  const noAnswer = /\b(no answer|didn'?t (pick|answer)|not reachable|switched off|no response|busy|did not answer)\b/i.test(s)
  if (type) out.push({ kind: 'log', type, text: s, responded: noAnswer ? false : /\b(said|liked|likes|wants|interested|agreed|asked|told|replied|confirmed|loved)\b/i.test(s) || undefined })

  // a visit that happened (only when one is booked): completed, no-show or cancelled
  const booked = lead?.visits.find((v) => v.status === 'scheduled')
  if (booked && /\b(didn'?t (come|turn up|show)|no[- ]?show|did not (come|turn up))\b/i.test(s)) out.push({ kind: 'outcome', status: 'noShow', feedback: s })
  else if (booked && /\b(cancel(l?ed)? the visit|visit (is |was )?cancel)/i.test(s)) out.push({ kind: 'outcome', status: 'cancelled', feedback: s })
  else if (booked && /\b(visit (went|was)|after the visit|visited (the )?(site|plot|flat|house|property)|saw the (site|plot|flat|house|property))\b/i.test(s)) {
    const interest = /\b(very interested|loved|keen|ready to book|wants to book)\b/i.test(s) ? 'high' : /\b(not interested|didn'?t like|not keen)\b/i.test(s) ? 'low' : 'medium'
    out.push({ kind: 'outcome', status: 'completed', interest, feedback: s })
  } else if (/\b(visit|see (it|the (plot|flat|house|site|property))|show (him|her|them)|site visit)\b/i.test(s) && (date || time) && !lost) {
    out.push({ kind: 'book', propertyId: prop?.id, date, time })
  }

  // budget: "budget can go to 32 L", "max 32 L", "budget 25–30 L"
  if (/\b(budget|can (go|stretch)|stretch|max(imum)?|up ?to)\b/i.test(s) && !/\boffer|counter|seller/i.test(s)) {
    const a = amounts(s.slice(s.search(/\b(budget|can (go|stretch)|stretch|max(imum)?|up ?to)\b/i)))
    if (a.length >= 2) out.push({ kind: 'budget', min: Math.min(a[0], a[1]), max: Math.max(a[0], a[1]) })
    else if (a.length === 1) out.push({ kind: 'budget', max: a[0] })
  }

  // an offer: "offered 1.28 Cr, seller wants 1.32" (a number without a unit takes the offer's unit)
  if (/\b(offer(ed)?|counter(ed)?|seller (wants|asks|is asking|said|came down)|asking)\b/i.test(s)) {
    const unit = /\b(cr|crores?|l|lakhs?|lacs?)\b/i.exec(s)?.[1] ?? 'l'
    const loose = (from: RegExp) => {
      const m = from.exec(s)
      if (!m) return undefined
      const rest = s.slice(m.index + m[0].length)
      const withUnit = amounts(rest)[0]
      const bare = /(\d+(?:\.\d+)?)/.exec(rest)
      if (!bare) return withUnit
      return withUnit ?? amounts(`${bare[1]} ${unit}`)[0]
    }
    const offered = loose(/\boffer(ed)?\b/i)
    const counter = loose(/\b(counter(ed)?|seller (wants|asks|is asking|said|came down to)|asking)\b/i)
    if (offered || counter) out.push({ kind: 'offer', propertyId: prop?.id ?? lead?.negotiation?.propertyId, offered, counter })
  }

  // the next follow-up: "try again tomorrow", "call back Friday", "follow up on 21 Nov"
  if (/\b(try again|call (him |her |them )?(back|again)|follow[- ]?up|remind me|check back|ping (him|her|them))\b/i.test(s) && date && !out.some((a) => a.kind === 'book')) {
    out.push({ kind: 'followUp', date })
  }

  // share a property: "send PROP-1003 on WhatsApp", "share the brochure"
  if (/\b(send|share|forward)\b/i.test(s) && prop) out.push({ kind: 'share', propertyId: prop.id, channel: /\bwhats ?app\b/i.test(s) ? 'whatsapp' : 'link' })

  // consent given: "she's OK with WhatsApp follow-ups"
  if (CONSENT_RE.test(s)) out.push({ kind: 'consent', how: /\bwhats ?app\b/i.test(s) ? 'whatsapp' : /\b(in person|met|office)\b/i.test(s) ? 'inPerson' : 'call' })

  // nothing specific but something was said about them: a note
  if (!out.length && leadId && s.split(/\s+/).length >= 3) out.push({ kind: 'log', type: 'note', text: s })
  return out
}
