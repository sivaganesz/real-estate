/**
 * The user the demo is viewed as (foundation-plan §4). Falls back to the role's default user when the stored one is
 * missing or deactivated (for example after a reset), so the app never renders without a user.
 */
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ID, Role, User } from '@/domain/types'
import { DEFAULT_USER_FOR_ROLE, useSessionStore } from '@/store/session-store'
import { useDb } from './use-db'

export function resolveSessionUser(users: User[], role: Role, userId: ID): User {
  const active = (u: User | undefined) => (u && u.status === 'active' ? u : undefined)
  return (
    active(users.find((u) => u.id === userId && u.role === role)) ??
    active(users.find((u) => u.id === DEFAULT_USER_FOR_ROLE[role])) ??
    active(users.find((u) => u.role === role)) ??
    users[0]
  )
}

export function useCurrentUser(): User {
  const { role, userId } = useSessionStore(useShallow((s) => ({ role: s.role, userId: s.userId })))
  const users = useDb((db) => db.users)
  return useMemo(() => resolveSessionUser(users, role, userId), [users, role, userId])
}
