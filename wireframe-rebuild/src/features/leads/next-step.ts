/**
 * The lead page's "Next step": what is due, and ✨ a suggestion of what to do.
 * In the product one AI call writes the suggestion from the lead's record; the wireframe uses simple rules over the same facts
 * (stage, booked or past visits, the negotiation, matches, last contact), so the screen won't change when the AI arrives.
 * Suggestions hold an i18n key and values, never a finished sentence.
 */
import type { Database, Lead, SiteVisit } from '@/data/types'
import { daysBetween, inrShort } from '@/lib/format'
import { propertiesForLead } from '@/lib/matching'
import { isActive } from './lead-list'

export type Due = { kind: 'overdue' | 'today' | 'later' | 'none'; date?: string; days?: number }
export type Suggestion = { key: string; values?: Record<string, string | number>; propertyId?: string }

export function dueOf(l: Lead, today: string): Due {
  if (!l.nextFollowUp) return { kind: 'none' }
  const d = daysBetween(today, l.nextFollowUp)
  return d < 0 ? { kind: 'overdue', date: l.nextFollowUp, days: -d } : d === 0 ? { kind: 'today', date: l.nextFollowUp } : { kind: 'later', date: l.nextFollowUp, days: d }
}

/** A booked visit whose day has passed still needs its outcome (completed, no-show or cancelled). */
export const needsOutcome = (v: SiteVisit, today: string) => v.status === 'scheduled' && v.date < today

export function suggestNext(l: Lead, db: Database, today: string): Suggestion | null {
  if (!isActive(l)) return null
  const title = (id: string) => db.properties.find((p) => p.id === id)?.title ?? id
  const pending = l.visits.filter((v) => needsOutcome(v, today)).sort((a, b) => a.date.localeCompare(b.date))[0]
  if (pending) return { key: 'next.recordOutcome', values: { property: title(pending.propertyId), date: pending.date }, propertyId: pending.propertyId }
  const booked = l.visits.filter((v) => v.status === 'scheduled' && v.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
  if (booked) {
    const loan = l.qualification.funding !== 'own' && l.qualification.fundingReady === 'ready'
    return { key: loan ? 'next.visitLoan' : 'next.visit', values: { property: title(booked.propertyId), date: booked.date, time: booked.time ?? '' }, propertyId: booked.propertyId }
  }
  if (l.negotiation) {
    const n = l.negotiation
    if (n.offered && n.counter) return { key: 'next.negotiation', values: { offer: inrShort(n.offered), counter: inrShort(n.counter), gap: inrShort(n.counter - n.offered) }, propertyId: n.propertyId }
    return { key: 'next.negotiationOpen', values: { property: title(n.propertyId) }, propertyId: n.propertyId }
  }
  const visited = l.visits.filter((v) => v.status === 'completed').sort((a, b) => b.date.localeCompare(a.date))[0]
  if (visited && l.stage === 'visitScheduled') return { key: 'next.afterVisit', values: { property: title(visited.propertyId) }, propertyId: visited.propertyId }
  if (l.stage === 'new') return { key: 'next.firstCall' }
  const fits = propertiesForLead(l, db.properties.filter((p) => p.status === 'available' && !p.archived), db.settings)
  const notYet = fits.find((m) => !l.recommendedPropertyIds.includes(m.property.id) && m.label !== 'conditional')
  if (l.recommendedPropertyIds.length && !l.visits.some((v) => v.status === 'scheduled')) {
    const id = l.recommendedPropertyIds[l.recommendedPropertyIds.length - 1]
    return { key: 'next.bookVisit', values: { property: title(id) }, propertyId: id }
  }
  if (notYet) return { key: 'next.recommend', values: { property: notYet.property.title, score: notYet.score }, propertyId: notYet.property.id }
  const last = l.activity[0]?.at
  if (last) return { key: 'next.checkIn', values: { days: daysBetween(last, today) } }
  return { key: 'next.firstCall' }
}
