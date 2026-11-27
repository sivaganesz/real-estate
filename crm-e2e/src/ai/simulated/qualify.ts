/**
 * Lead qualification help (master prompt §9): which of budget / decision maker / requirement / timeline are known,
 * what the notes and messages already say about the missing ones, and the short questions to ask next.
 */
import type { Activity, Lead, Qualification } from '@/domain/types'
import { qualificationCard } from '@/lib/qualification'
import type { QualificationResult } from '../types'
import { decisionIn, loanIn, purposeIn, timelineIn } from './parse'

/** Reads the lead's own notes and logged texts for qualification facts the record does not have yet. */
export function inferQualification(lead: Lead, activities: Activity[]): Partial<Qualification> {
  const texts = activities
    .filter((a) => a.refs.some((r) => r.kind === 'lead' && r.id === lead.id) && a.text)
    .map((a) => a.text ?? '')
  const all = texts.join('\n')
  if (!all.trim()) return {}
  const q = lead.qualification
  const out: Partial<Qualification> = {}
  const timeline = timelineIn(all)
  if (timeline && !q.timeline) out.timeline = timeline
  const decision = decisionIn(all)
  if (decision.makers.length && !q.decisionMakers.length) out.decisionMakers = decision.makers
  if (decision.authority && !q.authority) out.authority = decision.authority
  const loan = loanIn(all)
  if (loan && q.loan === 'unknown') out.loan = loan
  const purpose = purposeIn(all)
  if (purpose && !q.buyerPurpose) out.buyerPurpose = purpose
  return out
}

export function qualifyLeadSim(lead: Lead, activities: Activity[]): QualificationResult {
  const card = qualificationCard(lead)
  return {
    mode: 'simulated',
    known: card.known,
    missing: card.missing,
    inferred: inferQualification(lead, activities),
    questions: card.questions,
  }
}
