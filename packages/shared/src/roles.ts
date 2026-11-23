export const ROLES = ['admin', 'manager', 'executive'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Sales manager',
  executive: 'Sales executive',
};

/**
 * One permission list for the whole product. Screens, API routes and the AI
 * assistant's tools all ask the same question: can(role, action).
 */
export const PERMISSIONS = {
  // Properties & projects
  'property.view': ['admin', 'manager', 'executive'],
  'property.share': ['admin', 'manager', 'executive'],
  'property.create': ['admin', 'manager'],
  'property.edit': ['admin', 'manager'],
  'property.publish': ['admin', 'manager'],
  'property.availability': ['admin', 'manager'],
  'property.import': ['admin', 'manager'],
  'project.manage': ['admin', 'manager'],
  // Leads
  'lead.viewAll': ['admin', 'manager'],
  'lead.create': ['admin', 'manager', 'executive'],
  'lead.assign': ['admin', 'manager'],
  'lead.editOwn': ['admin', 'manager', 'executive'],
  // Activities
  'activity.viewAll': ['admin', 'manager'],
  // Deals
  'deal.create': ['admin', 'manager', 'executive'],
  'deal.approve': ['admin', 'manager'],
  'deal.book': ['admin', 'manager'],
  // Team & admin
  'team.view': ['admin', 'manager'],
  'settings.manage': ['admin'],
  'users.manage': ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
