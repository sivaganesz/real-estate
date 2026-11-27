/**
 * What the user asks the global assistant (master prompt §12.5 + ROLE_RESEARCH §5 prompt chips), detected with
 * synonyms over English and (after hinglish.ts) Hinglish. Ported from wireframe-rebuild/src/lib/ai/understand.ts and
 * widened to every §12.5 request and every role chip. The order matters: specific phrasings before general ones
 * (e.g. "reassign Arjun's leads" before "assign X to Y", "reschedule … to tomorrow" before "move X to negotiation").
 * Pure; no React, no store.
 */
import type { LostReason, PipelineStageKey } from '@/domain/types'
import type { Period } from '@/services/queries/stats'
import { norm, phonesIn } from './parse'

export type IntentKey =
  // write intents (they end in a proposal the user confirms)
  | 'createLead' | 'createProperty' | 'updateLead' | 'createAppointment' | 'createTask' | 'reschedule' | 'completeTask' | 'assignLead'
  | 'bulkAssign' | 'reassignFrom' | 'requestReassign' | 'moveStage' | 'shareProperties' | 'shortlist' | 'draftMessage'
  // read intents (answers with links)
  | 'findMatches' | 'propertySearch' | 'todayTasks' | 'todayAppointments' | 'priorityLeads' | 'nextCall' | 'followUpLeads'
  | 'conversions' | 'performance' | 'teamPerformance' | 'targetLeft' | 'workload' | 'stalledDeals' | 'sourceConversion'
  | 'lostReasons' | 'unsoldInventory' | 'businessSummary' | 'duplicates' | 'summarizeLead' | 'importHelp'
  // refused or redirected
  | 'deleteProperty' | 'deleteLead' | 'manageUsers'
  | 'help' | 'unknown'

const WHEN = String.raw`(?:today|tonight|tomorrow|day after tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|next week|in \d+ days?|\d{1,2}(?:st|nd|rd|th)? (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\d{1,2}\s*(?:am|pm)|\d{1,2}:\d{2}|at \d{1,2}|morning|evening|afternoon|noon)`
const STAGE = String.raw`(?:new|contacted|qualified|visit scheduled|visit done|site visit done|visited|negotiation|negotiating|booked|token|converted|closed|won|lost|dead|dropped)`
const FOLLOW = String.raw`follow[- ]?ups?`

