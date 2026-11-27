import { describe, expect, it } from 'vitest'
import type { Role, User } from '@/domain/types'
import { ACTIONS, MATRIX, PermissionError, assertCan, can, explainDenied, scopeOf, type Action, type Scope } from './permissions'

// The matrix from foundation-plan §3.1, written out again independently so a typo in permissions.ts is caught.
const EXPECTED: Record<Action, Record<Role, Scope>> = {
  'user.manage': { admin: 'all', manager: false, executive: false },
  'user.setAvailability': { admin: 'all', manager: 'team', executive: 'own' },
  'team.view': { admin: 'all', manager: 'team', executive: false },
  'rules.configure': { admin: 'all', manager: 'team', executive: false },
  'settings.pipeline': { admin: 'all', manager: false, executive: false },
  'settings.templates': { admin: 'all', manager: false, executive: false },
  'settings.matching': { admin: 'all', manager: false, executive: false },
  'settings.preferences': { admin: 'own', manager: 'own', executive: 'own' },
  'demo.reset': { admin: 'all', manager: false, executive: false },
  'lead.view': { admin: 'all', manager: 'team', executive: 'own' },
  'lead.create': { admin: 'all', manager: 'all', executive: 'all' },
  'lead.edit': { admin: 'all', manager: 'team', executive: 'own' },
  'lead.delete': { admin: 'all', manager: 'team', executive: false },
  'lead.assign': { admin: 'all', manager: 'team', executive: false },
  'lead.requestReassign': { admin: false, manager: false, executive: 'own' },
  'lead.moveStage': { admin: 'all', manager: 'team', executive: 'own' },
  'lead.markBooked': { admin: 'all', manager: 'team', executive: 'own' },
  'lead.viewHni': { admin: 'all', manager: 'all', executive: false },
  'lead.export': { admin: 'all', manager: 'team', executive: false },
  'export.data': { admin: 'all', manager: 'team', executive: false },
  'client.view': { admin: 'all', manager: 'team', executive: 'own' },
  'client.edit': { admin: 'all', manager: 'team', executive: 'own' },
  'property.view': { admin: 'all', manager: 'all', executive: 'all' },
  'property.create': { admin: 'all', manager: 'all', executive: 'all' },
  'property.edit': { admin: 'all', manager: 'all', executive: 'own' },
  'property.delete': { admin: 'all', manager: false, executive: false },
  'matching.run': { admin: 'all', manager: 'all', executive: 'all' },
  'appointment.view': { admin: 'all', manager: 'team', executive: 'own' },
  'appointment.manage': { admin: 'all', manager: 'team', executive: 'own' },
  'task.view': { admin: 'all', manager: 'team', executive: 'own' },
  'task.manage': { admin: 'all', manager: 'team', executive: 'own' },
  'import.leads': { admin: 'all', manager: 'all', executive: false },
  'import.properties': { admin: 'all', manager: false, executive: false },
  'import.document': { admin: 'all', manager: 'all', executive: 'all' },
  'report.view': { admin: 'all', manager: 'team', executive: 'own' },
  'activity.viewLog': { admin: 'all', manager: 'team', executive: false },
  'ai.use': { admin: 'all', manager: 'all', executive: 'all' },
}

const mk = (id: string, role: Role, managerId?: string): User => ({
  id, name: id, role, managerId, email: `${id}@example.com`, phone: '+919845000000', status: 'active',
  availability: 'available', languages: ['English'], cities: [], propertyFocus: [], joinedAt: '2025-01-01',
})
const admin = mk('u-admin', 'admin')
const manager = mk('u-rohit', 'manager')
const otherManager = mk('u-other', 'manager')
const arjun = mk('u-arjun', 'executive', 'u-rohit')
const sneha = mk('u-sneha', 'executive', 'u-rohit')
const outsider = mk('u-out', 'executive', 'u-other')
const db = { users: [admin, manager, otherManager, arjun, sneha, outsider] }
const byRole: Record<Role, User> = { admin, manager, executive: arjun }

