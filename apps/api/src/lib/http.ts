import type { PageMeta } from '@real-estate/shared';
import type { Response } from 'express';
import { badRequest } from './errors';

/** { data } response (TRD §5.2). */
export function sendData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

/** { data: [...], meta } list response. */
export function sendList<T>(res: Response, items: T[], meta: PageMeta): void {
  res.json({ data: items, meta });
}

export function pageMeta(total: number, page: number, limit: number): PageMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

/** Number of documents to skip for a page. */
export function pageSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Turns "?sort=-createdAt" into a MongoDB sort object. Only fields in `allowed` can be
 * used, so clients can't sort by unindexed or private fields.
 */
export function parseSort(
  sort: string | undefined,
  allowed: readonly string[],
  fallback: Record<string, 1 | -1>,
): Record<string, 1 | -1> {
  if (!sort) return fallback;
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  if (!allowed.includes(field)) {
    throw badRequest(`Sorting by "${field}" is not supported`, [
      { path: 'query.sort', message: `Allowed: ${allowed.join(', ')}` },
    ]);
  }
  return { [field]: descending ? -1 : 1 };
}
