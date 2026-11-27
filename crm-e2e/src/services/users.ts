/**
 * Users: add, edit, availability, deactivate (with redistribution of open leads, E14) and activate.
 * Going on leave asks the manager to reassign (E15); the engine skips on-leave and deactivated users.
 */
import type { Availability, DB, ID, ISODate, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'
import { isEmail } from '@/lib/validation'
import { toE164 } from '@/lib/phone'
import { assertActorCan } from './core/actor'
import { commit, getDb, must, type Tx } from './core/commit'
import { assignNow, autoPick, notify } from './core/effects'
import type { Redistribute } from './core/events'

export type NewUser = Pick<User, 'name' | 'role' | 'email' | 'phone'> & Partial<Pick<User, 'managerId' | 'languages' | 'cities' | 'propertyFocus' | 'targets'>>

export function createUser(input: NewUser): { id: ID } {
  if (!input.name.trim()) throw new Error('A name is required')
  if (!isEmail(input.email)) throw new Error('A valid email is required')
  const { result: id } = commit('user.create', (tx) => {
    assertActorCan(tx.actor, 'user.manage')
    const id = tx.id('U')
    tx.db.users.push({
      id, name: input.name.trim(), role: input.role, email: input.email.trim(), phone: toE164(input.phone) || input.phone,
      managerId: input.role === 'executive' ? input.managerId : undefined, status: 'active', availability: 'available',
      languages: input.languages ?? ['English'], cities: input.cities ?? [], propertyFocus: input.propertyFocus ?? ['residential'],
      targets: input.targets, joinedAt: tx.now.slice(0, 10),
    })
    tx.emit({ type: 'user.created', id })
    return id
  })
  return { id }
}

export type UserPatch = Partial<Pick<User, 'name' | 'email' | 'phone' | 'role' | 'managerId' | 'languages' | 'cities' | 'propertyFocus' | 'targets'>>

/** Admins edit anyone; a user may edit their own name, phone and languages (preferences). */
export function updateUser(id: ID, patch: UserPatch) {
  return commit('user.update', (tx) => {
    const u = must(tx.db.users, id, 'user')
    const own = tx.actor.id === id
    const adminOnly = patch.role !== undefined || patch.managerId !== undefined || patch.targets !== undefined || patch.email !== undefined
    if (own && !adminOnly) assertActorCan(tx.actor, 'settings.preferences', { ownerId: id }, tx.db)
    else assertActorCan(tx.actor, 'user.manage')
    // an executive who still owns open leads hands them over first (changeRoleWithHandOver), or they would be orphaned
    if (patch.role && patch.role !== u.role && u.role === 'executive') {
      const open = openLeadCount(tx.db, id)
      if (open) throw new Error(`${u.name} still owns ${open} open lead${open === 1 ? '' : 's'}: hand them over before changing the role`)
    }
    const fields = Object.keys(patch).filter((k) => patch[k as keyof UserPatch] !== undefined)
    Object.assign(u, patch)
    if (patch.phone) u.phone = toE164(patch.phone) || patch.phone
    tx.emit({ type: 'user.updated', id, fields })
  })
}

/** How many open leads a user owns. */
export const openLeadCount = (db: Pick<DB, 'leads'>, id: ID) => db.leads.filter((l) => l.ownerId === id && OPEN_STAGES.includes(l.stage)).length

/**
 * Changes an executive's role (e.g. promoted to Sales Manager) and hands their open leads over in the same change, as
 * deactivation does: auto (the engine without them, within their old manager's team), to one person, or unassigned.
 * They are dropped from assignment rules (a rule left with nobody is switched off). Undoable; each receiver gets one
 * batched notice. Returns how many leads were left unassigned.
 */
export function changeRoleWithHandOver(id: ID, patch: UserPatch & { role: User['role'] }, redistribute: Redistribute = 'auto') {
  const before = new Set(getDb().notifications.map((n) => n.id))
  const r = commit('user.update', (tx) => {
    const u = must(tx.db.users, id, 'user')
    assertActorCan(tx.actor, 'user.manage')
    const oldManager = u.managerId
    const wasExecutive = u.role === 'executive'
    const fields = Object.keys(patch).filter((k) => patch[k as keyof UserPatch] !== undefined)
    Object.assign(u, patch)
    if (patch.phone) u.phone = toE164(patch.phone) || patch.phone
    if (u.role !== 'executive') u.managerId = undefined
    tx.emit({ type: 'user.updated', id, fields })
    if (!wasExecutive || u.role === 'executive') return 0
    const note = `Role changed to ${u.role === 'manager' ? 'Sales Manager' : 'Admin'}`
    let left = 0
    for (const lead of tx.db.leads) {
      if (lead.ownerId !== id || !OPEN_STAGES.includes(lead.stage)) continue
      if (redistribute === 'unassign') {
        assignNow(tx, lead, null, 'redistribution', 'unassigned', { note })
        left++
      } else if (redistribute === 'auto') {
        const pick = autoPick(tx, lead, oldManager)
        assignNow(tx, lead, pick.userId, 'redistribution', pick.reason.key, { workload: pick.workload, reasonParams: pick.reason.params, note })
        if (!pick.userId) left++
      } else assignNow(tx, lead, redistribute.toUserId, 'redistribution', 'manual', { note })
    }
    dropFromRules(tx, id)
    return left
  }, { undoable: true })
  batchReassignNotices(before, id)
  return r
}

/** Removes a user from every assignment rule; a rule left with nobody is switched off (it could never match). */
function dropFromRules(tx: Tx, id: ID) {
  for (const rule of tx.db.settings.assignment.rules) {
    if (!rule.userIds.includes(id)) continue
    rule.userIds = rule.userIds.filter((x) => x !== id)
    if (!rule.userIds.length) rule.enabled = false
  }
}

/**
 * A hand-over moves many leads at once: instead of one "X was reassigned from Y" per lead, each receiver gets one
 * "N leads reassigned to you from Y" (as import and auto-assign batches do). Runs right after the hand-over commit on
 * the notices it added; Undo of the hand-over restores the state from before both.
 */
function batchReassignNotices(before: Set<ID>, fromId: ID) {
  const db = getDb()
  const from = db.users.find((u) => u.id === fromId)
  if (!from) return
  const added = db.notifications.filter((n) => !before.has(n.id) && n.kind === 'reassignment' && n.params.from === from.name && !n.params.to && !n.params.variant)
  const byUser = new Map<ID, ID[]>()
  for (const n of added) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n.id])
  if (![...byUser.values()].some((ids) => ids.length > 1)) return
  commit('notification.batch', (tx) => {
    for (const [userId, ids] of byUser) {
      if (ids.length < 2) continue
      tx.db.notifications = tx.db.notifications.filter((n) => !ids.includes(n.id))
      notify(tx, userId, 'reassignment', { variant: 'reassignedBatch', count: ids.length, from: from.name, name: '' })
    }
  })
}

