/** Lead, first property, place line and owner for each appointment, looked up once per data change (calendar cells). */
import { useMemo } from 'react'
import type { Appointment, ID, Lead, Property, User } from '@/domain/types'
import { useDb } from '@/hooks/use-db'

export type EventInfo = { lead?: Lead; property?: Property; owner?: User; place?: string }

export function useEventInfo(list: Appointment[]): Map<ID, EventInfo> {
  const leads = useDb((db) => db.leads)
  const properties = useDb((db) => db.properties)
  const users = useDb((db) => db.users)
  return useMemo(() => {
    const leadMap = new Map(leads.map((l) => [l.id, l]))
    const propMap = new Map(properties.map((p) => [p.id, p]))
    const userMap = new Map(users.map((u) => [u.id, u]))
    const out = new Map<ID, EventInfo>()
    for (const a of list) {
      const property = a.propertyIds[0] ? propMap.get(a.propertyIds[0]) : undefined
      out.set(a.id, {
        lead: a.leadId ? leadMap.get(a.leadId) : undefined,
        property,
        owner: userMap.get(a.ownerId),
        place: property ? `${property.title} · ${property.location.locality}` : a.location?.text,
      })
    }
    return out
  }, [list, leads, properties, users])
}
