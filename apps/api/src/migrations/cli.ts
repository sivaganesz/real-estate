/**
 * `pnpm --filter @real-estate/api migrate [up|down|status]` (default: up).
 * Run it on every deploy, before starting the new version (TRD §15).
 */
import { loadEnv } from '../config/env';
import '../db/models';
import { connectDatabase, disconnectDatabase } from '../db/mongoose';
import { createLogger } from '../lib/logger';
import { MIGRATIONS } from './index';
import { migrateDown, migrateUp, pendingMigrations } from './runner';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  const env = loadEnv();
  const logger = createLogger(env);
  await connectDatabase(env.MONGODB_URI, logger);
  try {
    if (command === 'up') {
      await migrateUp(MIGRATIONS, logger);
    } else if (command === 'down') {
      const id = await migrateDown(MIGRATIONS, logger);
      logger.info(id ? `Reverted ${id}` : 'Nothing to revert');
    } else if (command === 'status') {
      const pending = await pendingMigrations(MIGRATIONS);
      logger.info(
        { pending: pending.map((m) => m.id) },
        pending.length ? `${pending.length} pending migration(s)` : 'Database is up to date',
      );
    } else {
      throw new Error(`Unknown command "${command}". Use up, down or status.`);
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
