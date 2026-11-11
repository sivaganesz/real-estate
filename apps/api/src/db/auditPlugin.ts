import { Schema } from 'mongoose';

/**
 * Adds `createdBy` / `updatedBy` (user ids) to a schema. Combine with
 * `{ timestamps: true }` for `createdAt` / `updatedAt` (TRD §5.5).
 */
export function auditPlugin(schema: Schema): void {
  schema.add({
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  });
}
