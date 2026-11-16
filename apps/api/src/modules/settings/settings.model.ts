import { model, Schema } from 'mongoose';
import { idField, refField } from '../../db/ids';
import { versionPlugin } from '../../db/versionPlugin';

/**
 * One document per settings key (TRD §7.4): "company" in Phase 1, "visitSlots" in Phase 3.
 * The shape of `value` is validated by each settings module with Zod.
 */
const settingsSchema = new Schema(
  {
    _id: idField,
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: refField('User'),
  },
  { timestamps: true, minimize: false },
);

settingsSchema.plugin(versionPlugin);
settingsSchema.index({ key: 1 }, { unique: true });

export const SettingsModel = model('Settings', settingsSchema);
