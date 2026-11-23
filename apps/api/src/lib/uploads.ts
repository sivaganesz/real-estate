import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config';
import { badRequest } from './http';

fs.mkdirSync(config.uploadDir, { recursive: true });

const IMAGE = /^image\/(jpeg|png|webp|gif)$/;
const DOC = /^(application\/pdf|image\/(jpeg|png|webp))$/;
const SHEET = /(spreadsheetml|ms-excel|text\/csv|application\/csv|text\/plain)/;

/** Files are stored on our server under uploads/<purpose>/ with random names. */
function store(purpose: string, allowed: RegExp, maxMb: number) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(config.uploadDir, purpose);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => (allowed.test(file.mimetype) ? cb(null, true) : cb(badRequest(`This file type (${file.mimetype}) isn't supported here`))),
  });
}

export const photoUpload = store('photos', IMAGE, 10);
export const documentUpload = store('documents', DOC, 20);

/** In memory: read once, never kept (spreadsheets, brochures sent to the AI). */
export const memoryUpload = (allowed: RegExp = new RegExp(`${SHEET.source}|${DOC.source}`), maxMb = 25) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => (allowed.test(file.mimetype) || /\.(xlsx|xls|csv)$/i.test(file.originalname) ? cb(null, true) : cb(badRequest(`This file type (${file.mimetype}) isn't supported`))),
  });

export const publicUrl = (purpose: string, filename: string) => `/uploads/${purpose}/${filename}`;
