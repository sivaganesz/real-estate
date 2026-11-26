/**
 * The wireframe's "backend": one in-memory database, saved in this browser, with the actions the screens call.
 * Every action maps to a future API endpoint (noted on each), so screens don't change when the real backend arrives.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DATA_VERSION, DEMO_TODAY, seedDatabase } from '@/data/seed'
import type { Database, Lead, Property, Role, User } from '@/data/types'
import { hasFollowUpConsent } from '@/lib/consent'

const DB_KEY = 'realspec-rebuild-db'
const ROLE_KEY = 'realspec-rebuild-role'

/** Who the demo signs in as for each role. */
const DEMO_USER_FOR: Record<Role, string> = { admin: 'u-admin', manager: 'u-mgr', executive: 'u-ex01' }

function load<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null // storage blocked: start from the seed
  }
}
function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked: changes last for this visit only */
  }
}

export type ShareChannel = 'whatsapp' | 'link' | 'pdf'

type Store = {
  db: Database
  today: string
  user: User
  role: Role
  setRole: (r: Role) => void
  /** PATCH /api/properties/:id — also appends to the property's history (unless historyText is empty, e.g. a draft's chat moving on). */
  updateProperty: (id: string, change: (p: Property) => void, historyText: string) => void
  /** POST /api/properties — returns the new id (PROP-<next number>). */
  addProperty: (build: (id: string) => Property, historyText: string) => string
  /** POST /api/properties/:id/shares — logs the share on the property; with a lead, also on their timeline, where it counts as a recommendation. */
  shareProperty: (propertyId: string, leadId: string | undefined, channel: ShareChannel, historyText?: string) => void
  /** POST / DELETE /api/leads/:id/recommendations/:propertyId — the buyer was told about it (call, WhatsApp, in person). */
  recommendProperty: (propertyId: string, leadId: string, on: boolean) => void
  /** PATCH /api/leads/:id — e.g. move stage or reassign; `note` goes on the lead's timeline. */
  updateLead: (id: string, change: (l: Lead) => void, note?: string) => void
  /** POST /api/leads/:id/activity — a note on each lead's timeline about a property (e.g. "PROP-1005 was archived"). */
  noteOnLeads: (leadIds: string[], propertyId: string, text: string) => void
  /**
   * DELETE /api/properties/:id — to correct a mistake (a wrong import or a property added twice). Leads that refer to it lose it:
   * it leaves their recommendations, booked site visits for it are cancelled, a negotiation on it is cleared, and `leadNote`
   * goes on their timeline. Their past activity is kept.
   */
  deleteProperty: (id: string, leadNote?: string) => void
  /** PATCH /api/settings — master data such as approval badges. Admin / Sales manager only. */
  updateSettings: (change: (s: Database['settings']) => void) => void
  resetDemo: () => void
}

