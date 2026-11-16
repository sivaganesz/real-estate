import { z } from 'zod';
import { PERMISSION_GROUPS, PERMISSIONS } from '../roles';
import { idSchema } from './common';

/** A role key: `admin`, `sales_manager`, `sales_executive`, or `r_<id>` for a custom role. */
export const roleKeySchema = z
  .string('Choose a role')
  .regex(/^[a-z][a-z0-9_-]{1,59}$/, 'Choose a role')
  .meta({ example: 'sales_executive' });

const permissionListSchema = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length * 2);

const roleNameSchema = z
  .string()
  .trim()
  .min(2, 'Role name must be at least 2 characters')
  .max(40, 'Role name must be at most 40 characters');

/** A role as shown on Users & Roles → Roles (ROLE-08). */
export const roleSchema = z.object({
  key: roleKeySchema,
  name: z.string(),
  description: z.string(),
  system: z.boolean().meta({ description: 'Admin, Sales Manager and Sales Executive' }),
  /** Effective permissions (Admin: always all). */
  permissions: z.array(z.enum(PERMISSIONS)),
  /** True when the permissions differ from the system defaults (Sales Manager / Executive). */
  customised: z.boolean(),
  userCount: z.number().int(),
  updatedAt: z.string().nullable(),
  updatedBy: z.object({ id: idSchema, name: z.string() }).nullable(),
  version: z.number().int(),
});
export type RoleInfo = z.infer<typeof roleSchema>;

/** Slim list for role pickers (Invite user, Edit user, filters). */
export const roleOptionSchema = roleSchema.pick({
  key: true,
  name: true,
  description: true,
  system: true,
});
export type RoleOption = z.infer<typeof roleOptionSchema>;

/** GET /admin/permissions: the fixed catalogue the role editor offers (ROLE-07). */
export const permissionCatalogSchema = z.object({
  groups: z.array(z.enum(PERMISSION_GROUPS)),
  permissions: z.array(
    z.object({
      key: z.enum(PERMISSIONS),
      label: z.string(),
      group: z.enum(PERMISSION_GROUPS),
      sensitive: z.boolean(),
      reserved: z.boolean(),
    }),
  ),
  scopedAreas: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      own: z.array(z.enum(PERMISSIONS)),
      all: z.array(z.enum(PERMISSIONS)),
    }),
  ),
});
export type PermissionCatalog = z.infer<typeof permissionCatalogSchema>;

/** POST /admin/roles (ROLE-04) */
export const createRoleBodySchema = z.object({
  name: roleNameSchema,
  description: z.string().trim().max(200).default(''),
  permissions: permissionListSchema.default([]),
});
export type CreateRoleBody = z.input<typeof createRoleBodySchema>;

/** PATCH /admin/roles/:key (ROLE-05). System roles accept `permissions` only. */
export const updateRoleBodySchema = z.object({
  name: roleNameSchema.optional(),
  description: z.string().trim().max(200).optional(),
  permissions: permissionListSchema.optional(),
});
export type UpdateRoleBody = z.input<typeof updateRoleBodySchema>;

/** POST /admin/roles/:key/move-users (ROLE-06) */
export const moveRoleUsersBodySchema = z.object({ toRole: roleKeySchema });
export type MoveRoleUsersBody = z.infer<typeof moveRoleUsersBodySchema>;
