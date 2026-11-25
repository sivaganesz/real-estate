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

/** Each permission in plain words, grouped for the Settings page. */
export const PERMISSION_INFO: Record<Permission, { group: string; label: string }> = {
  'property.view': { group: 'Properties & projects', label: 'See properties and projects' },
  'property.share': { group: 'Properties & projects', label: 'Share properties with buyers' },
  'property.create': { group: 'Properties & projects', label: 'Add properties' },
  'property.edit': { group: 'Properties & projects', label: 'Edit properties, see drafts' },
  'property.publish': { group: 'Properties & projects', label: 'Publish and unpublish' },
  'property.availability': { group: 'Properties & projects', label: 'Change availability (hold, sold)' },
  'property.import': { group: 'Properties & projects', label: 'Import owner sheets and brochures' },
  'project.manage': { group: 'Properties & projects', label: 'Create and edit projects' },
  'lead.viewAll': { group: 'Customers', label: "See every salesperson's customers" },
  'lead.create': { group: 'Customers', label: 'Add customers' },
  'lead.assign': { group: 'Customers', label: 'Assign customers to salespeople' },
  'lead.editOwn': { group: 'Customers', label: 'Work their own customers (calls, visits, notes)' },
  'activity.viewAll': { group: 'Customers', label: "See the whole team's calendar" },
  'deal.create': { group: 'Deals', label: 'Start negotiations and record offers' },
  'deal.approve': { group: 'Deals', label: 'Approve discounts above the limit' },
  'deal.book': { group: 'Deals', label: 'Confirm bookings, payments and registration' },
  'team.view': { group: 'Team & admin', label: 'See team performance' },
  'settings.manage': { group: 'Team & admin', label: 'Change settings and approval limits' },
  'users.manage': { group: 'Team & admin', label: 'Add people and change roles' },
};
