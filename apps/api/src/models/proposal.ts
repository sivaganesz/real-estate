import mongoose, { Schema } from 'mongoose';

/** An action the AI suggested that needs a person's confirmation. Expires after a day. */
const proposalSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tool: { type: String, required: true },
    input: Schema.Types.Mixed,
    summary: String,
    status: { type: String, enum: ['pending', 'confirmed', 'dismissed', 'failed'], default: 'pending' },
    result: String,
    createdAt: { type: Date, default: Date.now, expires: 86_400 },
  },
  { versionKey: false },
);

export const Proposal = mongoose.model('Proposal', proposalSchema);
