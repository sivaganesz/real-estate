/**
 * Tasks and follow-ups. Completing a call / WhatsApp / follow-up task linked to a lead counts as contact (E10),
 * and a "not reachable" or "busy" call result creates the retry task (E4).
 */
import type { ID, Origin, Task, TaskInput } from '@/domain/types'
import { assertValid, validateTask } from '@/lib/validation'
import { assertActorCan } from './core/actor'
import { commit, must } from './core/commit'
import { addTask } from './core/effects'

export type NewTask = Omit<TaskInput, 'priority' | 'origin'> & Partial<Pick<TaskInput, 'priority' | 'origin'>>

export function createTask(input: NewTask, opts: { via?: Origin } = {}): { id: ID } {
  assertValid(validateTask(input))
  const { result: id } = commit('task.create', (tx) => {
    assertActorCan(tx.actor, 'task.manage', { ownerId: input.ownerId }, tx.db)
    return addTask(tx, { ...input, priority: input.priority ?? 'medium', origin: input.origin ?? opts.via ?? 'manual', title: input.title.trim() })
  }, opts)
  return { id }
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'type' | 'priority' | 'dueAt' | 'ownerId' | 'notes' | 'leadId' | 'clientId'>>

export function updateTask(id: ID, patch: TaskPatch, opts: { via?: Origin } = {}) {
  return commit('task.update', (tx) => {
    const t = must(tx.db.tasks, id, 'task')
    assertActorCan(tx.actor, 'task.manage', t, tx.db)
    if (patch.ownerId && patch.ownerId !== t.ownerId) assertActorCan(tx.actor, 'task.manage', { ownerId: patch.ownerId }, tx.db)
    Object.assign(t, patch)
  }, opts)
}

/** Tomorrow / in 3 days / next week chips, or any time. */
export const rescheduleTask = (id: ID, dueAt: string) => updateTask(id, { dueAt })

export function completeTasks(ids: ID[], result: { outcome?: string; callResult?: Task['callResult'] } = {}, opts: { via?: Origin } = {}) {
  return commit('task.complete', (tx) => {
    let n = 0
    for (const id of ids) {
      const t = must(tx.db.tasks, id, 'task')
      assertActorCan(tx.actor, 'task.manage', t, tx.db)
      if (t.status !== 'open') continue
      t.status = 'done'
      t.completedAt = tx.now
      if (result.outcome?.trim()) t.outcome = result.outcome.trim()
      if (result.callResult) t.callResult = result.callResult
      tx.emit({ type: 'task.completed', id })
      n++
    }
    return n
  }, { via: opts.via, undoable: true })
}

export const completeTask = (id: ID, result: { outcome?: string; callResult?: Task['callResult'] } = {}, opts: { via?: Origin } = {}) =>
  completeTasks([id], result, opts)

export function reopenTask(id: ID) {
  return commit('task.reopen', (tx) => {
    const t = must(tx.db.tasks, id, 'task')
    assertActorCan(tx.actor, 'task.manage', t, tx.db)
    t.status = 'open'
    t.completedAt = undefined
  })
}

export function cancelTask(id: ID) {
  return commit('task.cancel', (tx) => {
    const t = must(tx.db.tasks, id, 'task')
    assertActorCan(tx.actor, 'task.manage', t, tx.db)
    t.status = 'cancelled'
    tx.emit({ type: 'task.cancelled', id })
  }, { undoable: true })
}

export function deleteTask(id: ID) {
  return commit('task.delete', (tx) => {
    const t = must(tx.db.tasks, id, 'task')
    assertActorCan(tx.actor, 'task.manage', t, tx.db)
    tx.db.tasks = tx.db.tasks.filter((x) => x.id !== id)
  }, { undoable: true })
}
