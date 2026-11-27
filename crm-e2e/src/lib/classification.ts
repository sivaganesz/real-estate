/**
 * Customer classification (ported from wireframe-rebuild/src/lib/classification.ts): a suggestion a Sales manager may
 * override. Verified HNI → Potential HNI → High-value prospect (budget ₹1.5 Cr or more) → Investor (investment or
 * rental) → Qualified buyer (clear need and a property that fits) → General lead.
 * It is separate from the score, and a high budget alone never makes someone an HNI. HNI is shown only with
 * `lead.viewHni` (admins and managers); executives see "Restricted".
 */
import type { Classification, Lead, Property, Settings } from '@/domain/types'
import type { Tone } from './tones'
import { propertiesForLead } from './matching'

/** "High-value prospect" from this budget up: a suggestion only, never HNI. */
export const HIGH_VALUE_BUDGET = 15_000_000

export const CLASS_TONE: Record<Classification, Tone> = {
  general: 'neutral', qualifiedBuyer: 'info', investor: 'primary', highValue: 'warning', potentialHni: 'violet', verifiedHni: 'violet',
}

export const isHni = (c: Classification) => c === 'potentialHni' || c === 'verifiedHni'

export type ClassContext = { properties: Property[]; settings: Pick<Settings, 'matching'>; now: Date }

export function suggestedClassification(lead: Lead, ctx: ClassContext): Classification {
  if (lead.hni?.status === 'verified') return 'verifiedHni'
  if (lead.hni?.status === 'potential' || lead.hni?.status === 'consentInProgress') return 'potentialHni'
  if ((lead.requirement.budgetMax ?? 0) >= HIGH_VALUE_BUDGET) return 'highValue'
  if (lead.qualification.buyerPurpose === 'investment' || lead.qualification.buyerPurpose === 'rental') return 'investor'
  if (lead.qualification.need === 'clear' && propertiesForLead(lead, ctx.properties, ctx.settings, ctx.now, { limit: 1 }).length > 0) return 'qualifiedBuyer'
  return 'general'
}

export const classificationOf = (lead: Lead, ctx: ClassContext): Classification => lead.classification ?? suggestedClassification(lead, ctx)
