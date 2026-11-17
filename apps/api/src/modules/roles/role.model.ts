import { PERMISSIONS } from '@real-estate/shared';
import type { Permission } from '@real-estate/shared';
import { model, Schema } from 'mongoose';
import { auditFields } from '../../db/auditPlugin';
import { idField } from '../../db/ids';
import { versionPlugin } from '../../db/versionPlugin';

/**
 * Roles (TRD §7.14). `users.role` holds the role `key`. System roles (admin,
 * sales_manager, sales_executive) are created by migration 0002 and can't be renamed or
 * deleted; Admin's permissions are computed (always all), never stored.
 */
const roleSchema = new Schema(
  {
    _id: idField,
    key: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    system: { type: Boolean, default: false },
    permissions: { type: [String], enum: PERMISSIONS, default: [] },
    /** Touched by the last-Admin guard so concurrent demotions conflict (ROLE-02). */
    guardAt: { type: Date, default: null },
    ...auditFields,
  },
  { timestamps: true },
);

roleSchema.plugin(versionPlugin);
roleSchema.index({ key: 1 }, { unique: true });
// Names are unique regardless of case ("Office staff" = "office STAFF").
roleSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const RoleModel = model('Role', roleSchema);

export interface RoleDoc {
  _id: string;
  key: string;
  name: string;
  description: string;
  system: boolean;
  permissions: Permission[];
  version?: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
