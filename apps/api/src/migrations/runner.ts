import mongoose from 'mongoose';
import type { Logger } from '../lib/logger';

/**
 * Schema and data migrations (TRD §7.13, M11). They run as a deploy step
 * (`pnpm migrate`), not at every boot. Each one is recorded in the `migrations` collection,
 * runs once, and must be idempotent so a half-finished run can safely be repeated.
 */
export interface Migration {
  /** Sortable and unique, e.g. `0002-roles`. Never rename one that has shipped. */
  id: string;
  description: string;
  up: () => Promise<void>;
  /** Optional. Reverses `up` where that is safe; otherwise leave it out. */
  down?: () => Promise<void>;
}

interface AppliedMigration {
  _id: string;
  description: string;
  appliedAt: Date;
}

const LOCK_ID = '__lock';
/** A lock older than this is from a crashed run and may be taken over. */
const STALE_LOCK_MS = 10 * 60_000;

function collection() {
  return mongoose.connection.db!.collection<AppliedMigration | { _id: string; at: Date }>(
    'migrations',
  );
}

export async function appliedIds(): Promise<Set<string>> {
  const docs = await collection()
    .find({ _id: { $ne: LOCK_ID } }, { projection: { _id: 1 } })
    .toArray();
  return new Set(docs.map((d) => d._id));
}

export async function pendingMigrations(all: readonly Migration[]): Promise<Migration[]> {
  const applied = await appliedIds();
  return all.filter((m) => !applied.has(m.id));
}

/** Only one process migrates at a time; a crashed run's lock expires. */
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const now = new Date();
  try {
    await collection().deleteOne({
      _id: LOCK_ID,
      at: { $lt: new Date(now.getTime() - STALE_LOCK_MS) },
    });
    await collection().insertOne({ _id: LOCK_ID, at: now });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new Error('Another migration run is in progress (lock held). Try again in a minute.', {
        cause: err,
      });
    }
    throw err;
  }
  try {
    return await fn();
  } finally {
    await collection().deleteOne({ _id: LOCK_ID });
  }
}

/** Applies pending migrations in id order, then brings indexes in line with the schemas. */
export async function migrateUp(all: readonly Migration[], logger: Logger): Promise<string[]> {
  const ordered = [...all].sort((a, b) => a.id.localeCompare(b.id));
  return withLock(async () => {
    const applied = await appliedIds();
    const ran: string[] = [];
    for (const m of ordered) {
      if (applied.has(m.id)) continue;
      logger.info({ migration: m.id }, `Migrating: ${m.description}`);
      await m.up();
      await collection().insertOne({
        _id: m.id,
        description: m.description,
        appliedAt: new Date(),
      });
      ran.push(m.id);
    }
    await mongoose.syncIndexes();
    logger.info({ ran: ran.length }, ran.length ? 'Migrations applied' : 'No pending migrations');
    return ran;
  });
}

/** Reverses the most recently applied migration (when it has a `down`). */
export async function migrateDown(
  all: readonly Migration[],
  logger: Logger,
): Promise<string | null> {
  return withLock(async () => {
    const last = await collection()
      .find({ _id: { $ne: LOCK_ID } })
      .sort({ _id: -1 })
      .limit(1)
      .next();
    if (!last) return null;
    const m = all.find((x) => x.id === last._id);
    if (!m?.down) throw new Error(`Migration ${last._id} can't be reversed (no down step).`);
    logger.info({ migration: m.id }, `Reverting: ${m.description}`);
    await m.down();
    await collection().deleteOne({ _id: m.id });
    return m.id;
  });
}
