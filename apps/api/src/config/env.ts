import { existsSync } from 'node:fs';
import { z } from 'zod';

/**
 * Environment variables, validated at startup (TRD §17). The process stops with a clear
 * message if anything required is missing or invalid.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    MONGODB_URI: z.string().min(1, 'is required'),

    JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),

    ADMIN_ORIGIN: z.url('must be a URL'),
    WEB_ORIGIN: z.url('must be a URL').optional(),
    APP_BASE_URL: z.url('must be a URL'),

    UPLOAD_DIR: z.string().min(1).default('./uploads'),

    EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().min(3).default('Real Estate <no-reply@example.com>'),

    SWAGGER_BASIC_AUTH: z
      .string()
      .regex(/^[^:]+:.+$/, 'must be in the format user:password')
      .optional(),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'is required when EMAIL_PROVIDER=resend',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Validates a set of environment variables. Empty strings count as "not set". */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(cleaned, {
    error: (issue) =>
      issue.code === 'invalid_type' && issue.input === undefined ? 'is required' : undefined,
  });
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')} ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}

/** Loads `.env` from the current folder (if present) and validates process.env. */
export function loadEnv(): Env {
  if (existsSync('.env')) process.loadEnvFile('.env');
  return parseEnv(process.env);
}
