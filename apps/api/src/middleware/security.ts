import cors from 'cors';
import express from 'express';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import type { Env } from '../config/env';

export const BODY_LIMIT = '1mb';

/**
 * Security headers, CORS for the admin and website origins, and body size limits
 * (TRD §15). Images under /uploads may be loaded by the admin app on another port of the
 * same site, so the cross-origin resource policy is "same-site".
 */
export function securityMiddleware(env: Env): RequestHandler[] {
  const origins = [env.ADMIN_ORIGIN, env.WEB_ORIGIN].filter((o): o is string => Boolean(o));
  return [
    helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }),
    cors({ origin: origins, credentials: true }),
    express.json({ limit: BODY_LIMIT }),
    express.urlencoded({ extended: false, limit: BODY_LIMIT }),
  ];
}
