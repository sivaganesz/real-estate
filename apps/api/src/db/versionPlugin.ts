import type { Request } from 'express';
import type { Schema, UpdateQuery } from 'mongoose';
import { AppError } from '../lib/errors';

/**
 * Optimistic concurrency (TRD §5, H4). Adds `version` to a schema and increments it on
 * every update, whichever code path writes, so a client that read version N can say "only
 * if it is still N" (If-Match) and a stale save fails with 409 instead of overwriting.
 */
export function versionPlugin(schema: Schema): void {
  schema.add({ version: { type: Number, default: 0 } });

  const bump = function (this: {
    getUpdate(): UpdateQuery<unknown> | null;
    setUpdate(u: UpdateQuery<unknown>): void;
    getOptions(): { skipVersionBump?: boolean };
  }) {
    if (this.getOptions().skipVersionBump) return;
    const update = this.getUpdate();
    if (!update || Array.isArray(update)) return; // pipelines manage their own fields
    // Insert-only upserts ($setOnInsert) change nothing on an existing document.
    if (Object.keys(update).every((k) => k === '$setOnInsert')) return;
    const inc = { ...(update.$inc as Record<string, number> | undefined) };
    if (
      'version' in inc ||
      (update.$set as Record<string, unknown> | undefined)?.version !== undefined
    )
      return;
    inc.version = 1;
    this.setUpdate({ ...update, $inc: inc });
  };
  schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], bump);
  schema.pre('save', function () {
    if (!this.isNew && this.isModified()) {
      this.set('version', Number(this.get('version') ?? 0) + 1);
    }
  });
}

/** 409 VERSION_CONFLICT with the current version so the client can reload. */
export function versionConflict(current: number): AppError {
  return new AppError(
    409,
    'VERSION_CONFLICT',
    'Someone else changed this since you opened it. Reload to see their changes, then save again.',
    [{ path: 'version', message: String(current) }],
  );
}

/**
 * Reads `If-Match: "3"` (or `3`). Required on edits that use optimistic concurrency:
 * a client that doesn't say which version it edited gets 428 and must reload first.
 */
export function requireIfMatch(req: Request): number {
  const raw = req.get('if-match');
  const match = raw ? /^(?:W\/)?"?(\d{1,9})"?$/.exec(raw.trim()) : null;
  if (!match) {
    throw new AppError(
      428,
      'PRECONDITION_REQUIRED',
      'This change needs the version you edited (If-Match header). Reload and try again.',
    );
  }
  return Number(match[1]);
}
