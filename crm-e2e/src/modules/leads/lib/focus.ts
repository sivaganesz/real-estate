/**
 * The "Today design" grouping of the Leads list (ported from wireframe-rebuild/src/features/leads/leads-today.tsx):
 * who to call now. First match wins, so each lead shows once: overdue follow-ups · not called yet · due today ·
 * hot without a site visit · no follow-up planned · coming up. Closed leads never appear.
 */
import { attentionOf, inTab, type LeadItem } from '@/lib/lead-queries'

export type FocusGroup = 'overdue' | 'uncontacted' | 'dueToday' | 'hotNoVisit' | 'noFollowUp' | 'upcoming'
export const FOCUS_GROUPS: FocusGroup[] = ['overdue', 'uncontacted', 'dueToday', 'hotNoVisit', 'noFollowUp', 'upcoming']

export function groupFocus<T extends LeadItem>(rows: T[], now: Date): Record<FocusGroup, T[]> {
  const out = Object.fromEntries(FOCUS_GROUPS.map((g) => [g, [] as T[]])) as Record<FocusGroup, T[]>
  for (const r of rows) {
    const attn = attentionOf(r, now)
    if (attn.includes('overdue')) out.overdue.push(r)
    else if (attn.includes('uncontacted')) out.uncontacted.push(r)
    else if (inTab(r, 'today', now)) out.dueToday.push(r)
    else if (attn.includes('hotNoVisit')) out.hotNoVisit.push(r)
    else if (attn.includes('noFollowUp')) out.noFollowUp.push(r)
    else if (inTab(r, 'upcoming', now)) out.upcoming.push(r)
  }
  const byDue = (a: T, b: T) => (a.nextFollowUpAt ?? '').localeCompare(b.nextFollowUpAt ?? '')
  out.overdue.sort(byDue)
  out.dueToday.sort(byDue)
  out.upcoming.sort(byDue)
  out.uncontacted.sort((a, b) => a.lead.createdAt.localeCompare(b.lead.createdAt))
  out.hotNoVisit.sort((a, b) => b.score - a.score)
  out.noFollowUp.sort((a, b) => b.score - a.score)
  return out
}
