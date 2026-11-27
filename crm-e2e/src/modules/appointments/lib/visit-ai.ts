/**
 * The appointment assistant's rules (master prompt §16 "AI: preparation points before a visit, meeting summary after,
 * scheduling suggestions"; §12 "after completion the AI suggests the next follow-up and pipeline stage").
 * Pure and rule-based (the simulated AI): every point is an i18n key (`appointments:ai.*`) plus params, so the text
 * follows the UI language while names and numbers come from the data. The UI always shows the Demo AI badge with these.
 */
import type { Appointment, Lead, PipelineStageKey, Property, Task, VisitOutcome } from '@/domain/types'
import { STAGE_RANK } from '@/domain/catalogue'
import { daysSince, localAt, minutesBetween } from '@/lib/dates'
import { firstName, inrShort } from '@/lib/format'

export type AIPoint = { key: string; params?: Record<string, string | number>; tone: 'tip' | 'warn' | 'good' }

const pct = (n: number) => Math.round(n * 100)

/**
 * Preparation points before a visit or meeting: budget fit, what to show, who should come, loan, objections from
 * earlier visits, timing. At most `limit` points, warnings first.
 */
export function prepPoints(input: {
  appointment: Pick<Appointment, 'id' | 'type' | 'status' | 'start' | 'propertyIds' | 'notes'>
  lead?: Lead
  properties: Property[]
  history: Pick<Appointment, 'id' | 'leadId' | 'status' | 'outcome' | 'start'>[]
  now: Date
  limit?: number
}): AIPoint[] {
  const { appointment: a, lead, properties, history, now, limit = 6 } = input
  const out: AIPoint[] = []
  const props = a.propertyIds.map((id) => properties.find((p) => p.id === id)).filter((p): p is Property => !!p)
  const mins = minutesBetween(now, a.start)

  if (a.status === 'scheduled' && mins > 0 && mins <= 26 * 60) out.push({ key: 'prep.confirm', tone: 'warn' })
  if (!lead) {
    out.push({ key: 'prep.noLead', tone: 'warn' })
    return out.slice(0, limit)
  }
  const r = lead.requirement
  const q = lead.qualification
  const first = firstName(lead.name)

  for (const p of props) {
    if (p.status === 'booked' || p.status === 'sold') out.push({ key: 'prep.unavailable', params: { property: p.title }, tone: 'warn' })
    if (r.budgetMax && p.price) {
      const over = p.price / r.budgetMax - 1
      if (over > 0.02) out.push({ key: 'prep.overBudget', params: { property: p.title, pct: pct(over), budget: inrShort(r.budgetMax) }, tone: 'warn' })
      else out.push({ key: 'prep.inBudget', params: { property: p.title, price: inrShort(p.price) }, tone: 'good' })
    }
    if (r.possession === 'ready' && p.possession.status === 'underConstruction') out.push({ key: 'prep.possession', params: { property: p.title }, tone: 'warn' })
    if (r.vastu && p.vastuCompliant) out.push({ key: 'prep.vastu', params: { property: p.title }, tone: 'tip' })
    if (r.facing.length && p.facing && r.facing.includes(p.facing)) out.push({ key: 'prep.facing', params: { facing: p.facing }, tone: 'good' })
  }

  if (r.mustHaves.length) out.push({ key: 'prep.mustHaves', params: { list: r.mustHaves.slice(0, 3).join(', ') }, tone: 'tip' })

  const others = q.decisionMakers.filter((d) => d !== 'self')
  if (q.authority === 'needsApproval' || q.authority === 'joint' || others.length) {
    out.push({ key: 'prep.decisionMakers', params: { name: first, who: others[0] ?? 'family' }, tone: 'tip' })
  }
  if (q.loan === 'needed') out.push({ key: 'prep.loan', params: { banks: props.flatMap((p) => p.bankApprovals).filter((b, i, arr) => arr.indexOf(b) === i).slice(0, 3).join(', ') || '—' }, tone: 'tip' })
  if (q.loan === 'preApproved') out.push({ key: 'prep.loanReady', tone: 'good' })

  const past = history.filter((h) => h.id !== a.id && h.leadId === lead.id && h.status === 'completed' && h.outcome)
  const objections = past.map((h) => h.outcome?.objections).filter((o): o is string => !!o?.trim())
  if (past.length) out.push({ key: 'prep.revisit', params: { count: past.length }, tone: 'tip' })
  if (objections.length) out.push({ key: 'prep.objections', params: { text: objections[objections.length - 1] }, tone: 'warn' })
  if (history.some((h) => h.leadId === lead.id && h.status === 'noShow')) out.push({ key: 'prep.pastNoShow', tone: 'warn' })

  if (q.timeline === 'immediate') out.push({ key: 'prep.urgent', params: { name: first }, tone: 'tip' })
  if (lead.lastContactAt) {
    const d = daysSince(lead.lastContactAt, now)
    if (d >= 5) out.push({ key: 'prep.longSilence', params: { days: d }, tone: 'warn' })
  }
  if (a.type === 'siteVisit' && lead.isNri) out.push({ key: 'prep.nri', tone: 'tip' })
  if (a.type === 'siteVisit' && !out.some((p) => p.tone === 'tip')) out.push({ key: 'prep.generic', tone: 'tip' })

  const order = { warn: 0, tip: 1, good: 2 }
  return out.sort((x, y) => order[x.tone] - order[y.tone]).slice(0, limit)
}

