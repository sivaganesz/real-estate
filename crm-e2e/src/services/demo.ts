/**
 * Reset demo data (Settings, admin only, after a confirm): a fresh seed built for today. The session keeps the
 * same profile; pending undo is dropped.
 */
import { buildSeed } from '@/data/seed'
import { useDbStore } from '@/store/db-store'
import { assertActorCan, clock, currentActor } from './core/actor'
import { getDb } from './core/commit'
import { clearUndo } from './core/undo'
import { tick } from './automation'

export function resetDemo(): void {
  assertActorCan(currentActor(getDb()), 'demo.reset')
  clearUndo()
  const now = clock.now()
  useDbStore.getState()._apply(() => buildSeed(now))
  tick(now)
}

export { resetDemo as reset }
