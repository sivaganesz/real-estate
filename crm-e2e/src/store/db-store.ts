/**
 * The demo database (foundation-plan §5.1): zustand + immer + persist ('crm-e2e-db').
 * UI never writes here: reads go through hooks/use-db, writes through services/* (commit()).
 * On load: schema check (migrate.ts → reseed on mismatch), then rebase every date to today (rebase.ts).
 */
import type { Draft } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { DB } from '@/domain/types'
import { buildSeed } from '@/data/seed'
import { localDay } from '@/lib/dates'
import { migrateDb } from './migrate'
import { rebaseDates } from './rebase'
import { safeStorage } from './storage'

export const DB_STORAGE_KEY = 'crm-e2e-db'

/** A change to the database: mutate the draft, or return a whole new DB (reset, undo). */
export type DbRecipe = (draft: Draft<DB>) => void | DB

export interface DbState {
  db: DB
  hydrated: boolean
  /** Internal: the single setter. Only services/core (commit, undo) and services/demo call it. */
  _apply: (recipe: DbRecipe) => void
}

type Listener = (db: DB) => void
const hydrationListeners = new Set<Listener>()
/** Runs after the persisted DB is loaded, migrated and rebased (services/automation hooks its first tick here). */
export function onDbHydrated(listener: Listener): () => void {
  hydrationListeners.add(listener)
  if (useDbStore.getState().hydrated) listener(useDbStore.getState().db)
  return () => {
    hydrationListeners.delete(listener)
  }
}

export const useDbStore = create<DbState>()(
  persist(
    immer((set) => ({
      db: buildSeed(new Date()),
      hydrated: false,
      _apply: (recipe) =>
        set((state) => {
          const replaced = recipe(state.db)
          if (replaced) state.db = replaced as Draft<DB>
        }),
    })),
    {
      name: DB_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ db: s.db }),
      migrate: (persisted) => persisted as { db: DB },
      merge: (persisted, current) => {
        const stored = (persisted as { db?: unknown } | undefined)?.db
        // nothing stored yet → keep the fresh seed built at create time; stale schema → reseed
        const db = rebaseDates(migrateDb(stored, () => (stored === undefined ? current.db : buildSeed(new Date()))), localDay(new Date()))
        return { ...current, db }
      },
    },
  ),
)

function markHydrated() {
  // This set also writes the (possibly fresh or rebased) DB to storage, so a first visit's seed survives a reload.
  useDbStore.setState({ hydrated: true })
  const { db } = useDbStore.getState()
  hydrationListeners.forEach((l) => l(db))
}

if (useDbStore.persist.hasHydrated()) markHydrated()
else useDbStore.persist.onFinishHydration(markHydrated)