export type OutcomeDraft = Pick<VisitOutcome, 'result' | 'interest' | 'likedPropertyIds' | 'objections' | 'decisionMakerPresent' | 'nextStep'>

export type AfterSuggestion = {
  /** When to follow up (local working hours). */
  followUpAt: string
  /** The suggested stage, or undefined when the current stage should stay. */
  stage?: PipelineStageKey
  reasonKey: string
  params?: Record<string, string | number>
  /** A suggested next-step line (i18n key). */
  nextStepKey: string
}

/** A time `hours` from now, moved into working hours (10:00–19:00): too late → 10:30 next morning. */
function soon(now: Date, hours: number): string {
  const t = new Date(now.getTime() + hours * 3_600_000)
  const sameDay = t.toDateString() === now.toDateString()
  if (!sameDay || t.getHours() >= 19) return localAt(now, 1, '10:30')
  if (t.getHours() < 10) return localAt(now, 0, '10:30')
  t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15, 0, 0)
  return t.toISOString()
}

/**
 * After the outcome is captured: when to follow up and which stage the lead should be in. Never moves a lead
 * backwards and never suggests Booked / Lost (those need the stage dialog's details), so applying it is always safe.
 */
export function suggestAfterOutcome(input: { outcome: OutcomeDraft; type: Appointment['type']; stage: PipelineStageKey; now: Date }): AfterSuggestion {
  const { outcome: o, type, stage, now } = input
  const visit = type === 'siteVisit'
  let s: AfterSuggestion
  if (o.result === 'readyToBook') {
    s = { followUpAt: soon(now, 2), stage: 'negotiation', reasonKey: 'after.readyToBook', nextStepKey: 'next.bookingForm' }
  } else if (o.result === 'interested') {
    const strong = o.interest === 'high' && (o.likedPropertyIds?.length ?? 0) > 0
    s = strong
      ? { followUpAt: localAt(now, 1, '11:00'), stage: o.decisionMakerPresent === false ? (visit ? 'siteVisitDone' : undefined) : 'negotiation', reasonKey: o.decisionMakerPresent === false ? 'after.interestedNoDm' : 'after.interestedHigh', nextStepKey: o.decisionMakerPresent === false ? 'next.revisitFamily' : 'next.costSheet' }
      : { followUpAt: localAt(now, 2, '11:00'), stage: visit ? 'siteVisitDone' : undefined, reasonKey: 'after.interested', nextStepKey: 'next.shareOptions' }
  } else if (o.result === 'thinking') {
    s = { followUpAt: localAt(now, 3, '11:00'), stage: visit ? 'siteVisitDone' : undefined, reasonKey: o.decisionMakerPresent === false ? 'after.thinkingNoDm' : 'after.thinking', nextStepKey: o.decisionMakerPresent === false ? 'next.revisitFamily' : 'next.answerObjections' }
  } else {
    s = { followUpAt: localAt(now, 7, '11:00'), stage: visit ? 'siteVisitDone' : undefined, reasonKey: 'after.notInterested', nextStepKey: 'next.alternatives' }
  }
  if (s.stage && (STAGE_RANK[s.stage] <= STAGE_RANK[stage] || stage === 'lost' || stage === 'converted')) s.stage = undefined
  return s
}

