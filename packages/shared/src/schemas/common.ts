import { z } from 'zod';
import { normalizePhone } from '../phone';

/** Record id: a UUID (v7, time-ordered) stored as a string. */
export const idSchema = z
  .uuid('Invalid id')
  .meta({ description: 'Record id (UUID)', example: '0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60' });

/** Email, trimmed and lower-cased. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'))
  .meta({ example: 'name@company.com' });

/** Password rules (PRD ADM-AUTH): at least 6 characters with a letter and a number. */
export const PASSWORD_MIN_LENGTH = 6;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

/**
 * Phone number: digits only (an optional leading "+" for the country code). Letters,
 * spaces and other symbols are rejected. A 10-digit number is treated as Indian.
 * Output: E.164 (+91XXXXXXXXXX).
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?\d+$/, 'Phone number can only contain digits')
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit mobile number' });
      return z.NEVER;
    }
    return normalized;
  })
  .meta({ example: '9876543210' });

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
