import { model, Schema } from 'mongoose';
import { idField, refField } from '../../db/ids';

export const AUTH_TOKEN_TYPES = ['invite', 'password_reset'] as const;
export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

/**
 * One-time links sent by email: invites (72 h) and password resets (1 h) (TRD §7.3).
 * Only the SHA-256 hash is stored; each token can be used once.
 */
const authTokenSchema = new Schema(
  {
    _id: idField,
    userId: { ...refField('User'), required: true },
    type: { type: String, required: true, enum: AUTH_TOKEN_TYPES },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

authTokenSchema.index({ tokenHash: 1 }, { unique: true });
authTokenSchema.index({ userId: 1, type: 1 });
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthTokenModel = model('AuthToken', authTokenSchema);
