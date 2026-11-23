/**
 * The wireframe's "backend": one in-memory database, saved in this browser, with the actions the screens call.
 * Every action maps to a future API endpoint (noted on each), so screens don't change when the real backend arrives.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEMO_TODAY, seedDatabase } from '@/data/seed'
import type { Database, Lead, Property, Role, User } from '@/data/types'

const DB_KEY = 'realspec-rebuild-db'
const ROLE_KEY = 'realspec-rebuild-role'
const DB_VERSION = 4

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
  /** PATCH /api/properties/:id — also appends to the property's history. */
  updateProperty: (id: string, change: (p: Property) => void, historyText: string) => void
  /** POST /api/properties — returns the new id (PROP-<next number>). */
  addProperty: (build: (id: string) => Property, historyText: string) => string
  /** POST /api/leads/:id/shares — logs on the lead's timeline and counts as a recommendation. */
  shareProperty: (propertyId: string, leadId: string, channel: ShareChannel) => void
  /** POST / DELETE /api/leads/:id/recommendations/:propertyId — the buyer was told about it (call, WhatsApp, in person). */
  recommendProperty: (propertyId: string, leadId: string, on: boolean) => void
  /** DELETE /api/properties/:id — only offered for an archived property. */
  deleteProperty: (id: string) => void
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
    return saved && saved.version === DB_VERSION ? saved : seedDatabase()
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
      p.history.unshift({ id: `${id}-h${p.history.length + 1}`, at: DEMO_TODAY, by: user.id, text: historyText })
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

  const shareProperty = useCallback<Store['shareProperty']>((propertyId, leadId, channel) => {
    setDb((prev) => {
      const next = structuredClone(prev)
      const lead: Lead | undefined = next.leads.find((l) => l.id === leadId)
      if (!lead) return prev
      lead.activity.unshift({ id: `${leadId}-a${lead.activity.length + 1}`, at: DEMO_TODAY, by: user.id, type: 'shared', propertyId, text: channel })
      markRecommended(lead, propertyId) // sharing counts as a recommendation
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

  const deleteProperty = useCallback<Store['deleteProperty']>((id) => {
    setDb((prev) => ({ ...prev, properties: prev.properties.filter((p) => p.id !== id) }))
  }, [])

  const updateSettings = useCallback<Store['updateSettings']>((change) => {
    setDb((prev) => {
      const next = structuredClone(prev)
      change(next.settings)
      return next
    })
  }, [])

  const resetDemo = useCallback(() => setDb(seedDatabase()), [])

  const value = useMemo<Store>(
    () => ({ db, today: DEMO_TODAY, user, role, setRole, updateProperty, addProperty, shareProperty, recommendProperty, deleteProperty, updateSettings, resetDemo }),
    [db, user, role, setRole, updateProperty, addProperty, shareProperty, recommendProperty, deleteProperty, updateSettings, resetDemo],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore must be used inside <StoreProvider>')
  return s
}

/* ---------- permissions (a fixed catalogue in code; roles map to it) ---------- */

export type Permission = 'property.manage' | 'property.seeDrafts' | 'lead.seeAll'

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ['property.manage', 'property.seeDrafts', 'lead.seeAll'],
  manager: ['property.manage', 'property.seeDrafts', 'lead.seeAll'],
  executive: [],
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
