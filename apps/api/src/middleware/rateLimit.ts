import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors';

interface LimiterOptions {
  windowMs: number;
  limit: number;
  message: string;
}

/** In-memory rate limiter (fine for a single API process, TRD §3). */
export function createRateLimiter({ windowMs, limit, message }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', message)),
  });
}

/** Login and similar auth endpoints: 10 requests per minute per IP. */
export const authRateLimiter = () =>
  createRateLimiter({
    windowMs: 60_000,
    limit: 10,
    message: 'Too many attempts. Please wait a minute and try again.',
  });

/** Forgot-password: 5 requests per hour per IP. */
export const passwordResetRateLimiter = () =>
  createRateLimiter({
    windowMs: 60 * 60_000,
    limit: 5,
    message: 'Too many password reset requests. Please try again later.',
  });