/** Recommending or sharing moves an early lead on to "Property recommended". */
function markRecommended(lead: Lead, propertyId: string) {
  if (!lead.recommendedPropertyIds.includes(propertyId)) lead.recommendedPropertyIds.push(propertyId)
  if (['new', 'contacted', 'qualified'].includes(lead.stage)) {
    lead.stage = 'recommended'
    lead.stageSince = DEMO_TODAY
  }
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(() => {
    const saved = load<Database>(DB_KEY)
    return saved && saved.version === DATA_VERSION ? saved : seedDatabase()
  })
  const [role, setRoleState] = useState<Role>(() => load<Role>(ROLE_KEY) ?? 'manager')

  useEffect(() => persist(DB_KEY, db), [db])

  const setRole = useCallback((r: Role) => {
    setRoleState(r)
    persist(ROLE_KEY, r)
  }, [])

  const user = useMemo(() => db.users.find((u) => u.id === DEMO_USER_FOR[role])!, [db.users, role])

  const updateProperty = useCallback<Store['updateProperty']>((id, change, historyText) => {
    setDb((prev) => {
      const next = structuredClone(prev)
      const p = next.properties.find((x) => x.id === id)
      if (!p) return prev
      change(p)
      p.updated = { by: user.id, at: DEMO_TODAY }
      if (historyText) p.history.unshift({ id: `${id}-h${p.history.length + 1}`, at: DEMO_TODAY, by: user.id, text: historyText })
      return next
    })
  }, [user.id])

  const addProperty = useCallback<Store['addProperty']>((build, historyText) => {
    const max = Math.max(1000, ...db.properties.map((p) => Number(p.id.replace(/\D/g, '')) || 0))
    const id = `PROP-${max + 1}`
    const p = build(id)
    p.history = [{ id: `${id}-h1`, at: DEMO_TODAY, by: user.id, text: historyText }]
    setDb((prev) => ({ ...prev, properties: [p, ...prev.properties] }))
    return id
  }, [db.properties, user.id])

  const shareProperty = useCallback<Store['shareProperty']>((propertyId, leadId, channel, historyText) => {
    setDb((prev) => {
      const next = structuredClone(prev)
      // on the property: the share log and a history line
      const p = next.properties.find((x) => x.id === propertyId)
      if (p) {
        p.shares = [{ at: DEMO_TODAY, by: user.id, channel, leadId }, ...(p.shares ?? [])]
        if (historyText) p.history.unshift({ id: `${p.id}-h${p.history.length + 1}`, at: DEMO_TODAY, by: user.id, text: historyText })
      }
      // on the lead (when it was shared with one): their timeline, and it counts as a recommendation
      const lead: Lead | undefined = leadId ? next.leads.find((l) => l.id === leadId) : undefined
      if (lead) {
        lead.activity.unshift({ id: `${lead.id}-a${lead.activity.length + 1}`, at: DEMO_TODAY, by: user.id, type: 'shared', propertyId, text: channel })
        markRecommended(lead, propertyId)
      }
      return next
    })
  }, [user.id])

  const recommendProperty = useCallback<Store['recommendProperty']>((propertyId, leadId, on) => {
    setDb((prev) => {
      const next = structuredClone(prev)
      const lead = next.leads.find((l) => l.id === leadId)
      if (!lead) return prev
      if (on) markRecommended(lead, propertyId)
      else lead.recommendedPropertyIds = lead.recommendedPropertyIds.filter((x) => x !== propertyId)
      lead.activity.unshift({ id: `${leadId}-a${lead.activity.length + 1}`, at: DEMO_TODAY, by: user.id, type: 'recommended', propertyId, text: on ? 'on' : 'off' })
      return next
    })
  }, [user.id])

  const updateLead = useCallback<Store['updateLead']>((id, change, note) => {
    setDb((prev) => {
      const next = structuredClone(prev)
      const l = next.leads.find((x) => x.id === id)
      if (!l) return prev
      const before = l.nextFollowUp
      change(l)
      // safety net for the consent rule: a new follow-up date without consent is not saved (screens disable these controls)
      if (l.nextFollowUp && l.nextFollowUp !== before && !hasFollowUpConsent(l)) {
        console.warn(`Follow-up for ${l.id} not saved: no consent to follow up`)
        l.nextFollowUp = before
      }
      if (note) l.activity.unshift({ id: `${l.id}-a${l.activity.length + 1}`, at: DEMO_TODAY, by: user.id, type: 'note', text: note })
      return next
    })
  }, [user.id])

  const noteOnLeads = useCallback<Store['noteOnLeads']>((leadIds, propertyId, text) => {
    if (!leadIds.length) return
    setDb((prev) => {
      const next = structuredClone(prev)
      next.leads.filter((l) => leadIds.includes(l.id)).forEach((l) => {
        l.activity.unshift({ id: `${l.id}-a${l.activity.length + 1}`, at: DEMO_TODAY, by: user.id, type: 'note', propertyId, text })
      })
      return next
    })
  }, [user.id])

  const deleteProperty = useCallback<Store['deleteProperty']>((id, leadNote) => {
    setDb((prev) => {
      const next = structuredClone(prev)
      next.properties = next.properties.filter((p) => p.id !== id)
      for (const l of next.leads) {
        const linked = l.recommendedPropertyIds.includes(id) || l.visits.some((v) => v.propertyId === id) || l.negotiation?.propertyId === id ||
          l.activity.some((a) => a.type === 'shared' && a.propertyId === id)
        if (!linked) continue
        l.recommendedPropertyIds = l.recommendedPropertyIds.filter((x) => x !== id)
        l.visits.forEach((v) => { if (v.propertyId === id && v.status === 'scheduled') v.status = 'cancelled' })
        if (l.negotiation?.propertyId === id) delete l.negotiation
        if (leadNote) l.activity.unshift({ id: `${l.id}-a${l.activity.length + 1}`, at: DEMO_TODAY, by: user.id, type: 'note', propertyId: id, text: leadNote })
      }
      return next
    })
  }, [user.id])

  const updateSettings = useCallback<Store['updateSettings']>((change) => {
    setDb((prev) => {
      const next = structuredClone(prev)
      change(next.settings)
      return next
    })
  }, [])

  const resetDemo = useCallback(() => setDb(seedDatabase()), [])

  const value = useMemo<Store>(
    () => ({ db, today: DEMO_TODAY, user, role, setRole, updateProperty, addProperty, shareProperty, recommendProperty, updateLead, noteOnLeads, deleteProperty, updateSettings, resetDemo }),
    [db, user, role, setRole, updateProperty, addProperty, shareProperty, recommendProperty, updateLead, noteOnLeads, deleteProperty, updateSettings, resetDemo],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore must be used inside <StoreProvider>')
  return s
}

/* ---------- permissions (a fixed catalogue in code; roles map to it) ---------- */

/**
 * property.add: start a property with the AI assistant (executives' drafts go to a manager for approval) ·
 * property.manage: publish and change published properties · property.seeDrafts: everyone's drafts.
 */
export type Permission = 'property.add' | 'property.manage' | 'property.seeDrafts' | 'lead.seeAll'

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ['property.add', 'property.manage', 'property.seeDrafts', 'lead.seeAll'],
  manager: ['property.add', 'property.manage', 'property.seeDrafts', 'lead.seeAll'],
  executive: ['property.add'],
}

export function useCan() {
  const { role } = useStore()
  return useCallback((p: Permission) => ROLE_PERMISSIONS[role].includes(p), [role])
}

/** Leads the current user works with: everything for managers, only their own for executives. */
export function useVisibleLeads(): Lead[] {
  const { db, user } = useStore()
  const can = useCan()
  return useMemo(() => (can('lead.seeAll') ? db.leads : db.leads.filter((l) => l.ownerId === user.id)), [db.leads, user.id, can])
}

export const userName = (db: Database, id: string | null | undefined) =>
  id === 'system' ? 'System' : db.users.find((u) => u.id === id)?.name ?? ''