/** The meeting summary after a completed appointment: one headline and the facts, as i18n keys. */
export function summaryPoints(input: { outcome: VisitOutcome; properties: Property[]; leadName?: string; durationMin: number; type: Appointment['type'] }): { headline: AIPoint; points: AIPoint[] } {
  const { outcome: o, properties, leadName, type } = input
  const name = leadName ? firstName(leadName) : ''
  const liked = o.likedPropertyIds.map((id) => properties.find((p) => p.id === id)?.title).filter((x): x is string => !!x)
  const headline: AIPoint = { key: `summary.headline.${o.result}`, params: { name, type }, tone: o.result === 'notInterested' ? 'warn' : 'good' }
  const points: AIPoint[] = []
  if (o.interest) points.push({ key: 'summary.interest', params: { level: o.interest }, tone: o.interest === 'high' ? 'good' : 'tip' })
  if (liked.length) points.push({ key: 'summary.liked', params: { list: liked.join(', '), count: liked.length }, tone: 'good' })
  if (o.objections?.trim()) points.push({ key: 'summary.objections', params: { text: o.objections.trim().replace(/[.!]+$/, '') }, tone: 'warn' })
  if (o.decisionMakerPresent === true) points.push({ key: 'summary.dmPresent', tone: 'good' })
  if (o.decisionMakerPresent === false) points.push({ key: 'summary.dmAbsent', tone: 'warn' })
  if (o.nextStep?.trim()) points.push({ key: 'summary.nextStep', params: { text: o.nextStep.trim().replace(/[.!]+$/, '') }, tone: 'tip' })
  if (o.nextFollowUpAt) points.push({ key: 'summary.followUp', params: { at: o.nextFollowUpAt }, tone: 'tip' })
  return { headline, points }
}

/** A plain-text summary for the notes / sharing with the manager (English data text, like the message templates). */
export function summaryText(o: OutcomeDraft, liked: string[], leadName?: string): string {
  const who = leadName ? firstName(leadName) : 'Client'
  const parts = [
    `${who}: ${({ interested: 'interested', thinking: 'thinking it over', notInterested: 'not interested', readyToBook: 'ready to book' } as const)[o.result]}${o.interest ? ` (${o.interest} interest)` : ''}.`,
    liked.length ? `Liked ${liked.join(', ')}.` : '',
    o.objections?.trim() ? `Concerns: ${o.objections.trim()}.` : '',
    o.decisionMakerPresent === false ? 'Decision maker was not present.' : o.decisionMakerPresent ? 'Decision maker was present.' : '',
    o.nextStep?.trim() ? `Next: ${o.nextStep.trim()}.` : '',
  ]
  return parts.filter(Boolean).join(' ').replace(/\.\./g, '.')
}

/** Open follow-ups the completion will leave behind (shown in the outcome dialog so nothing is created twice). */
export const openTasksFor = (tasks: Task[], leadId: string | undefined) =>
  leadId ? tasks.filter((t) => t.leadId === leadId && t.status === 'open') : []

/**
 * Paste-and-fill for the outcome form: reads a free-text note ("They loved the 9th floor unit, wife wants a bigger
 * kitchen, will decide by Sunday") into result, interest, liked properties, objections, decision maker and next step.
 * Returns only what it found, with a confidence per field, so the form marks just those fields as AI-filled.
 */
