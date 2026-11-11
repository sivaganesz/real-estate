import { refField } from './ids';

/**
 * `createdBy` / `updatedBy` (user ids). Spread into a schema definition
 * (`{ ...auditFields }`) so TypeScript infers them; combine with `{ timestamps: true }`
 * for `createdAt` / `updatedAt` (TRD §5.5).
 */
export const auditFields = {
  createdBy: refField('User'),
  updatedBy: refField('User'),
} as const;
