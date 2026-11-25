import mongoose, { Schema } from 'mongoose';

const rowSchema = new Schema(
  {
    index: Number,
    raw: [Schema.Types.Mixed],
    /** Corrections typed on the Check screen, by field. */
    fixes: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['ready', 'draft', 'duplicate', 'error', 'imported', 'updated', 'skipped'] },
    issues: [String],
    values: Schema.Types.Mixed,
    duplicateOf: { id: String, title: String },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    source: String,
  },
  { _id: false },
);

const importBatchSchema = new Schema(
  {
    fileName: String,
    sender: String,
    kind: { type: String, enum: ['sheet', 'brochure'], default: 'sheet' },
    sheetName: String,
    headers: [String],
    mapping: [{ _id: false, column: Number, header: String, field: String, how: String, confidence: String, samples: [String] }],
    defaultType: String,
    defaultCity: String,
    rows: [rowSchema],
    status: { type: String, enum: ['checking', 'importing', 'done'], default: 'checking' },
    options: { asLive: Boolean, duplicates: String },
    counts: { imported: Number, updated: Number, skipped: Number, failed: Number },
    aiUsed: Boolean,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: String,
    finishedAt: Date,
  },
  { timestamps: true },
);
export const ImportBatch = mongoose.model('ImportBatch', importBatchSchema);

/** A sender's column layout, remembered after the first import. */
const importFormatSchema = new Schema(
  {
    sender: { type: String, required: true },
    headersKey: { type: String, required: true },
    mapping: [{ _id: false, header: String, field: String }],
    uses: { type: Number, default: 1 },
  },
  { timestamps: true },
);
importFormatSchema.index({ sender: 1, headersKey: 1 }, { unique: true });
export const ImportFormat = mongoose.model('ImportFormat', importFormatSchema);
