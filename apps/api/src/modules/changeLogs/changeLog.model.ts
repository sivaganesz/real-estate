import { model, Schema } from 'mongoose';
import { idField, refField } from '../../db/ids';

export const CHANGE_ENTITIES = [
  'user',
  'settings',
  'property',
  'propertyType',
  'appointment',
] as const;
export type ChangeEntity = (typeof CHANGE_ENTITIES)[number];

/** Simple record of important changes (TRD §7.5). No screen in Phase 1. */
const changeLogSchema = new Schema(
  {
    _id: idField,
    actorId: refField('User'),
    entity: { type: String, required: true, enum: CHANGE_ENTITIES },
    entityId: { type: String, required: true },
    action: { type: String, required: true },
    changes: { type: Schema.Types.Mixed },
    at: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

changeLogSchema.index({ entity: 1, entityId: 1, at: -1 });

export const ChangeLogModel = model('ChangeLog', changeLogSchema);
