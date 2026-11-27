/** Small numbers for the Leads list header: new leads per week (sparkline) and the headline counts. Pure. */
import type { Lead } from '@/domain/types'
import { isActive, isOverdue, type LeadItem } from '@/lib/lead-queries'
import type { ContactAging } from '@/lib/lead-queries'

const DAY = 86_400_000

/** New leads per 7-day bucket, oldest first; the last bucket ends now. */
export function weeklyNew(leads: Pick<Lead, 'createdAt'>[], now: Date, weeks = 8): number[] {
  const out = Array.from({ length: weeks }, () => 0)
  for (const l of leads) {
    const age = Math.floor((now.getTime() - new Date(l.createdAt).getTime()) / (7 * DAY))
    if (age >= 0 && age < weeks) out[weeks - 1 - age]++
  }
  return out
}

export function headline(rows: (LeadItem & { aging: ContactAging })[], now: Date) {
  const open = rows.filter((r) => isActive(r.lead))
  return {
    open: open.length,
    hot: open.filter((r) => r.temperature === 'hot').length,
    overdue: open.filter((r) => isOverdue(r, now)).length,
    sla: open.filter((r) => r.aging.breached).length,
    unassigned: open.filter((r) => !r.lead.ownerId).length,
    /** Unassigned open leads past the first-call SLA (the hint under the Unassigned card). */
    unassignedSla: open.filter((r) => !r.lead.ownerId && r.aging.breached).length,
    newThisWeek: rows.filter((r) => now.getTime() - new Date(r.lead.createdAt).getTime() < 7 * DAY).length,
  }
}
