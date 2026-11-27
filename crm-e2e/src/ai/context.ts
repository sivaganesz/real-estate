/**
 * What the assistant knows about where it is used (master prompt §12.5: role, current page and selected record).
 * A record page calls useAISelection({ kind: 'lead', id }) so the panel shows "On: Lead · Priya Sharma" and commands
 * like "schedule a visit tomorrow 11am" apply to that lead.
 */
import { useEffect } from 'react'
import { create } from 'zustand'
import type { DB, EntityRef, User } from '@/domain/types'
import type { AIContext } from './types'

type SelectionState = { selection?: EntityRef; set: (s?: EntityRef) => void }
export const useSelectionStore = create<SelectionState>()((set) => ({ selection: undefined, set: (selection) => set({ selection }) }))

/** Marks the record the page shows as the assistant's context while the page is open. */
export function useAISelection(ref: EntityRef | undefined) {
  const kind = ref?.kind
  const id = ref?.id
  useEffect(() => {
    if (!kind || !id) return
    useSelectionStore.getState().set({ kind, id })
    return () => {
      const cur = useSelectionStore.getState().selection
      if (cur?.kind === kind && cur.id === id) useSelectionStore.getState().set(undefined)
    }
  }, [kind, id])
}

export function buildAIContext(input: { actor: User; route: string; selection?: EntityRef; now?: Date; db: () => DB }): AIContext {
  return { actor: input.actor, role: input.actor.role, route: input.route, selection: input.selection, now: input.now ?? new Date(), db: input.db }
}

/** A display name for the selected record ("Priya Sharma", "Prestige Lakeside 3BHK"). */
export function selectionLabel(db: DB, ref: EntityRef | undefined): string | undefined {
  if (!ref) return undefined
  switch (ref.kind) {
    case 'lead': return db.leads.find((l) => l.id === ref.id)?.name
    case 'client': return db.clients.find((c) => c.id === ref.id)?.name
    case 'property': return db.properties.find((p) => p.id === ref.id)?.title
    case 'appointment': {
      const a = db.appointments.find((x) => x.id === ref.id)
      return a ? (db.leads.find((l) => l.id === a.leadId)?.name ?? a.id) : undefined
    }
    case 'task': return db.tasks.find((t) => t.id === ref.id)?.title
    case 'user': return db.users.find((u) => u.id === ref.id)?.name
    default: return ref.id
  }
}
