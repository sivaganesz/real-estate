import { IMPORT_BATCH_STATUSES, IMPORT_ROW_STATUSES } from '@real-estate/shared';
import type {
  CreatePropertyBody,
  ImportBatchStatus,
  ImportResult,
  ImportRowStatus,
} from '@real-estate/shared';
import { model, Schema } from 'mongoose';
import { idField, refField } from '../../db/ids';

const rowSchema = new Schema(
  {
    row: { type: Number, required: true },
    status: { type: String, required: true, enum: IMPORT_ROW_STATUSES },
    errors: { type: [String], default: [] },
    duplicateOf: {
      type: new Schema({ id: String, code: String, row: Number }, { _id: false }),
      default: null,
    },
    /** The checked create-property body, used when importing. */
    body: { type: Schema.Types.Mixed, required: true },
    imageUrls: { type: [String], default: [] },
    outcome: { type: String, default: null },
  },
  { _id: false },
);

/** One uploaded spreadsheet: its checked rows, then the import result (TRD §7.10). */
const importBatchSchema = new Schema(
  {
    _id: idField,
    subcategoryId: { type: String, required: true },
    subcategoryName: { type: String, required: true },
    fileName: { type: String, required: true },
    /** The uploaded file under uploads/imports/ (never served publicly). */
    filePath: { type: String, required: true },
    status: { type: String, required: true, enum: IMPORT_BATCH_STATUSES, default: 'checked' },
    unknownColumns: { type: [String], default: [] },
    rows: { type: [rowSchema], default: [] },
    importAs: { type: String, enum: ['draft', 'published', null], default: null },
    duplicates: { type: String, enum: ['skip', 'update', null], default: null },
    result: { type: Schema.Types.Mixed, default: null },
    createdBy: refField('User'),
    importedBy: refField('User'),
    importedAt: { type: Date, default: null },
  },
  { timestamps: true, suppressReservedKeysWarning: true },
);
importBatchSchema.index({ createdAt: -1 });

export const ImportBatchModel = model('ImportBatch', importBatchSchema);

export interface ImportRowDoc {
  row: number;
  status: ImportRowStatus;
  errors: string[];
  duplicateOf: { id: string | null; code: string | null; row: number | null } | null;
  body: CreatePropertyBody;
  imageUrls: string[];
  outcome: string | null;
}

export interface ImportBatchDoc {
  _id: string;
  subcategoryId: string;
  subcategoryName: string;
  fileName: string;
  filePath: string;
  status: ImportBatchStatus;
  unknownColumns: string[];
  rows: ImportRowDoc[];
  importAs: 'draft' | 'published' | null;
  duplicates: 'skip' | 'update' | null;
  result: ImportResult | null;
  createdBy?: string | null;
  importedBy?: string | null;
  importedAt: Date | null;
  createdAt: Date;
}
