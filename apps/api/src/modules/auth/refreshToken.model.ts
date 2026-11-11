import { model, Schema } from 'mongoose';
import { idField, refField } from '../../db/ids';

/**
 * Refresh tokens (TRD §7.2). Only the SHA-256 hash is stored. Every refresh replaces the
 * token with a new one in the same `familyId`; reusing an old token revokes the family.
 */
const refreshTokenSchema = new Schema(
  {
    _id: idField,
    userId: { ...refField('User'), required: true },
    tokenHash: { type: String, required: true },
    familyId: { type: String, required: true },
    sessionStartedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
refreshTokenSchema.index({ userId: 1, revokedAt: 1 });
refreshTokenSchema.index({ familyId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
