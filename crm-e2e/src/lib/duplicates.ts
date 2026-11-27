/**
 * Duplicate leads (foundation-plan §5.5): phones compare on their last 10 digits, so +91, spaces, dashes and a
 * leading 0 all match; emails compare case-insensitively.
 */
import type { DB, ID, Lead } from '@/domain/types'
import { last10 } from './phone'

export type Duplicate = { lead: Lead; by: 'phone' | 'email' }

export function findDuplicates(db: Pick<DB, 'leads'>, q: { phone?: string; altPhone?: string; email?: string; excludeId?: ID }): Duplicate[] {
  const phones = [q.phone, q.altPhone].map((p) => (p ? last10(p) : '')).filter((p) => p.length === 10)
  const email = q.email?.trim().toLowerCase()
  const out: Duplicate[] = []
  for (const lead of db.leads) {
    if (lead.id === q.excludeId) continue
    const theirs = [lead.phone, lead.altPhone].map((p) => (p ? last10(p) : '')).filter(Boolean)
    if (phones.some((p) => theirs.includes(p))) out.push({ lead, by: 'phone' })
    else if (email && lead.email?.toLowerCase() === email) out.push({ lead, by: 'email' })
  }
  return out
}