export function setAvailability(id: ID, availability: Availability, leaveUntil?: ISODate) {
  return commit('user.availability', (tx) => {
    const u = must(tx.db.users, id, 'user')
    assertActorCan(tx.actor, 'user.setAvailability', { ownerId: id }, tx.db)
    const from = u.availability
    u.availability = availability
    u.leaveUntil = availability === 'onLeave' ? leaveUntil : undefined
    if (from !== availability) tx.emit({ type: 'user.availabilityChanged', id, from, to: availability })
  })
}

/** Deactivates a user and redistributes their open leads: auto, to one person, or leave them unassigned. */
export function deactivateUser(id: ID, redistribute: Redistribute = 'auto') {
  const before = new Set(getDb().notifications.map((n) => n.id))
  const r = commit('user.deactivate', (tx) => {
    const u = must(tx.db.users, id, 'user')
    assertActorCan(tx.actor, 'user.manage')
    if (tx.actor.id === id) throw new Error('You cannot deactivate yourself')
    if (u.status === 'deactivated') return
    u.status = 'deactivated'
    u.deactivatedAt = tx.now
    tx.emit({ type: 'user.deactivated', id, redistribute })
  }, { undoable: true })
  batchReassignNotices(before, id)
  return r
}

export function activateUser(id: ID) {
  return commit('user.activate', (tx) => {
    const u = must(tx.db.users, id, 'user')
    assertActorCan(tx.actor, 'user.manage')
    u.status = 'active'
    u.deactivatedAt = undefined
    tx.emit({ type: 'user.activated', id })
  })
}
