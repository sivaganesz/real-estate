import { z } from 'zod';
import { normalizePhone } from '../phone';

/** MongoDB ObjectId as a 24-character hex string. */
export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id')
  .meta({ description: 'MongoDB ObjectId', example: '665f1c2b9d3e4a0012ab34cd' });

/** Email, trimmed and lower-cased. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'))
  .meta({ example: 'name@company.com' });

/** Password rules (PRD ADM-AUTH): at least 10 characters with a letter and a number. */
export const PASSWORD_MIN_LENGTH = 10;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

/** Phone number: accepts common formats, outputs E.164 (+91XXXXXXXXXX). */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' });
      return z.NEVER;
    }
    return normalized;
  })
  .meta({ example: '+919876543210' });

/** Standard list query: ?page=1&limit=20&sort=-createdAt */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .string()
    .regex(/^-?[A-Za-z][\w.]*$/, 'Invalid sort field')
    .optional()
    .meta({
      description: 'Field to sort by; prefix with "-" for descending',
      example: '-createdAt',
    }),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Meta block returned with every list response. */
export const pageMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;
