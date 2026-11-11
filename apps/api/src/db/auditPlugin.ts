import type { Schema } from 'mongoose';
import { refField } from './ids';

/**
 * Adds `createdBy` / `updatedBy` (user ids) to a schema. Combine with
 * `{ timestamps: true }` for `createdAt` / `updatedAt` (TRD §5.5).
 */
export function auditPlugin(schema: Schema): void {
  schema.add({
    createdBy: refField('User'),
    updatedBy: refField('User'),
  });
}
