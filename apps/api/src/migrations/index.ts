import { ensureStartingPropertyTypes } from '../modules/propertyTypes/propertyTypes.defaults';
import { RolesService } from '../modules/roles/roles.service';
import { UserModel } from '../modules/users/user.model';
import type { Migration } from './runner';

/**
 * Every migration, in order. Append new ones; never edit or reorder one that has shipped.
 * `pnpm migrate` applies the pending ones (TRD §7.13).
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    id: '0001-starting-property-types',
    description: 'Starting property types and amenities (previously created at every boot)',
    up: async () => {
      await ensureStartingPropertyTypes();
    },
  },
  {
    id: '0002-roles',
    description:
      'Roles in the database: Admin, Sales Manager, Sales Executive (D4). Super Admin → Admin, Sales Agent → Sales Executive',
    // No down step: after it, former Super Admins and office Admins are both "admin".
    up: async () => {
      await RolesService.ensureSystemRoles();
      await UserModel.updateMany({ role: 'super_admin' }, { $set: { role: 'admin' } });
      await UserModel.updateMany({ role: 'sales_agent' }, { $set: { role: 'sales_executive' } });
    },
  },
];
