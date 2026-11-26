import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { ACTIVITY_STATUSES, ACTIVITY_TYPES, LEAD_SOURCES, PROPERTY_TYPES, PURPOSES, STAGES, TEMPERATURES } from '@estate/shared';

const requirementSchema = new Schema(
  {
    purpose: { type: String, enum: PURPOSES, default: 'sale' },
    types: [{ type: String, enum: PROPERTY_TYPES }],
    budgetMin: Number,
    budgetMax: Number,
    city: String,
    localities: [String],
    bedrooms: Number,
    areaMin: Number,
    mustHaves: [String],
    timeline: String,
    financing: String,
    intent: String,
    notes: String,
  },
  { _id: false },
);

/**
 * One record per customer (identified by phone). A returning customer is the
 * same record with a new enquiry, so their whole history stays together.
 */
const leadSchema = new Schema(
  {
    code: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, index: true },
    email: String,
    source: { type: String, enum: LEAD_SOURCES, default: 'phone' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedAt: Date,
    stage: { type: String, enum: STAGES, default: 'new', index: true },
    stageChangedAt: { type: Date, default: Date.now },
    temperature: { type: String, enum: TEMPERATURES, default: 'warm' },
    requirement: { type: requirementSchema, default: () => ({}) },
    lostReason: String,
    lostNote: String,
    enquiries: [{ _id: false, at: Date, source: String, message: String, propertyId: { type: Schema.Types.ObjectId, ref: 'Property' } }],
    lastContactAt: Date,
    /** The earliest planned activity, kept here so lists and "who needs attention" are one query. */
    nextAction: { type: new Schema({ activityId: Schema.Types.ObjectId, type: { type: String }, dueAt: Date, title: String }, { _id: false }), default: undefined },
    /** Properties offered or discussed with this customer, and what they thought. */
    shortlist: [
      {
        _id: false,
        propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
        status: { type: String, enum: ['suggested', 'shared', 'visited', 'liked', 'rejected'], default: 'suggested' },
        note: String,
        at: Date,
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);
leadSchema.index({ name: 'text', phone: 'text', 'requirement.localities': 'text' });
leadSchema.index({ ownerId: 1, stage: 1, 'nextAction.dueAt': 1 });

export type LeadDoc = InferSchemaType<typeof leadSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };
export const Lead = mongoose.model('Lead', leadSchema);

/**
 * Everything done with a customer: calls, meetings, site visits, messages,
 * notes and tasks. Planned ones are follow-ups; done ones are history.
 */
const activitySchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    status: { type: String, enum: ACTIVITY_STATUSES, default: 'done' },
    title: String,
    propertyIds: [{ type: Schema.Types.ObjectId, ref: 'Property' }],
    scheduledAt: Date,
    durationMin: { type: Number, default: 30 },
    completedAt: Date,
    outcome: String,
    notes: String,
    /** Site visit feedback, captured when the visit is completed. */
    feedback: { _id: false, interest: String, liked: String, concerns: String },
    cancelReason: String,
    rescheduledFrom: Date,
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    viaAI: { type: Boolean, default: false },
  },
  { timestamps: true },
);
activitySchema.index({ ownerId: 1, status: 1, scheduledAt: 1 });

export type ActivityDoc = InferSchemaType<typeof activitySchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const Activity = mongoose.model('Activity', activitySchema);