const RULES: [RegExp, IntentKey][] = [
  [/^(help|what can you do|what all can you do|commands|\?)\??$/, 'help'],
  // admin and destructive requests (refused or sent to the right page)
  [/\b(delete|remove|erase)\b.*\b(propert(?:y|ies)|listings?|flats?|villas?|plots?|units?)\b/, 'deleteProperty'],
  [/\b(delete|remove|erase)\b.*\b(leads?|enquir(?:y|ies)|inquir(?:y|ies))\b/, 'deleteLead'],
  [/\b(deactivate|disable|reactivate|offboard|suspend)\b/, 'manageUsers'],
  [/\b(activate|add|create|invite|onboard)\b.*\b(users?|executives?|managers?|team members?|sales ?person)\b/, 'manageUsers'],
  [/\b(import|upload|bulk ?add|bulk ?upload)\b.*\b(csv|excel|xlsx?|sheet|spreadsheet|file|list|leads|properties|inventory|data|brochure|pdf)\b|\bimport\b/, 'importHelp'],
  [/\b(duplicates?|dupes?|duplicate leads|same (?:phone|number|mobile))\b/, 'duplicates'],
  // a new listing ("add property 2.5BHK 1200 sqft east facing in Kondapur 85 L") before searches and assignment
  [/^(?:please |pls )?(?:add|create|list|post|save|enter|register|new)\s+(?:a |an |this |my |the |new )*(?:property|listing|resale (?:flat|property)|flat for sale|villa for sale|plot for sale)\b/, 'createProperty'],
  // assignment
  [/\b(request|ask (?:my |the )?manager|ask for)\b.*\b(reassign(?:ment)?|transfer|hand ?over)\b/, 'requestReassign'],
  [/\b(reassign|redistribute|transfer|move|shift|hand ?over|share out)\b.*\b(?:\w+'s|\w+s'|of \w+)\s*(?:open |active |all |pending |current )?leads\b|\b(reassign|redistribute)\b.*\bleads\b.*\b(on leave|leave|away|sick|left|resigned|deactivated)\b|\bredistribute\b/, 'reassignFrom'],
  [/\bauto[- ]?assign\b|\bassign\b.*\b(new|unassigned|all|pending|fresh|incoming|today'?s?)\b.*\bleads?\b|^assign (?:the )?leads?$|\bassign (?:the )?(?:new |unassigned )?leads?$/, 'bulkAssign'],
  [/\b(assign|reassign|hand ?over|transfer|give|allot|allocate|pass)\b.+(?:\bto\b|→|->|=>)/, 'assignLead'],
  // rescheduling before stage moves ("move Priya's visit to Saturday" is a reschedule, not a stage)
  [/\b(reschedule|postpone|prepone|re-?schedule)\b/, 'reschedule'],
  [new RegExp(String.raw`\b(move|shift|push|change|update)\b.*\b(${FOLLOW}|call|task|visit|site visit|meeting|appointment|reminder|callback)\b.*\b(?:to|till|until|for|by)\b.*\b${WHEN}`), 'reschedule'],
  [new RegExp(String.raw`\b(mark|set|tick)\b.*\b(task|call|${FOLLOW}|reminder)\b.*\b(done|complete|completed|finished|closed)\b|\bcomplete\b.*\b(task|${FOLLOW}|call)\b|\b(task|${FOLLOW}|call)\b.*\b(is )?(done|completed|finished)\b`), 'completeTask'],
  [new RegExp(String.raw`\b(move|mark|change|set|shift|update|put|push)\b.+\b(stage|as|to|into)\b.*\b${STAGE}\b`), 'moveStage'],
  [new RegExp(String.raw`\bmark\b.+\b${STAGE}\b`), 'moveStage'],
  // sharing and messages
  [/\bshortlist\b/, 'shortlist'],
  [/\b(share|send|forward|whatsapp)\b.*\b(propert(?:y|ies)|listings?|options|matches|brochure|prp[- ]?\d{4}|flat|villa|plot|apartment|project)\b/, 'shareProperties'],
  [/\b(draft|write|compose|prepare|craft|send|type)\b.*\b(message|msg|whatsapp|sms|text|e-?mail|mail|confirmation|reminder|greeting|reply|note to)\b|\bvisit confirmation\b|\b(confirmation|reminder) (?:message )?for\b/, 'draftMessage'],
  [/^(?:please )?(share|forward)\b.+\b(with|to)\b/, 'shareProperties'],
  // appointments and follow-ups
  [/\b(schedule|book|fix|arrange|set ?up|plan|organi[sz]e|add|create|confirm)\b.*\b(site ?visit|visit|meeting|appointment|video call|registration|zoom|office visit)\b/, 'createAppointment'],
  [new RegExp(String.raw`\b(site ?visit|meeting|video call)\b.*\b${WHEN}`), 'createAppointment'],
  [new RegExp(String.raw`\b(remind me|reminder|${FOLLOW} with|${FOLLOW} for|create (?:a )?task|add (?:a )?task|new task|todo|to-do|call back|callback|schedule (?:a )?${FOLLOW}|set (?:a )?${FOLLOW}|add (?:a )?${FOLLOW}|plan (?:a )?${FOLLOW})\b`), 'createTask'],
  // a contact that happened, or a change to a lead's details
  [/^(?:i |just )?(called|spoke|talked|whatsapped|messaged|met|emailed|phoned|rang)\b|\b(called|spoke (?:to|with)|talked (?:to|with)|whatsapped|messaged|phoned|met with)\b \w+|\b(no answer|didn'?t pick|did not pick|not reachable|switched off|not picking)\b/, 'updateLead'],
  [/\b(update|change|set|edit|increase|reduce|revise|raise|lower|correct)\b.*\b(budget|phone|number|mobile|e-?mail|timeline|requirement|bhk|configuration|location|area|locality|source|name|decision|loan)\b|\b\w+'s (budget|phone|number|timeline|requirement)\b.*\b(is|to|now)\b|\b(now wants|budget (?:is )?now|can (?:go|stretch)|increased (?:the |his |her |their )?budget|wants? (?:a )?\d\s?bhk now)\b|\badd (?:a )?note\b|\bnote (?:for|on|to)\b/, 'updateLead'],
  // questions
  [/\bwho\b.*\b(call|contact|ring|phone|follow up)\b.*\b(next|first|now|today)\b|\bnext (?:call|lead to call|best call)\b|\bwhom (?:should|do) i call\b|\bwho should i (?:call|contact)\b/, 'nextCall'],
  [/\b(targets?|quota)\b/, 'targetLeft'],
  [/\b(overloaded|over ?loaded|workload|work load|busiest|capacity|bandwidth|who has (?:the )?most leads|load balance)\b/, 'workload'],
  [/\b(stalled|stuck|stale|aging|ageing|not moving)\b/, 'stalledDeals'],
  [/\b(sources?|channels?|portals?|campaigns?)\b.*\b(convert|conversion|best|performing|works?|working|quality|roi)\b|\bwhich (?:source|channel|portal)\b|\bbest source\b/, 'sourceConversion'],
  [/\b(lost|lose|losing|drop(?:ped)?)\b.*\b(budget|reasons?|why|how many|location|loan|elsewhere|not responding|mismatch)\b|\bwhy (?:are |did )?we (?:lose|losing|lost)\b|\blost reasons?\b/, 'lostReasons'],
  [/\b(unsold|inventory|available units|stock|unsold units|most units)\b/, 'unsoldInventory'],
  [/\bbusiness (?:summary|overview|snapshot|update|report|today)\b|\bhow is (?:the )?business\b|\bcompany (?:summary|overview)\b/, 'businessSummary'],
  [/\b(today'?s?|pending|my|open|due|overdue)\b.*\btasks?\b|\btasks?\b.*\b(today|pending|due|overdue)\b|what (?:should|do) i do today|\bmy day\b|\bplan my day\b|\bwhat'?s on my plate\b|\bto ?do list\b/, 'todayTasks'],
  [/\b(today'?s?)\b.*\b(appointments?|visits?|meetings?|schedule|calendar)\b|\b(appointments?|visits?|meetings?)\b.*\btoday\b|\bsummari[sz]e (?:my )?(?:appointments|visits|schedule)\b/, 'todayAppointments'],
  [/\b(potential|likely|probable|near|close to|closest to|ready to)\b.*\b(conversions?|bookings?|closures?|book|convert|close)\b|\bwho (?:will|might|may) (?:book|convert|close)\b/, 'conversions'],
  [/\b(team'?s?|my team|our team|executives'?)\b.*\b(performance|doing|numbers|summary|stats|report|progress)\b|\bteam performance\b|\bhow is (?:my|the) team\b/, 'teamPerformance'],
  [/\b(how am i doing|my performance|sales performance|my numbers|my stats|my progress|my month|my week|performance summary)\b|\bsummari[sz]e (?:my )?(?:sales|performance|month|week)\b/, 'performance'],
  [new RegExp(String.raw`\bleads?\b.*\b(need(?:ing)?|require|due for|pending|without)\b.*\b${FOLLOW}\b|\b(not contacted|no contact|haven'?t (?:called|contacted)|untouched|not called|no response|silent)\b|\b${FOLLOW}s? (?:due|pending|needed)\b`), 'followUpLeads'],
  [/\b(highest|top|best|most important|hot(?:test)?|priority|urgent|important)\b.*\b(leads?|clients?|buyers?|prospects?)\b/, 'priorityLeads'],
  [/\b(summari[sz]e|summary of|brief me|tell me about|recap|overview of|background on|history of)\b|\bbefore my call\b|\bwho is\b/, 'summarizeLead'],
  [/\bwithin\b.*\bbudget\b|\b(match(?:ing|es)?|suitable|recommend(?:ed|ations)?|options|propert(?:y|ies)|units)\b.*\bfor\b|\bmatch\b|\b(buyers?|leads?|clients?) (?:for|who (?:fit|want|match))\b.*\b(propert(?:y|ies)|listing|unit|flat|villa|plot|this)\b/, 'findMatches'],
  [/\b(add|create|new|save|enter|capture|register|log)\b.*\b(lead|enquiry|inquiry|client|buyer|customer|prospect)\b|\bfrom this (?:whatsapp )?message\b/, 'createLead'],
]

export function detectIntent(text: string): IntentKey {
  const s = norm(text).toLowerCase()
  if (!s) return 'unknown'
  for (const [re, key] of RULES) if (re.test(s)) return key
  // a pasted enquiry (a phone number and a requirement) is a new lead
  if (phonesIn(text).length && /\b(bhk|flat|villa|plot|apartment|budget|looking for|interested|lakh|cr|crore|wants|house)\b/.test(s)) return 'createLead'
  if (/\b(\d(?:\.5)?\s?bhk|1rk|flats?|villas?|plots?|apartments?|offices?|shops?|under \d|ready to move|facing|propert(?:y|ies))\b/.test(s)) return 'propertySearch'
  return 'unknown'
}

const STAGE_WORDS: [RegExp, PipelineStageKey][] = [
  [/\b(lost|dead|not interested|dropped|drop)\b/, 'lost'],
  [/\b(converted|closed won|won|registered|closed)\b/, 'converted'],
  [/\b(booked|token|booking)\b/, 'booked'],
  [/\b(negotiation|negotiating|negotiate|offer)\b/, 'negotiation'],
  [/\b(visit done|visited|site visit done|after visit)\b/, 'siteVisitDone'],
  [/\b(visit scheduled|site visit scheduled|visit booked|visit)\b/, 'siteVisitScheduled'],
  [/\b(qualified)\b/, 'qualified'],
  [/\b(contacted)\b/, 'contacted'],
  [/\b(new)\b/, 'new'],
]
/** The stage named after "to" / "as" ("move Priya to negotiation", "mark Rahul as lost"). */
export function stageIn(text: string): PipelineStageKey | undefined {
  const s = norm(text).toLowerCase()
  const tail = /\b(?:to|as|into|in)\b(.*)$/.exec(s)?.[1] ?? s
  return STAGE_WORDS.find(([re]) => re.test(tail))?.[1] ?? (/\bmark\b/.test(s) ? STAGE_WORDS.find(([re]) => re.test(s))?.[1] : undefined)
}

const LOST_WORDS: [RegExp, LostReason][] = [
  [/\b(budget|expensive|costly|price|afford|too high)\b/, 'budgetMismatch'],
  [/\b(bought|elsewhere|another|other builder|competitor|purchased)\b/, 'boughtElsewhere'],
  [/\b(not respond|no response|unreachable|not reachable|not responding|ghost|stopped responding)\b/, 'notResponding'],
  [/\b(location|far|commute|area)\b/, 'location'],
  [/\b(loan)\b/, 'loanRejected'],
]
/** A lost reason named in the text ("lost to budget mismatch", "bought elsewhere"), if any. */
export function lostReasonIn(text: string): LostReason | undefined {
  const s = norm(text).toLowerCase()
  return LOST_WORDS.find(([re]) => re.test(s))?.[1]
}

/** The period a question is about: "this week", "this month", "today", "this quarter". */
export function periodIn(text: string, fallback: Period = 'month'): Period {
  const s = norm(text).toLowerCase()
  if (/\b(today|so far today|this morning)\b/.test(s)) return 'today'
  if (/\b(this week|weekly|past week|last 7 days|week)\b/.test(s)) return 'week'
  if (/\b(quarter|qtr|last 3 months)\b/.test(s)) return 'quarter'
  if (/\b(half|6 months|six months)\b/.test(s)) return 'half'
  if (/\b(month|monthly|mtd)\b/.test(s)) return 'month'
  return fallback
}

/** A day count in the question: "no contact in 5 days", "stalled over 10 days", "for 2 weeks". */
export function daysIn(text: string): number | undefined {
  const s = norm(text).toLowerCase()
  const d = /\b(\d{1,3})\s*\+?\s*days?\b/.exec(s)
  if (d) return Number(d[1])
  const w = /\b(\d{1,2}|a|one|two|three)\s*weeks?\b/.exec(s)
  if (w) return ({ a: 1, one: 1, two: 2, three: 3 }[w[1]] ?? Number(w[1])) * 7
  return undefined
}
