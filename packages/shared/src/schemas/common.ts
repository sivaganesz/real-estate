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

/** Minimum password length (decided 2026-11-16: basic rules only, no blocked words). */
export const PASSWORD_MIN_LENGTH = 6;

/**
 * The password rules, used both by the API check and by the live checklist on the
 * password screens, so the two can never disagree. Any password meeting them is accepted,
 * including ones like "Password@123".
 */
export const PASSWORD_RULES = [
  {
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p: string) => p.length >= PASSWORD_MIN_LENGTH,
  },
  {
    label: 'An uppercase letter',
    message: 'Password must contain an uppercase letter',
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    label: 'A lowercase letter',
    message: 'Password must contain a lowercase letter',
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    label: 'A number',
    message: 'Password must contain a number',
    test: (p: string) => /\d/.test(p),
  },
  {
    label: 'A special character (e.g. @ # $ !)',
    message: 'Password must contain a special character',
    test: (p: string) => /[^A-Za-z0-9\s]/.test(p),
  },
] as const;

/** Setting or changing a password. Sign-in accepts any existing password. */
export const passwordSchema = PASSWORD_RULES.reduce(
  (schema, rule) => schema.refine(rule.test, rule.message),
  z.string().max(128, 'Password must be at most 128 characters'),
);

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
