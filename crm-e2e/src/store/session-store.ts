/**
 * Who is using the demo right now (foundation-plan §4), persisted as 'crm-e2e-session'.
 * The default is the primary executive (Arjun), which gives the strongest first impression.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ID, Role } from '@/domain/types'
import { safeStorage } from './storage'

export const SESSION_STORAGE_KEY = 'crm-e2e-session'

/** The fixed demo user for each role (the executive default is Arjun). */
export const DEFAULT_USER_FOR_ROLE: Record<Role, ID> = { admin: 'u-admin', manager: 'u-rohit', executive: 'u-arjun' }

export interface SessionState {
  role: Role
  userId: ID
  sidebarCollapsed: boolean
  aiPanelOpen: boolean
  switchProfile: (role: Role, userId?: ID) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setAiPanelOpen: (open: boolean) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: 'executive',
      userId: DEFAULT_USER_FOR_ROLE.executive,
      sidebarCollapsed: false,
      aiPanelOpen: false,
      switchProfile: (role, userId) => set({ role, userId: userId ?? DEFAULT_USER_FOR_ROLE[role] }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setAiPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
    }),
    {
      name: SESSION_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ role: s.role, userId: s.userId, sidebarCollapsed: s.sidebarCollapsed, aiPanelOpen: s.aiPanelOpen }),
    },
  ),
)
