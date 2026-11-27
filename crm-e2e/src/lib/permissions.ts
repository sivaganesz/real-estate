/**
 * The permission map (foundation-plan §3, ROLE_RESEARCH §6). Pure: no React, no store.
 *
 * Scope:
 *  - 'all'  any record
 *  - 'team' records owned by the manager's reports, the manager's own, plus unassigned records
 *  - 'own'  leads/tasks/appointments/clients: ownerId === user.id; properties: createdBy === user.id;
 *           user records (availability, preferences): pass `{ ownerId: targetUser.id }`
 *  - false  denied: the UI hides the control, the route shows NoAccess, services throw PermissionError
 *
 * UI code never checks `role === '…'`; it calls usePermission().can(action, record).
 */
import type { ActorId, DB, ID, Role, User } from '@/domain/types'

export const ACTIONS = [
  'user.manage', 'user.setAvailability', 'team.view', 'rules.configure',
  'settings.pipeline', 'settings.templates', 'settings.matching', 'settings.preferences', 'demo.reset',
  'lead.view', 'lead.create', 'lead.edit', 'lead.delete', 'lead.assign', 'lead.requestReassign', 'lead.moveStage',
  'lead.markBooked', 'lead.viewHni', 'lead.export', 'export.data',
  'client.view', 'client.edit',
  'property.view', 'property.create', 'property.edit', 'property.delete',
  'matching.run',
  'appointment.view', 'appointment.manage', 'task.view', 'task.manage',
  'import.leads', 'import.properties', 'import.document',
  'report.view', 'activity.viewLog', 'ai.use',
] as const
export type Action = (typeof ACTIONS)[number]
export type Scope = 'all' | 'team' | 'own' | false
export type Scoped = { ownerId?: ID | null; createdBy?: ActorId }

export const ROLES: Role[] = ['admin', 'manager', 'executive']

// One row per action: [admin, manager, executive]
const ROWS: Record<Action, [Scope, Scope, Scope]> = {
  'user.manage': ['all', false, false],
  'user.setAvailability': ['all', 'team', 'own'],
  'team.view': ['all', 'team', false],
  'rules.configure': ['all', 'team', false],
  'settings.pipeline': ['all', false, false],
  'settings.templates': ['all', false, false],
  'settings.matching': ['all', false, false],
  'settings.preferences': ['own', 'own', 'own'],
  'demo.reset': ['all', false, false],
  'lead.view': ['all', 'team', 'own'],
  'lead.create': ['all', 'all', 'all'],
  'lead.edit': ['all', 'team', 'own'],
  'lead.delete': ['all', 'team', false],
  'lead.assign': ['all', 'team', false],
  'lead.requestReassign': [false, false, 'own'],
  'lead.moveStage': ['all', 'team', 'own'],
  'lead.markBooked': ['all', 'team', 'own'],
  'lead.viewHni': ['all', 'all', false],
  'lead.export': ['all', 'team', false],
  'export.data': ['all', 'team', false],
  'client.view': ['all', 'team', 'own'],
  'client.edit': ['all', 'team', 'own'],
  'property.view': ['all', 'all', 'all'],
  'property.create': ['all', 'all', 'all'],
  'property.edit': ['all', 'all', 'own'],
  'property.delete': ['all', false, false],
  'matching.run': ['all', 'all', 'all'],
  'appointment.view': ['all', 'team', 'own'],
  'appointment.manage': ['all', 'team', 'own'],
  'task.view': ['all', 'team', 'own'],
  'task.manage': ['all', 'team', 'own'],
  'import.leads': ['all', 'all', false],
  'import.properties': ['all', false, false],
  'import.document': ['all', 'all', 'all'],
  'report.view': ['all', 'team', 'own'],
  'activity.viewLog': ['all', 'team', false],
  'ai.use': ['all', 'all', 'all'],
}

const column = (i: 0 | 1 | 2) =>
  Object.fromEntries(ACTIONS.map((a) => [a, ROWS[a][i]])) as Record<Action, Scope>

export const MATRIX: Record<Role, Record<Action, Scope>> = {
  admin: column(0),
  manager: column(1),
  executive: column(2),
}

export function scopeOf(user: Pick<User, 'role' | 'status'>, action: Action): Scope {
  if (user.status === 'deactivated') return false
  return MATRIX[user.role][action]
}

/** Actions on properties are owned through `createdBy`; everything else through `ownerId`. */
const ownedBy = (action: Action, record: Scoped): ActorId | null | undefined =>
  action.startsWith('property.') ? record.createdBy : record.ownerId

/**
 * Can this user do this action (on this record)?
 * - record omitted → true when the role has any scope (nav items, routes, "create" buttons)
 * - 'team' → the record is unassigned, the user's own, or owned by one of the user's reports (needs `db.users`)
 */
export function can(user: User, action: Action, record?: Scoped, db?: Pick<DB, 'users'>): boolean {
  const scope = scopeOf(user, action)
  if (scope === false) return false
  if (!record || scope === 'all') return true
  const owner = ownedBy(action, record)
  if (scope === 'own') return owner === user.id
  // team
  if (owner == null || owner === user.id) return true
  if (owner === 'system') return false
  const ownerUser = db?.users.find((u) => u.id === owner)
  return ownerUser?.managerId === user.id
}

/** Why an action is denied: an i18n key in the `shell` namespace plus its params. Used by NoAccess and AI refusals. */
export function explainDenied(user: Pick<User, 'role' | 'status'>, action: Action): { reasonKey: string; params: Record<string, string> } {
  if (user.status === 'deactivated') return { reasonKey: 'shell:denied.deactivated', params: { action } }
  const scope = scopeOf(user, action)
  if (scope === false) {
    const specific: Partial<Record<Action, string>> = {
      'lead.assign': 'shell:denied.leadAssign',
      'lead.delete': 'shell:denied.leadDelete',
      'lead.viewHni': 'shell:denied.leadViewHni',
      'import.properties': 'shell:denied.importProperties',
      'team.view': 'shell:denied.teamView',
      'property.delete': 'shell:denied.propertyDelete',
      'user.manage': 'shell:denied.userManage',
    }
    return { reasonKey: specific[action] ?? 'shell:denied.role', params: { role: user.role, action } }
  }
  return { reasonKey: scope === 'own' ? 'shell:denied.notOwn' : 'shell:denied.notTeam', params: { role: user.role, action } }
}

export class PermissionError extends Error {
  readonly action: Action
  readonly reasonKey: string
  readonly params: Record<string, string>
  constructor(action: Action, reason: { reasonKey: string; params: Record<string, string> }) {
    super(`Permission denied: ${action}`)
    this.name = 'PermissionError'
    this.action = action
    this.reasonKey = reason.reasonKey
    this.params = reason.params
  }
}

/** Services call this before every write. Throws PermissionError (the UI turns it into a toast). */
export function assertCan(user: User, action: Action, record?: Scoped, db?: Pick<DB, 'users'>): void {
  if (!can(user, action, record, db)) throw new PermissionError(action, explainDenied(user, action))
}
