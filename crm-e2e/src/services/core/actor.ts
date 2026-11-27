/**
 * Who makes a change, and when. The actor is the profile the demo is viewed as (session store), unless a caller runs
 * code as someone else (the automation ticker runs as the system; tests run as a chosen user).
 * The clock is replaceable so tests can freeze time.
 */
import type { DB, User } from '@/domain/types'
import { resolveSessionUser } from '@/hooks/use-current-user'
import { useSessionStore } from '@/store/session-store'
import { assertCan, type Action, type Scoped } from '@/lib/permissions'

export type SystemActor = { id: 'system'; role: 'system'; name: string }
export type Actor = User | SystemActor

export const SYSTEM_ACTOR: SystemActor = { id: 'system', role: 'system', name: 'System' }
export const isSystem = (a: Actor): a is SystemActor => a.id === 'system'

/** The time source for every service. Tests set `clock.now = () => fixedDate`. */
export const clock = { now: (): Date => new Date() }

const stack: Actor[] = []

/** The actor for a change on this database. */
export function currentActor(db: Pick<DB, 'users'>): Actor {
  if (stack.length) return stack[stack.length - 1]
  const { role, userId } = useSessionStore.getState()
  return resolveSessionUser(db.users, role, userId)
}

/** Runs `fn` as `actor` (nested calls are fine). */
export function runAs<T>(actor: Actor, fn: () => T): T {
  stack.push(actor)
  try {
    return fn()
  } finally {
    stack.pop()
  }
}

/** Permission check for a write: the system may do anything, a person needs the matrix scope. */
export function assertActorCan(actor: Actor, action: Action, record?: Scoped, db?: Pick<DB, 'users'>): void {
  if (isSystem(actor)) return
  assertCan(actor, action, record, db)
}
