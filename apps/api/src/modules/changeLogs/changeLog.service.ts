import type { Types } from 'mongoose';
import type { ChangeEntity } from './changeLog.model';
import { ChangeLogModel } from './changeLog.model';

export type FieldChanges = Record<string, [before: unknown, after: unknown]>;

/** Compares two objects and returns { field: [before, after] } for the listed fields that changed. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): FieldChanges {
  const changes: FieldChanges = {};
  for (const field of fields) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      changes[field] = [before[field], after[field]];
    }
  }
  return changes;
}

interface RecordChangeInput {
  actorId?: Types.ObjectId | string;
  entity: ChangeEntity;
  entityId: Types.ObjectId | string;
  action: string;
  changes?: FieldChanges;
}

export async function recordChange(input: RecordChangeInput): Promise<void> {
  await ChangeLogModel.create({ ...input, at: new Date() });
}
