import { ROLES, ROLE_PERMISSIONS } from './roles';
import type { Role } from './roles';

/** Cell in the read-only "what each role can do" table. */
export type RoleAccess = 'full' | 'none' | 'own' | 'view';

export interface RoleMatrixRow {
  module: string;
  /** Phase in which the module is delivered (1 = available now). */
  phase: 1 | 2 | 3;
  access: Record<Role, RoleAccess>;
}

const has = (role: Role, permission: (typeof ROLE_PERMISSIONS)[Role][number]) =>
  ROLE_PERMISSIONS[role].includes(permission);

function row(
  module: string,
  phase: RoleMatrixRow['phase'],
  cell: (role: Role) => RoleAccess,
): RoleMatrixRow {
  return {
    module,
    phase,
    access: Object.fromEntries(ROLES.map((role) => [role, cell(role)])) as Record<Role, RoleAccess>,
  };
}

/**
 * The permission table shown on Users & Roles → Roles & permissions (PRD §4.1),
 * derived from ROLE_PERMISSIONS so it can never drift from what the API enforces.
 */
export const ROLE_MATRIX: RoleMatrixRow[] = [
  row('Users & Roles', 1, (r) => (has(r, 'users:manage') ? 'full' : 'none')),
  row('Settings', 1, (r) => (has(r, 'settings:edit') ? 'full' : 'none')),
  row('My Profile', 1, () => 'full'),
  row('Properties: view', 2, (r) => (has(r, 'properties:read') ? 'full' : 'none')),
  row('Properties: add / edit / publish, Bulk Import', 2, (r) =>
    has(r, 'properties:write') && has(r, 'imports:run') ? 'full' : 'none',
  ),
  row('Appointments', 3, (r) =>
    has(r, 'appointments:read:all') ? 'full' : has(r, 'appointments:read:own') ? 'own' : 'none',
  ),
  row('Leads, Conversations, Call Logs', 3, (r) =>
    has(r, 'users:manage') || has(r, 'settings:edit')
      ? 'full'
      : has(r, 'leads:read')
        ? 'view'
        : 'none',
  ),
];
