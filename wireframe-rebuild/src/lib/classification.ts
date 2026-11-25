/**
 * Customer classification (spec-system-wireframe logic.js → suggestedClassification): a suggestion a Sales manager may override.
 * Verified HNI → Potential HNI → High-value prospect (budget ₹1.5 Cr or more) → Investor (investment or rental income)
 * → Qualified buyer (clear need and a property that fits) → General lead.
 * It is kept separate from the "ready to buy" score, and a high budget alone never makes someone an HNI.
 */
import type { Tone } from '@/components/app/tone'
import type { Classification, Database, Lead } from '@/data/types'
import { propertiesForLead } from './matching'

/** "High-value prospect" from this budget up — a suggestion only, never HNI. */
export const HIGH_VALUE_BUDGET = 15_000_000

export const CLASSIFICATIONS: Classification[] = ['general', 'qualifiedBuyer', 'investor', 'highValue', 'potentialHni', 'verifiedHni']
export const CLASS_TONE: Record<Classification, Tone> = {
  general: 'neutral', qualifiedBuyer: 'info', investor: 'primary', highValue: 'warning', potentialHni: 'violet', verifiedHni: 'violet',
}

/** HNI classifications are shown to Admins and Sales managers only; executives see "Restricted". */
export const isHni = (c: Classification) => c === 'potentialHni' || c === 'verifiedHni'

export function suggestedClassification(lead: Lead, db: Database): Classification {
  if (lead.hni?.status === 'verified') return 'verifiedHni'
  if (lead.hni?.potential) return 'potentialHni'
  if (lead.budget.max >= HIGH_VALUE_BUDGET) return 'highValue'
  if (lead.purpose === 'investment' || lead.purpose === 'rentalIncome') return 'investor'
  const fits = propertiesForLead(lead, db.properties.filter((p) => !p.archived), db.settings)
  if (lead.qualification.need === 'clear' && fits.length > 0) return 'qualifiedBuyer'
  return 'general'
}

export const classificationOf = (lead: Lead, db: Database): Classification => lead.classification ?? suggestedClassification(lead, db)
