import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../errors';

const MB = 1024 * 1024;

/** Allowed upload types and size limits (TRD §11). */
export const UPLOAD_RULES = {
  image: {
    extensions: ['jpg', 'jpeg', 'png', 'webp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 10 * MB,
  },
  pdf: {
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
    maxBytes: 20 * MB,
  },
  excel: {
    extensions: ['xlsx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    maxBytes: 10 * MB,
  },
} as const satisfies Record<
  string,
  { extensions: readonly string[]; mimeTypes: readonly string[]; maxBytes: number }
>;

export type UploadKind = keyof typeof UPLOAD_RULES;

/** "Logo.PNG" → "png" */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

export function isAllowedFile(kind: UploadKind, fileName: string, mimeType: string): boolean {
  const rule = UPLOAD_RULES[kind];
  return (
    (rule.extensions as readonly string[]).includes(fileExtension(fileName)) &&
    (rule.mimeTypes as readonly string[]).includes(mimeType)
  );
}

/**
 * Accepts one file in memory (`req.file`), checking type and size. The calling module
 * then saves it through the storage provider.
 */
export function singleFileUpload(kind: UploadKind, fieldName = 'file'): RequestHandler {
  const rule = UPLOAD_RULES[kind];
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: rule.maxBytes, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (isAllowedFile(kind, file.originalname, file.mimetype)) return callback(null, true);
      callback(
        new AppError(400, 'INVALID_FILE_TYPE', `Allowed file types: ${rule.extensions.join(', ')}`),
      );
    },
  }).single(fieldName);
}
