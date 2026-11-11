import { model, Schema } from 'mongoose';

/**
 * One document per settings key (TRD §7.4): "company" in Phase 1, "visitSlots" in Phase 3.
 * The shape of `value` is validated by each settings module with Zod.
 */
const settingsSchema = new Schema(
  {
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);

settingsSchema.index({ key: 1 }, { unique: true });

export const SettingsModel = model('Settings', settingsSchema);
