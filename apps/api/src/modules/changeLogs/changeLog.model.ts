import { model, Schema } from 'mongoose';

export const CHANGE_ENTITIES = [
  'user',
  'settings',
  'property',
  'propertyGroup',
  'appointment',
] as const;
export type ChangeEntity = (typeof CHANGE_ENTITIES)[number];

/** Simple record of important changes (TRD §7.5). No screen in Phase 1. */
const changeLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    entity: { type: String, required: true, enum: CHANGE_ENTITIES },
    entityId: { type: Schema.Types.ObjectId, required: true },
    action: { type: String, required: true },
    changes: { type: Schema.Types.Mixed },
    at: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

changeLogSchema.index({ entity: 1, entityId: 1, at: -1 });

export const ChangeLogModel = model('ChangeLog', changeLogSchema);
