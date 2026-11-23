import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { ROLES } from '@estate/shared';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    role: { type: String, enum: ROLES, required: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    passwordHash: { type: String, required: true, select: false },
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User = mongoose.model('User', userSchema);

export function publicUser(u: { _id: unknown; name: string; email: string; phone?: string | null; role: string; active?: boolean; managerId?: unknown }) {
  return { id: String(u._id), name: u.name, email: u.email, phone: u.phone ?? '', role: u.role, active: u.active ?? true, managerId: u.managerId ? String(u.managerId) : null };
}
