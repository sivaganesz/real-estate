import { ROLES } from '@real-estate/shared';
import { model, Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';
import { auditPlugin } from '../../db/auditPlugin';

export const USER_STATUSES = ['invited', 'active', 'inactive'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Staff users (TRD §7.1). Auth fields are used from Phase 1 step 1.3 onwards. */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    role: { type: String, required: true, enum: ROLES },
    status: { type: String, required: true, enum: USER_STATUSES, default: 'invited' },
    passwordHash: { type: String, select: false },
    lastLoginAt: { type: Date },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  { timestamps: true },
);

userSchema.plugin(auditPlugin);
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
