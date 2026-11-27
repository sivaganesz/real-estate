/**
 * Users: add, edit, availability, deactivate (with redistribution of open leads, E14) and activate.
 * Going on leave asks the manager to reassign (E15); the engine skips on-leave and deactivated users.
 */
import type { Availability, ID, ISODate, User } from '@/domain/types'
import { isEmail } from '@/lib/validation'
import { toE164 } from '@/lib/phone'
import { assertActorCan } from './core/actor'
import { commit, must } from './core/commit'
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
    const fields = Object.keys(patch).filter((k) => patch[k as keyof UserPatch] !== undefined)
    Object.assign(u, patch)
    if (patch.phone) u.phone = toE164(patch.phone) || patch.phone
    tx.emit({ type: 'user.updated', id, fields })
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
  return commit('user.deactivate', (tx) => {
    const u = must(tx.db.users, id, 'user')
    assertActorCan(tx.actor, 'user.manage')
    if (tx.actor.id === id) throw new Error('You cannot deactivate yourself')
    if (u.status === 'deactivated') return
    u.status = 'deactivated'
    u.deactivatedAt = tx.now
    tx.emit({ type: 'user.deactivated', id, redistribute })
  }, { undoable: true })
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
