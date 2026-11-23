import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { AREA_UNITS, AVAILABILITY, LISTING_STATES, PROJECT_STATUSES, PROPERTY_TYPES, PURPOSES } from '@estate/shared';

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = mongoose.model('Counter', counterSchema);

export async function nextCode(prefix: string) {
  const c = await Counter.findOneAndUpdate({ _id: prefix }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `${prefix}-${String(c.seq).padStart(4, '0')}`;
}

const projectSchema = new Schema(
  {
    code: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: PROPERTY_TYPES, required: true },
    status: { type: String, enum: PROJECT_STATUSES, default: 'under_construction' },
    city: { type: String, required: true },
    locality: { type: String, required: true },
    address: String,
    reraNumber: String,
    possessionDate: Date,
    description: String,
    amenities: [String],
    blocks: [{ _id: false, name: String, floors: Number }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
export const Project = mongoose.model('Project', projectSchema);

const propertySchema = new Schema(
  {
    code: { type: String, unique: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: PROPERTY_TYPES, required: true },
    purpose: { type: String, enum: PURPOSES, default: 'sale' },

    // A unit inside a project (block and unit number), or a standalone property.
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    block: String,
    unitNumber: String,

    price: Number,
    priceNegotiable: { type: Boolean, default: false },
    area: Number,
    areaUnit: { type: String, enum: AREA_UNITS, default: 'sqft' },
    areaSqft: Number,

    city: String,
    locality: String,
    address: String,
    pincode: String,

    /** Known key details per type (bedrooms, floor, facing, length…). */
    details: { type: Schema.Types.Mixed, default: {} },
    /** Anything else, kept exactly as written. `internal` ones never reach buyers. */
    extras: [{ _id: false, label: String, value: String, internal: Boolean }],
    amenities: [String],
    description: String,
    highlights: [String],
    media: [{ url: String, kind: { type: String, enum: ['photo', 'floorplan', 'video'], default: 'photo' }, caption: String }],
    documents: [{ name: String, url: String, uploadedAt: Date }],
    approvals: [{ _id: false, name: String, documentUrl: String, verified: Boolean }],

    listing: { type: String, enum: LISTING_STATES, default: 'draft', index: true },
    availability: { type: String, enum: AVAILABILITY, default: 'available', index: true },
    heldUntil: Date,
    heldFor: { type: Schema.Types.ObjectId, ref: 'Lead' },
    publishedAt: Date,

    /** Where each AI-filled value came from: field → quoted source. */
    sources: { type: Schema.Types.Mixed, default: {} },
    shareToken: { type: String, index: true, sparse: true },
    enquiries: { type: Number, default: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    importBatchId: { type: Schema.Types.ObjectId, ref: 'ImportBatch' },
  },
  { timestamps: true, minimize: false },
);

propertySchema.index({ listing: 1, availability: 1, type: 1, city: 1, price: 1 });
propertySchema.index({ title: 'text', locality: 'text', city: 'text', description: 'text', 'extras.value': 'text', code: 'text' });

export type PropertyDoc = InferSchemaType<typeof propertySchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };
export const Property = mongoose.model('Property', propertySchema);
