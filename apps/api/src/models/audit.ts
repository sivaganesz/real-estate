import mongoose, { Schema } from 'mongoose';

/**
 * Every change to business data, by a person or by the AI on a person's behalf.
 * `viaAI` marks actions the assistant performed so they can be reviewed.
 */
const auditSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: String,
    viaAI: { type: Boolean, default: false },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true },
    summary: String,
    changes: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Audit = mongoose.model('Audit', auditSchema);
