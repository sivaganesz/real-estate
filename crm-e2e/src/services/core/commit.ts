/**
 * The single write path (foundation-plan §5.2). Every service change runs through commit():
 *  1. snapshot the database when the change is undoable (one level, 10 s: undo.ts);
 *  2. run the change on an immer draft;
 *  3. drain the domain events through effects.ts in the SAME draft (a handler may emit more, up to depth 5);
 *  4. apply the result once (one re-render). If anything throws, nothing is applied.
 * Results must be plain values (ids, numbers): drafts are revoked when commit returns.
 */
import { produce, type Draft } from 'immer'
import type { DB, ID, ISODateTime, Origin } from '@/domain/types'
import { useDbStore } from '@/store/db-store'
import { clock, currentActor, type Actor } from './actor'
import { handleEvent, flushBatches } from './effects'
import type { DomainEvent } from './events'
import { nextId, type IdPrefix } from './ids'
import { remember } from './undo'

export const MAX_EVENT_DEPTH = 5

/** Collected inside one commit and flushed at the end (import assignment notifications are batched per assignee). */
export type TxBatch = { assigned: Record<ID, number> }

export type Tx = {
  db: Draft<DB>
  actor: Actor
  /** ISO timestamp of this change. */
  now: ISODateTime
  nowDate: Date
  via: Origin
  emit(e: DomainEvent): void
  id(prefix: IdPrefix): ID
  batch: TxBatch
}

export type CommitOptions = { via?: Origin; undoable?: boolean; actor?: Actor }
export type CommitResult<R> = { result: R; undoToken?: string }

export const getDb = (): DB => useDbStore.getState().db

export function commit<R>(label: string, fn: (tx: Tx) => R, opts: CommitOptions = {}): CommitResult<R> {
  const before = getDb()
  const nowDate = clock.now()
  const actor = opts.actor ?? currentActor(before)
  let result!: R
  const next = produce(before, (draft) => {
    const queue: { e: DomainEvent; depth: number }[] = []
    let depth = 0
    const tx: Tx = {
      db: draft,
      actor,
      now: nowDate.toISOString(),
      nowDate,
      via: opts.via ?? 'manual',
      emit: (e) => {
        queue.push({ e, depth: depth + 1 })
      },
      id: (prefix) => nextId(draft, prefix),
      batch: { assigned: {} },
    }
    result = fn(tx)
    while (queue.length) {
      const item = queue.shift()!
      if (item.depth > MAX_EVENT_DEPTH) continue
      depth = item.depth
      handleEvent(tx, item.e)
    }
    flushBatches(tx)
  })
  const undoToken = opts.undoable ? remember(before, label) : undefined
  if (next !== before) useDbStore.getState()._apply(() => next)
  return { result, undoToken }
}

/** A record that should exist does not (deleted meanwhile, or a wrong id). */
export class NotFoundError extends Error {
  readonly kind: string
  readonly id: ID
  constructor(kind: string, id: ID) {
    super(`${kind} ${id} not found`)
    this.name = 'NotFoundError'
    this.kind = kind
    this.id = id
  }
}

/** Finds a record in a draft collection or throws NotFoundError. */
export function must<T extends { id: ID }>(list: T[], id: ID, kind: string): T {
  const x = list.find((r) => r.id === id)
  if (!x) throw new NotFoundError(kind, id)
  return x
}
