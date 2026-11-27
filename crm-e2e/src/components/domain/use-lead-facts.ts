/**
 * Derived facts about a lead for cards and rows (never stored): score + temperature, owner, days since last contact,
 * SLA breach, and the next best action (lib/next-action) as an i18n key.
 */
import { useMemo } from 'react'
import type { Lead } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useWholeDb } from '@/hooks/use-db'
import { daysSince, minutesBetween } from '@/lib/dates'
import { suggestNext } from '@/lib/next-action'
import { leadScore } from '@/lib/scoring'

export function useLeadFacts(lead: Lead) {
  const db = useWholeDb()
  const now = useNow()
  return useMemo(() => {
    const score = leadScore(lead, { properties: db.properties, settings: db.settings, now })
    const temperature = lead.temperatureOverride ?? score.temperature
    const owner = db.users.find((u) => u.id === lead.ownerId)
    const lastContactDays = lead.lastContactAt ? daysSince(lead.lastContactAt, now) : null
    const breached = !lead.firstContactAt && lead.stage === 'new' && minutesBetween(lead.createdAt, now) > db.settings.sla.firstResponseMins
    const next = suggestNext(lead, { appointments: db.appointments, tasks: db.tasks, properties: db.properties, settings: db.settings, now })
    return { score, temperature, owner, lastContactDays, breached, next, now }
  }, [lead, db, now])
}
