/**
 * One level of undo, kept for 10 seconds (foundation-plan §5.2): commit() remembers the database as it was before an
 * undoable change; undo(token) puts it back. Used for delete, bulk actions and AI-applied changes.
 * Undo restores the whole snapshot, so anything else changed in those 10 seconds is rolled back too (demo trade-off).
 */
import type { DB } from '@/domain/types'
import { useDbStore } from '@/store/db-store'
import { clock } from './actor'

export const UNDO_MS = 10_000

type Slot = { token: string; db: DB; label: string; expiresAt: number }
let slot: Slot | null = null
let seq = 0

export function remember(db: DB, label: string): string {
  seq += 1
  const token = `undo-${seq}`
  slot = { token, db, label, expiresAt: clock.now().getTime() + UNDO_MS }
  return token
}

export const canUndo = (token: string | undefined) => !!token && slot?.token === token && clock.now().getTime() <= slot.expiresAt

/** Restores the snapshot for `token`. Returns false when it expired or a newer undoable change replaced it. */
export function undo(token: string | undefined): boolean {
  if (!token || !canUndo(token) || !slot) return false
  const { db } = slot
  slot = null
  useDbStore.getState()._apply(() => db)
  return true
}

export function clearUndo(): void {
  slot = null
}

/** The label of the change that can be undone (for the toast). */
export const undoLabel = (token: string | undefined) => (canUndo(token) ? slot?.label : undefined)
