/**
 * Assigning leads (foundation-plan §5.4): to a person, or 'auto' through the engine (lowest workload, round-robin on
 * a tie, rules narrow the pool, on-leave and deactivated users skipped). The engine runs once per lead and sees the
 * workloads change between leads. E3 writes the history, moves open tasks and future appointments, and notifies.
 */
import type { Assignment, DB, ID, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'
import { assignablePool, previewAssignments } from '@/lib/assignment'
import { PermissionError, can, explainDenied } from '@/lib/permissions'
import { isSystem, assertActorCan, type Actor } from './core/actor'
import { commit, must } from './core/commit'
import { assignNow, autoPick } from './core/effects'

export type AssignOutcome = { leadId: ID; to: ID | null; reasonKey: Assignment['reason']['key'] }

const managerScope = (actor: Actor) => (!isSystem(actor) && actor.role === 'manager' ? actor.id : undefined)

export function assignLeads(ids: ID[], target: ID | 'auto', note?: string): { result: AssignOutcome[]; undoToken?: string } {
  return commit('lead.assign', (tx) => {
    const out: AssignOutcome[] = []
    if (target !== 'auto') {
      const user = must(tx.db.users, target, 'user')
      if (user.status !== 'active') throw new Error(`${user.name} is deactivated`)
      if (!isSystem(tx.actor) && tx.actor.role === 'manager' && user.managerId !== tx.actor.id && user.id !== tx.actor.id) {
        throw new PermissionError('lead.assign', explainDenied(tx.actor, 'lead.assign'))
      }
    }
    for (const id of ids) {
      const lead = must(tx.db.leads, id, 'lead')
      assertActorCan(tx.actor, 'lead.assign', lead, tx.db)
      if (target === 'auto') {
        const pick = autoPick(tx, lead, managerScope(tx.actor))
        if (!pick.userId) {
          out.push({ leadId: id, to: null, reasonKey: 'unassigned' })
          continue
        }
        if (pick.userId === lead.ownerId) {
          out.push({ leadId: id, to: pick.userId, reasonKey: pick.reason.key })
          continue
        }
        assignNow(tx, lead, pick.userId, 'auto', pick.reason.key, { reasonParams: pick.reason.params, workload: pick.workload, note })
        out.push({ leadId: id, to: pick.userId, reasonKey: pick.reason.key })
      } else {
        if (lead.ownerId === target) continue
        assignNow(tx, lead, target, 'manual', 'manual', { note })
        out.push({ leadId: id, to: target, reasonKey: 'manual' })
      }
    }
    return out
  }, { undoable: ids.length > 1 })
}

export const assignLead = (id: ID, target: ID | 'auto', note?: string) => assignLeads([id], target, note)

/** Open, unassigned leads the user may assign. */
export const unassignedLeadIds = (db: DB, user: User) =>
  db.leads.filter((l) => l.ownerId === null && OPEN_STAGES.includes(l.stage) && can(user, 'lead.assign', l, db)).map((l) => l.id)

/** Auto-assigns every given (or every visible unassigned) lead. */
export function autoAssignAll(db: DB, user: User, ids?: ID[]) {
  return assignLeads(ids ?? unassignedLeadIds(db, user), 'auto')
}

/** "Who would get what" before confirming auto-assignment (pure; see lib/assignment.previewAssignments). */
export const previewAuto = (db: DB, ids: ID[], user: User): AssignOutcome[] =>
  previewAssignments(db, ids, user.role === 'manager' ? user.id : undefined)

/** Executives a user may assign to (for the assign dialog): the whole pool for admins, the team for managers. */
export function assignableUsers(db: DB, user: User): User[] {
  return assignablePool(db.users, user.role === 'manager' ? user.id : undefined)
}
