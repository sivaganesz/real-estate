/**
 * Roles and permissions (PRD v2 §4, TRD §6.1).
 *
 * Permissions are a fixed catalogue defined here: the API enforces them on every route and
 * the admin UI uses them to show or hide menus and buttons. Admins can't invent new ones.
 *
 * Roles are data (the `roles` collection): three system roles (Admin, Sales Manager,
 * Sales Executive) plus any custom roles the Admin creates. Admin always has every
 * permission. Managing users and roles is reserved for Admin.
 */

export const PERMISSIONS = [
  'users:manage',
  'roles:manage',
  'settings:edit',
  'rules:edit',
  'properties:read',
  'properties:write',
  'properties:archive',
  'properties:delete',
  'imports:run',
  'customers:read:own',
  'customers:read:all',
  'customers:write:own',
  'customers:write:all',
  'customers:assign',
  'hni:read',
  'hni:write',
  'appointments:read:own',
  'appointments:read:all',
  'appointments:write',
  'reports:read:own',
  'reports:read:all',
  // v1 Perfox views (Leads, Conversations, Call logs); replaced by customers in R3.
  'leads:read',
  'conversations:read',
  'calls:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_GROUPS = [
  'Users & settings',
  'Properties',
  'Leads & customers',
  'Appointments',
  'Reports',
] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export interface PermissionInfo {
  label: string;
  group: PermissionGroup;
  /** Shown with a warning when ticked in the role editor (ROLE-04). */
  sensitive?: boolean;
  /** Admin only: can't be given to any other role (ROLE-03). */
  reserved?: boolean;
}

export const PERMISSION_INFO: Record<Permission, PermissionInfo> = {
  'users:manage': { label: 'Invite and manage users', group: 'Users & settings', reserved: true },
  'roles:manage': { label: 'Create and edit roles', group: 'Users & settings', reserved: true },
  'settings:edit': {
    label: 'Edit settings (company, property types, legal checklists, valuation costs)',
    group: 'Users & settings',
  },
  'rules:edit': {
    label: 'Edit sales rules (scoring, bands, thresholds, executives)',
    group: 'Users & settings',
  },
  'properties:read': { label: 'View properties', group: 'Properties' },
  'properties:write': {
    label: 'Add and edit properties (status, location, legal, valuation, media)',
    group: 'Properties',
  },
  'properties:archive': { label: 'Archive and restore properties', group: 'Properties' },
  'properties:delete': { label: 'Delete properties', group: 'Properties', sensitive: true },
  'imports:run': { label: 'Bulk import', group: 'Properties', sensitive: true },
  'customers:read:own': { label: 'View own leads', group: 'Leads & customers' },
  'customers:read:all': { label: 'View all leads', group: 'Leads & customers' },
  'customers:write:own': { label: 'Edit own leads', group: 'Leads & customers' },
  'customers:write:all': { label: 'Edit all leads', group: 'Leads & customers' },
  'customers:assign': { label: 'Reassign leads', group: 'Leads & customers' },
  'hni:read': { label: 'View HNI assessment', group: 'Leads & customers', sensitive: true },
  'hni:write': { label: 'Edit HNI assessment', group: 'Leads & customers', sensitive: true },
  'appointments:read:own': { label: 'View own appointments', group: 'Appointments' },
  'appointments:read:all': { label: 'View all appointments', group: 'Appointments' },
  'appointments:write': { label: 'Book and edit appointments', group: 'Appointments' },
  'reports:read:own': { label: 'Own figures', group: 'Reports' },
  'reports:read:all': { label: 'All reports', group: 'Reports' },
  'leads:read': { label: 'View Perfox leads (v1)', group: 'Leads & customers' },
  'conversations:read': { label: 'View conversations (v1)', group: 'Leads & customers' },
  'calls:read': { label: 'View call logs (v1)', group: 'Leads & customers' },
};

