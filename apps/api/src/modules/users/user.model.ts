import { ROLES, USER_STATUSES } from '@real-estate/shared';
import { model, Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';
import { auditFields } from '../../db/auditPlugin';
import { idField } from '../../db/ids';

/** Staff users (TRD §7.1). */
const userSchema = new Schema(
  {
    _id: idField,
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    role: { type: String, required: true, enum: ROLES },
    status: { type: String, required: true, enum: USER_STATUSES, default: 'invited' },
    passwordHash: { type: String, select: false },
    lastLoginAt: { type: Date },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    ...auditFields,
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
