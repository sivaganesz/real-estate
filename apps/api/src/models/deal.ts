import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { DEAL_STATUSES } from '@estate/shared';

/**
 * A negotiation on one property with one customer, through booking and
 * payments to registration. Every price, approval and payment is kept.
 */
const dealSchema = new Schema(
  {
    code: { type: String, unique: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    status: { type: String, enum: DEAL_STATUSES, default: 'negotiating', index: true },
    listPrice: { type: Number, required: true },
    offers: [{ _id: false, by: { type: String, enum: ['customer', 'us'] }, amount: Number, note: String, at: Date, byName: String }],
    agreedPrice: Number,
    approval: {
      type: new Schema(
        {
          price: Number,
          discountPct: Number,
          level: { type: String, enum: ['manager', 'admin'] },
          note: String,
          requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          requestedByName: String,
          requestedAt: Date,
          decision: { type: String, enum: ['approved', 'rejected', 'countered'] },
          decidedByName: String,
          decidedAt: Date,
          decisionNote: String,
          counterPrice: Number,
        },
        { _id: false },
      ),
      default: undefined,
    },
    bookingRequest: {
      type: new Schema({ amount: Number, date: Date, mode: String, reference: String, requestedByName: String, requestedAt: Date }, { _id: false }),
      default: undefined,
    },
    booking: {
      type: new Schema({ amount: Number, date: Date, mode: String, reference: String, confirmedByName: String, confirmedAt: Date }, { _id: false }),
      default: undefined,
    },
    payments: [{ _id: false, label: String, pct: Number, amount: Number, dueDate: Date, status: { type: String, enum: ['due', 'paid'], default: 'due' }, paidAt: Date, reference: String }],
    registeredAt: Date,
    cancelReason: String,
    cancelledAt: Date,
  },
  { timestamps: true },
);

export type DealDoc = InferSchemaType<typeof dealSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };
export const Deal = mongoose.model('Deal', dealSchema);

/** Business rules an admin can change. One document. */
const settingsSchema = new Schema(
  {
    _id: { type: String, default: 'org' },
    companyName: { type: String, default: 'EstateOS Realty' },
    /** Largest discount (% of list price) each role may agree without asking. */
    discountLimitPct: {
      executive: { type: Number, default: 1 },
      manager: { type: Number, default: 5 },
    },
    holdDays: { type: Number, default: 3 },
  },
  { versionKey: false },
);
export const Settings = mongoose.model('Settings', settingsSchema);

export async function getSettings() {
  return (await Settings.findById('org').lean()) ?? (await Settings.create({ _id: 'org' })).toObject();
}
