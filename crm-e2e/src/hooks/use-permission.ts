/**
 * Permission checks for the current user. Use it for every action button and never compare roles directly:
 * hide the control when `can(action)` is false; disable it with a tooltip when the role may act but not on this record.
 */
import { useMemo } from 'react'
import type { User } from '@/domain/types'
import { can, explainDenied, scopeOf, type Action, type Scope, type Scoped } from '@/lib/permissions'
import { useCurrentUser } from './use-current-user'
import { useDb } from './use-db'

export interface PermissionApi {
  user: User
  can: (action: Action, record?: Scoped) => boolean
  scope: (action: Action) => Scope
  explain: (action: Action) => { reasonKey: string; params: Record<string, string> }
}

export function usePermission(): PermissionApi {
  const user = useCurrentUser()
  const users = useDb((db) => db.users)
  return useMemo(
    () => ({
      user,
      can: (action, record) => can(user, action, record, { users }),
      scope: (action) => scopeOf(user, action),
      explain: (action) => explainDenied(user, action),
    }),
    [user, users],
  )
}