export function readOutcomeNotes(text: string, properties: Pick<Property, 'id' | 'title' | 'projectName'>[]): { fields: Partial<OutcomeDraft>; confidence: Partial<Record<keyof OutcomeDraft, number>> } {
  const raw = text.replace(/\s+/g, ' ').trim()
  const s = raw.toLowerCase()
  const fields: Partial<OutcomeDraft> = {}
  const confidence: Partial<Record<keyof OutcomeDraft, number>> = {}
  if (!s) return { fields, confidence }

  if (/\b(ready to book|wants? to book|book(ing)? (it|now|the unit)|pay(ing)? (the )?token|token amount|block(ing)? the unit)\b/.test(s)) { fields.result = 'readyToBook'; confidence.result = 0.9 }
  else if (/\b(not interested|didn'?t like|did not like|rejected|no interest|not for (them|him|her)|not suitable)\b/.test(s)) { fields.result = 'notInterested'; confidence.result = 0.85 }
  else if (/\b(think(ing)? (about it|it over)|will (decide|think|discuss|get back|confirm)|discuss with|need(s)? time|get back)\b/.test(s)) { fields.result = 'thinking'; confidence.result = 0.8 }
  else if (/\b(liked|loved|interested|keen|happy with|impressed)\b/.test(s)) { fields.result = 'interested'; confidence.result = 0.8 }

  if (/\b(loved|very (keen|interested|happy)|really liked|excited|ready to book)\b/.test(s)) { fields.interest = 'high'; confidence.interest = 0.8 }
  else if (/\b(lukewarm|not very|somewhat|so-so|maybe)\b/.test(s)) { fields.interest = 'low'; confidence.interest = 0.7 }
  else if (fields.result === 'interested' || fields.result === 'thinking') { fields.interest = 'medium'; confidence.interest = 0.6 }
  else if (fields.result === 'notInterested') { fields.interest = 'low'; confidence.interest = 0.75 }

  const liked = properties.filter((p) => {
    const names = [p.title, p.projectName].filter((x): x is string => !!x).map((x) => x.toLowerCase())
    return names.some((n) => s.includes(n) || s.includes(n.split(' ').slice(0, 2).join(' ')))
  })
  if (liked.length && fields.result !== 'notInterested') { fields.likedPropertyIds = liked.map((p) => p.id); confidence.likedPropertyIds = 0.75 }
  else if (properties.length === 1 && (fields.result === 'interested' || fields.result === 'readyToBook')) { fields.likedPropertyIds = [properties[0].id]; confidence.likedPropertyIds = 0.65 }

  const who = '(wife|husband|spouse|parents|father|mother|dad|mom|family|partner|son|daughter|in-laws)'
  const absent = new RegExp(String.raw`\b${who} (was not|wasn'?t|were not|weren'?t|did not|didn'?t|could not|couldn'?t) (there|come|join|present)|\bcame alone\b|\bwithout (his|her|their) ${who}`)
  const present = new RegExp(String.raw`\b(with|and) (his|her|their)? ?${who}\b|\b${who} (came|was there|joined|were there|also came|liked|loved)`)
  if (absent.test(s)) { fields.decisionMakerPresent = false; confidence.decisionMakerPresent = 0.8 }
  else if (present.test(s)) { fields.decisionMakerPresent = true; confidence.decisionMakerPresent = 0.7 }

  const sentences = raw.split(/(?<=[.!?;])\s+|\s*,\s*(?=but\b)|\s+but\s+/i).map((x) => x.trim()).filter(Boolean)
  const concern = sentences.filter((x) => /\b(concern|worried|expensive|costly|price|too (small|far|high|big)|small|far|traffic|noise|kitchen|parking|maintenance|possession|delay|loan|vastu|facing|wants? a bigger|bigger)\b/i.test(x) && !/\b(will|next|call|revisit)\b/i.test(x))
  if (concern.length) { fields.objections = concern.join('; ').replace(/[.;]+$/, ''); confidence.objections = 0.7 }
  const next = sentences.find((x) => /\b(will|next|call (back|on)|revisit|send|share|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|tomorrow))\b/i.test(x))
  if (next) { fields.nextStep = next.replace(/[.;]+$/, ''); confidence.nextStep = 0.65 }
  return { fields, confidence }
}
