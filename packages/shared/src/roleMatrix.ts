import type { Permission } from './roles';

/** Cell in the "what each role can do" table. */
export type RoleAccess = 'full' | 'none' | 'own' | 'view';

export interface RoleMatrixRow {
  module: string;
  /** Release that delivers the module (R0 = available now). */
  release: string;
  /** Access per role key. */
  access: Record<string, RoleAccess>;
}

type Rule = (has: (p: Permission) => boolean) => RoleAccess;

const yes = (ok: boolean): RoleAccess => (ok ? 'full' : 'none');
const scoped =
  (all: Permission, own: Permission): Rule =>
  (has) =>
    has(all) ? 'full' : has(own) ? 'own' : 'none';

/** The rows of PRD v2 §4.1, each derived from permissions. */
const ROWS: { module: string; release: string; rule: Rule }[] = [
  { module: 'Users & Roles', release: 'R0', rule: (has) => yes(has('users:manage')) },
  { module: 'Settings', release: 'R0', rule: (has) => yes(has('settings:edit')) },
  {
    module: 'Settings → Sales rules',
    release: 'R3',
    rule: (has) => (has('rules:edit') ? 'full' : 'view'),
  },
  { module: 'Properties: view', release: 'R0', rule: (has) => yes(has('properties:read')) },
  {
    module: 'Properties: add, edit, status, legal, valuation',
    release: 'R0',
    rule: (has) => yes(has('properties:write')),
  },
  {
    module: 'Properties: archive / restore',
    release: 'R1',
    rule: (has) => yes(has('properties:archive')),
  },
  { module: 'Properties: delete', release: 'R1', rule: (has) => yes(has('properties:delete')) },
  { module: 'Bulk import', release: 'R0', rule: (has) => yes(has('imports:run')) },
  {
    module: 'Leads / customers',
    release: 'R3',
    rule: scoped('customers:read:all', 'customers:read:own'),
  },
  { module: 'Reassign leads', release: 'R3', rule: (has) => yes(has('customers:assign')) },
  { module: 'HNI assessment', release: 'R8', rule: (has) => yes(has('hni:read')) },
  {
    module: 'Appointments',
    release: 'R6',
    rule: scoped('appointments:read:all', 'appointments:read:own'),
  },
  {
    module: 'Dashboard & reports',
    release: 'R7',
    rule: scoped('reports:read:all', 'reports:read:own'),
  },
];

/**
 * The permission table on Users & Roles → Roles, one column per role (ROLE-08). Derived
 * from each role's effective permissions, so it can never drift from what the API enforces.
 */
export function buildRoleMatrix(
  roles: readonly { key: string; permissions: readonly Permission[] }[],
): RoleMatrixRow[] {
  return ROWS.map(({ module, release, rule }) => ({
    module,
    release,
    access: Object.fromEntries(
      roles.map((role) => [role.key, rule((p) => role.permissions.includes(p))]),
    ),
  }));
}
