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
export function singleFileUpload(
  kind: UploadKind,
  { fieldName = 'file', maxBytes }: { fieldName?: string; maxBytes?: number } = {},
): RequestHandler {
  const rule = UPLOAD_RULES[kind];
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.min(maxBytes ?? rule.maxBytes, rule.maxBytes), files: 1 },
    fileFilter: (_req, file, callback) => {
      if (isAllowedFile(kind, file.originalname, file.mimetype)) return callback(null, true);
      callback(
        new AppError(400, 'INVALID_FILE_TYPE', `Allowed file types: ${rule.extensions.join(', ')}`),
      );
    },
  }).single(fieldName);
}

/**
 * Image type from the file's first bytes (not its name or the browser's claim), so a renamed
 * file can't pass as an image. Returns the extension to save with, or null.
 */
export function detectImageType(data: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpg';
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString('latin1') === 'RIFF' &&
    data.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export type DetectedFileType = 'png' | 'jpg' | 'webp' | 'pdf' | 'mp4' | 'webm';

/** Like `detectImageType`, plus PDF and video (MP4 / WebM), from the file's first bytes. */
export function detectFileType(data: Buffer): DetectedFileType | null {
  const image = detectImageType(data);
  if (image) return image;
  if (data.length >= 5 && data.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (data.length >= 12 && data.subarray(4, 8).toString('latin1') === 'ftyp') return 'mp4';
  if (data.length >= 4 && data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return 'webm';
  }
  return null;
}
