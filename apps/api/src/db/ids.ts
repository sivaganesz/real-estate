import { v7 as uuidv7 } from 'uuid';

/**
 * Every record id is a UUID v7 stored as a string (not a MongoDB ObjectId). v7 ids are
 * time-ordered, so they sort by creation time and keep indexes compact.
 */
export function newId(): string {
  return uuidv7();
}

/** Use as the `_id` field in every schema: `{ _id: idField, ... }`. */
export const idField = { type: String, default: newId } as const;

/** A reference to another record, e.g. `createdBy: refField('User')`. */
export function refField(model: string) {
  return { type: String, ref: model } as const;
}
