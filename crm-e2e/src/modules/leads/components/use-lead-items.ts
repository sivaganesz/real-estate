/**
 * The visible leads with their derived facts (score, temperature, class, next follow-up, priority, aging), memoised
 * on the db identity. Every Leads view reads through this so counts match Today, Pipeline and Reports (lib/lead-queries).
 */
import { useMemo } from 'react'
import type { ID } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { classificationOf } from '@/lib/classification'
import { contactAging, leadItems, type ContactAging, type LeadItem } from '@/lib/lead-queries'
import { suggestNext, type NextAction } from '@/lib/next-action'
import { leadScore, priorityFor } from '@/lib/scoring'
import { visible } from '@/services/queries/visibility'

export type LeadRow = LeadItem & { aging: ContactAging; next: NextAction | null; ownerName?: string }

export function useLeadItems(): { rows: LeadRow[]; byId: Map<ID, LeadRow>; now: Date } {
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  return useMemo(() => {
    const ctx = { properties: db.properties, settings: db.settings, now }
    const leads = visible.leads(db, user)
    const items = leadItems(leads, {
      score: (l) => leadScore(l, ctx),
      cls: (l) => classificationOf(l, ctx),
      tasks: db.tasks,
      appointments: db.appointments,
      priority: (l, temp) => priorityFor(l, temp, { appointments: db.appointments, tasks: db.tasks, now }),
    })
    const names = new Map(db.users.map((u) => [u.id, u.name]))
    const rows: LeadRow[] = items.map((x) => ({
      ...x,
      aging: contactAging(x.lead, db.settings.sla, now),
      next: suggestNext(x.lead, { appointments: db.appointments, tasks: db.tasks, properties: db.properties, settings: db.settings, now }),
      ownerName: x.lead.ownerId ? names.get(x.lead.ownerId) : undefined,
    }))
    return { rows, byId: new Map(rows.map((r) => [r.lead.id, r])), now }
  }, [db, user, now])
}