describe('permission matrix', () => {
  it('covers every action exactly once', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ACTIONS].sort())
  })

  for (const action of ACTIONS) {
    for (const role of ['admin', 'manager', 'executive'] as Role[]) {
      it(`${role} · ${action} = ${String(EXPECTED[action][role])}`, () => {
        expect(MATRIX[role][action]).toBe(EXPECTED[action][role])
        expect(scopeOf(byRole[role], action)).toBe(EXPECTED[action][role])
        expect(can(byRole[role], action)).toBe(EXPECTED[action][role] !== false)
      })
    }
  }
})

describe('record scope', () => {
  it('own: executives act only on their own leads', () => {
    expect(can(arjun, 'lead.edit', { ownerId: 'u-arjun' })).toBe(true)
    expect(can(arjun, 'lead.edit', { ownerId: 'u-sneha' })).toBe(false)
    expect(can(arjun, 'lead.edit', { ownerId: null })).toBe(false)
  })

  it('own on properties uses createdBy', () => {
    expect(can(arjun, 'property.edit', { createdBy: 'u-arjun' })).toBe(true)
    expect(can(arjun, 'property.edit', { createdBy: 'u-admin' })).toBe(false)
    expect(can(manager, 'property.edit', { createdBy: 'u-arjun' })).toBe(true)
  })

  it('team: reports, own and unassigned records, never another team', () => {
    expect(can(manager, 'lead.assign', { ownerId: 'u-arjun' }, db)).toBe(true)
    expect(can(manager, 'lead.assign', { ownerId: null }, db)).toBe(true)
    expect(can(manager, 'lead.assign', { ownerId: 'u-rohit' }, db)).toBe(true)
    expect(can(manager, 'lead.assign', { ownerId: 'u-out' }, db)).toBe(false)
    expect(can(manager, 'lead.assign', { ownerId: 'system' }, db)).toBe(false)
  })

  it('team on users: a manager sets availability for reports only', () => {
    expect(can(manager, 'user.setAvailability', { ownerId: 'u-sneha' }, db)).toBe(true)
    expect(can(manager, 'user.setAvailability', { ownerId: 'u-out' }, db)).toBe(false)
    expect(can(arjun, 'user.setAvailability', { ownerId: 'u-arjun' }, db)).toBe(true)
    expect(can(arjun, 'user.setAvailability', { ownerId: 'u-sneha' }, db)).toBe(false)
  })

  it('all ignores the record', () => {
    expect(can(admin, 'lead.delete', { ownerId: 'u-out' }, db)).toBe(true)
    expect(can(outsider, 'property.view', { createdBy: 'u-admin' }, db)).toBe(true)
  })

  it('a deactivated user can do nothing', () => {
    const gone: User = { ...arjun, status: 'deactivated' }
    expect(can(gone, 'lead.view')).toBe(false)
    expect(explainDenied(gone, 'lead.view').reasonKey).toBe('shell:denied.deactivated')
  })
})

describe('denials', () => {
  it('explains a role denial with a specific key when there is one', () => {
    expect(explainDenied(arjun, 'lead.assign')).toEqual({ reasonKey: 'shell:denied.leadAssign', params: { role: 'executive', action: 'lead.assign' } })
    expect(explainDenied(manager, 'demo.reset').reasonKey).toBe('shell:denied.role')
    expect(explainDenied(arjun, 'lead.edit').reasonKey).toBe('shell:denied.notOwn')
    expect(explainDenied(manager, 'lead.edit').reasonKey).toBe('shell:denied.notTeam')
  })

  it('assertCan throws PermissionError', () => {
    expect(() => assertCan(arjun, 'lead.delete')).toThrow(PermissionError)
    expect(() => assertCan(arjun, 'lead.edit', { ownerId: 'u-arjun' })).not.toThrow()
  })
})