/** Areas with a None / Own / All choice in the role editor (ROLE-04). */
export const SCOPED_AREAS = [
  {
    key: 'customers',
    label: 'Leads & customers',
    own: ['customers:read:own', 'customers:write:own'],
    all: ['customers:read:all', 'customers:write:all'],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    own: ['appointments:read:own'],
    all: ['appointments:read:all'],
  },
  { key: 'reports', label: 'Reports', own: ['reports:read:own'], all: ['reports:read:all'] },
] as const satisfies readonly {
  key: string;
  label: string;
  own: readonly Permission[];
  all: readonly Permission[];
}[];
export type ScopeLevel = 'none' | 'own' | 'all';

export const RESERVED_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter(
  (p) => PERMISSION_INFO[p].reserved,
);

// ------------------------------------------------------------------ system roles

export const SYSTEM_ROLE_KEYS = ['admin', 'sales_manager', 'sales_executive'] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];
/** A role key: a system role, or `r_<uuid>` for a custom role. */
export type RoleKey = string;
export const ADMIN_ROLE: SystemRoleKey = 'admin';

export interface SystemRoleDefinition {
  name: string;
  description: string;
  /** Default permissions; Admin's are always the whole catalogue. */
  permissions: readonly Permission[];
}

export const SYSTEM_ROLES: Record<SystemRoleKey, SystemRoleDefinition> = {
  admin: {
    name: 'Admin',
    description: 'Owner / office administrator. Everything, including users and roles.',
    permissions: PERMISSIONS,
  },
  sales_manager: {
    name: 'Sales Manager',
    description:
      'Sales head. All leads, pipeline, reassignment, sales rules, HNI, reports, and property archive/delete.',
    permissions: [
      'rules:edit',
      'properties:read',
      'properties:archive',
      'properties:delete',
      'customers:read:all',
      'customers:write:all',
      'customers:assign',
      'hni:read',
      'hni:write',
      'appointments:read:all',
      'appointments:write',
      'reports:read:all',
      'leads:read',
      'conversations:read',
      'calls:read',
    ],
  },
  sales_executive: {
    name: 'Sales Executive',
    description:
      'Field / tele sales. Views properties; manages own leads, follow-ups and appointments.',
    permissions: [
      'properties:read',
      'customers:read:own',
      'customers:write:own',
      'appointments:read:own',
      'appointments:write',
      'reports:read:own',
      'leads:read',
      'conversations:read',
      'calls:read',
    ],
  },
};

export function isSystemRole(key: string): key is SystemRoleKey {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(key);
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Cleans a permission list for storage: known permissions only, no duplicates, in
 * catalogue order, and for scoped areas "all" replaces "own". Reserved permissions are
 * kept only for Admin (callers reject them before this for other roles).
 */
export function normalizePermissions(
  permissions: readonly string[],
  { allowReserved = false } = {},
): Permission[] {
  const set = new Set(permissions.filter(isPermission));
  for (const area of SCOPED_AREAS) {
    if (area.all.some((p) => set.has(p))) {
      for (const p of area.own) set.delete(p);
    }
  }
  if (!allowReserved) for (const p of RESERVED_PERMISSIONS) set.delete(p);
  return PERMISSIONS.filter((p) => set.has(p));
}

/** Effective permissions of a role: Admin always has the whole catalogue (ROLE-02). */
export function effectivePermissions(key: RoleKey, stored: readonly Permission[]): Permission[] {
  if (key === ADMIN_ROLE) return [...PERMISSIONS];
  return normalizePermissions(stored);
}

/** None / Own / All for a scoped area, from a permission list. */
export function scopeLevel(
  permissions: readonly Permission[],
  area: (typeof SCOPED_AREAS)[number],
): ScopeLevel {
  if (area.all.every((p) => permissions.includes(p))) return 'all';
  if (area.own.every((p) => permissions.includes(p))) return 'own';
  return 'none';
}
