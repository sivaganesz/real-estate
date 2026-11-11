import type { RequestHandler } from 'express';

/**
 * Removes object keys that start with "$" or contain "." from the request body, so input
 * can't inject MongoDB operators (e.g. { "email": { "$ne": null } }). Params and query strings
 * are validated with Zod before they reach a database query.
 */
export function stripMongoOperators(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMongoOperators);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const clean: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      clean[key] = stripMongoOperators(child);
    }
    return clean;
  }
  return value;
}

export const sanitizeBody: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') req.body = stripMongoOperators(req.body);
  next();
};
