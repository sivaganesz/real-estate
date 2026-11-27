/**
 * What the user asks the global assistant (master prompt §12.5), detected with synonyms. Ported from
 * wireframe-rebuild/src/lib/ai/understand.ts and widened to every §12.5 request. The order matters: specific
 * phrasings before general ones.
 */
import type { PipelineStageKey } from '@/domain/types'
import { norm, phonesIn } from './parse'

export type IntentKey =
  | 'createLead' | 'createAppointment' | 'createTask' | 'assignLead' | 'moveStage' | 'findMatches' | 'todayTasks'
  | 'todayAppointments' | 'priorityLeads' | 'followUpLeads' | 'conversions' | 'performance' | 'teamPerformance'
  | 'summarizeLead' | 'propertySearch' | 'deleteProperty' | 'deleteLead' | 'manageUsers' | 'help' | 'unknown'

const RULES: [RegExp, IntentKey][] = [
  [/^(help|what can you do|\?)$/, 'help'],
  [/\b(delete|remove|erase)\b.*\b(propert(?:y|ies)|listings?|flats?|villas?|plots?|units?)\b/, 'deleteProperty'],
  [/\b(delete|remove|erase)\b.*\b(leads?|enquir(?:y|ies)|inquir(?:y|ies))\b/, 'deleteLead'],
  [/\b(deactivate|disable|activate|enable|add|create|invite)\b.*\b(users?|executives?|managers?|team members?)\b/, 'manageUsers'],
  [/\b(assign|reassign|hand ?over|transfer|give)\b.+\bto\b/, 'assignLead'],
  [/\b(move|mark|change|set|shift|update)\b.+\b(stage|as|to)\b.*\b(new|contacted|qualified|visit|negotiation|negotiating|booked|token|converted|closed|won|lost)\b/, 'moveStage'],
  [/\b(schedule|book|fix|arrange|set ?up|plan|organi[sz]e)\b.*\b(site ?visit|visit|meeting|appointment|video call|registration)\b/, 'createAppointment'],
  [/\b(site ?visit|meeting)\b.*\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(?:am|pm)|\d{1,2}:\d{2})\b/, 'createAppointment'],
  [/\b(remind me|reminder|follow[- ]?up with|create (?:a )?task|add (?:a )?task|todo|to-do|call back|callback)\b/, 'createTask'],
  [/\b(today'?s?|pending|my|open|due)\b.*\btasks?\b|\btasks?\b.*\b(today|pending|due)\b|what (?:should|do) i do today/, 'todayTasks'],
  [/\b(today'?s?)\b.*\b(appointments?|visits?|meetings?|schedule|calendar)\b|\b(appointments?|visits?)\b.*\btoday\b/, 'todayAppointments'],
  [/\b(highest|top|best|most important|hot(?:test)?|priority)\b.*\bleads?\b/, 'priorityLeads'],
  [/\bleads?\b.*\b(need(?:ing)?|require|due for|pending)\b.*\bfollow[- ]?ups?\b|\b(not contacted|no contact|haven'?t (?:called|contacted))\b/, 'followUpLeads'],
  [/\b(potential|likely|probable|near|close to)\b.*\b(conversions?|bookings?|closures?|to (?:book|convert|close))\b/, 'conversions'],
  [/\b(team'?s?|my team)\b.*\b(performance|doing|numbers|summary)\b/, 'teamPerformance'],
  [/\b(summari[sz]e|summary of|how am i doing|my performance|sales performance|my numbers)\b(?!.*\blead\b)/, 'performance'],
  [/\b(summari[sz]e|summary of|brief me on|tell me about)\b/, 'summarizeLead'],
  [/\b(match(?:ing|es)?|suitable|recommend(?:ed)?|options|properties)\b.*\bfor\b|\bwithin\b.*\bbudget\b/, 'findMatches'],
  [/\b(add|create|new|save|enter|capture|register)\b.*\b(lead|enquiry|inquiry|client|buyer|customer|prospect)\b/, 'createLead'],
]

export function detectIntent(text: string): IntentKey {
  const s = norm(text).toLowerCase()
  if (!s) return 'unknown'
  for (const [re, key] of RULES) if (re.test(s)) return key
  // a pasted enquiry (a phone number and a requirement) is a new lead
  if (phonesIn(text).length && /\b(bhk|flat|villa|plot|apartment|budget|looking for|interested|lakh|cr|crore)\b/.test(s)) return 'createLead'
  if (/\b(\d\s?bhk|flats?|villas?|plots?|apartments?|offices?|shops?|under \d|ready to move|facing)\b/.test(s)) return 'propertySearch'
  return 'unknown'
}

const STAGE_WORDS: [RegExp, PipelineStageKey][] = [
  [/\b(lost|dead|not interested|dropped)\b/, 'lost'],
  [/\b(converted|closed won|won|registered)\b/, 'converted'],
  [/\b(booked|token|booking)\b/, 'booked'],
  [/\b(negotiation|negotiating|offer)\b/, 'negotiation'],
  [/\b(visit done|visited|site visit done|after visit)\b/, 'siteVisitDone'],
  [/\b(visit scheduled|site visit scheduled|visit booked|visit)\b/, 'siteVisitScheduled'],
  [/\b(qualified)\b/, 'qualified'],
  [/\b(contacted)\b/, 'contacted'],
  [/\b(new)\b/, 'new'],
]
/** The stage named after "to" / "as" ("move Priya to negotiation", "mark Rahul as lost"). */
export function stageIn(text: string): PipelineStageKey | undefined {
  const s = norm(text).toLowerCase()
  const tail = /\b(?:to|as|into)\b(.*)$/.exec(s)?.[1] ?? s
  return STAGE_WORDS.find(([re]) => re.test(tail))?.[1]
}
