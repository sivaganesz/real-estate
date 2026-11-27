/**
 * Typed reads from the demo database. Selectors are compared shallowly, so a selector that filters a list
 * re-renders only when the result actually changes. Writes never happen here: use services/*.
 */
import { useShallow } from 'zustand/react/shallow'
import type { DB } from '@/domain/types'
import { useDbStore } from '@/store/db-store'

export function useDb<T>(selector: (db: DB) => T): T {
  return useDbStore(useShallow((s) => selector(s.db)))
}

/** The whole DB object (changes on every write); for derived queries memoised with useMemo. */
export function useWholeDb(): DB {
  return useDbStore((s) => s.db)
}
