import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Record') => new HttpError(404, `${what} not found`);
export const forbidden = (msg = 'You do not have access to this') => new HttpError(403, msg);
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = fields[0];
    throw new HttpError(400, first ? `${first.path || 'Input'}: ${first.message}` : 'Invalid input', { fields });
  }
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid input', details: err.issues });
    return;
  }
  const e = err as { name?: string; message?: string; code?: number };
  if (e?.name === 'CastError') {
    res.status(404).json({ error: 'Record not found' });
    return;
  }
  if (e?.code === 11000) {
    res.status(409).json({ error: 'A record with the same value already exists' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
