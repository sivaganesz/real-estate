/**
 * Fixed roles and permissions (TRD §6.3). Roles live in code, not in the database.
 * The API checks permissions on every protected route; the admin UI uses the same
 * list to show or hide menus and buttons.
 */

export const ROLES = ['super_admin', 'admin', 'sales_agent'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  sales_agent: 'Sales Agent',
};

export const PERMISSIONS = [
  'users:manage',
  'settings:edit',
  'properties:read',
  'properties:write',
  'imports:run',
  'appointments:read:all',
  'appointments:read:own',
  'appointments:write',
  'leads:read',
  'conversations:read',
  'calls:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: [
    'settings:edit',
    'properties:read',
    'properties:write',
    'imports:run',
    'appointments:read:all',
    'appointments:write',
    'leads:read',
    'conversations:read',
    'calls:read',
  ],
  sales_agent: [
    'properties:read',
    'appointments:read:own',
    'appointments:write',
    'leads:read',
    'conversations:read',
    'calls:read',
  ],
};

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
