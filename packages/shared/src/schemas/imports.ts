import { z } from 'zod';
import { idSchema, paginationQuerySchema } from './common';

/** Bulk import limits (everything runs inside the request; no background jobs). */
export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_MAX_IMAGES_PER_ROW = 5;

export const IMPORT_ROW_STATUSES = ['valid', 'invalid', 'duplicate'] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export const IMPORT_BATCH_STATUSES = ['checked', 'imported'] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

/** One spreadsheet row after checking. */
export const importRowSchema = z.object({
  /** Row number in the spreadsheet (the header is row 1). */
  row: z.number().int(),
  status: z.enum(IMPORT_ROW_STATUSES),
  title: z.string(),
  city: z.string(),
  locality: z.string(),
  price: z.number().nullable(),
  errors: z.array(z.string()),
  /** For duplicates: the existing property, or the earlier row in the same file. */
  duplicateOf: z
    .object({
      id: idSchema.nullable(),
      code: z.string().nullable(),
      row: z.number().int().nullable(),
    })
    .nullable(),
  /** After the import: what happened to this row. */
  outcome: z.string().nullable(),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export const importResultSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
  failed: z.number().int(),
  /** Imported as Published but saved as Draft (e.g. no usable photo). */
  savedAsDraft: z.number().int(),
  imagesAdded: z.number().int(),
  imagesFailed: z.number().int(),
});
export type ImportResult = z.infer<typeof importResultSchema>;

export const importBatchSchema = z.object({
  id: idSchema,
  subcategoryId: idSchema,
  subcategoryName: z.string(),
  fileName: z.string(),
  status: z.enum(IMPORT_BATCH_STATUSES),
  rowCount: z.number().int(),
  validCount: z.number().int(),
  invalidCount: z.number().int(),
  duplicateCount: z.number().int(),
  /** Columns the file has that the template doesn't (ignored). */
  unknownColumns: z.array(z.string()),
  importAs: z.enum(['draft', 'published']).nullable(),
  duplicates: z.enum(['skip', 'update']).nullable(),
  result: importResultSchema.nullable(),
  createdAt: z.string(),
  createdBy: z.object({ id: idSchema, name: z.string() }).nullable(),
  importedAt: z.string().nullable(),
});
export type ImportBatch = z.infer<typeof importBatchSchema>;

/** A batch with its rows (GET /admin/imports/:id). */
export const importBatchDetailSchema = importBatchSchema.extend({
  rows: z.array(importRowSchema),
});
export type ImportBatchDetail = z.infer<typeof importBatchDetailSchema>;

/** GET /admin/imports/template?subcategoryId= and POST /admin/imports?subcategoryId= */
export const importSubcategoryQuerySchema = z.object({ subcategoryId: idSchema });

/** POST /admin/imports/:id/commit */
export const commitImportBodySchema = z.object({
  importAs: z.enum(['draft', 'published']),
  duplicates: z.enum(['skip', 'update']),
});
export type CommitImportBody = z.infer<typeof commitImportBodySchema>;

/** GET /admin/imports (history) */
export const listImportsQuerySchema = paginationQuerySchema.pick({ page: true, limit: true });
