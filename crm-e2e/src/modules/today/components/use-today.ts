/**
 * Today data for the current user: the whole db, the current user and a clock that ticks every 30 s, memoised so a
 * write anywhere (a click here, the assistant, another tab of the app) recomputes the ranked lists in the same render.
 */
import { useMemo } from 'react'
import type { DB, User } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'

export function useToday<T>(compute: (db: DB, user: User, now: Date) => T): { data: T; db: DB; user: User; now: Date } {
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow(30_000)
  // `compute` is a module-level function (executiveToday, managerToday, adminToday), so it never changes identity
  const data = useMemo(() => compute(db, user, now), [compute, db, user, now])
  return { data, db, user, now }
}
