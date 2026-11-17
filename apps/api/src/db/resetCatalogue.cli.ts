/**
 * `pnpm db:reset-catalogue [--yes]`: replaces the property catalogue and all property data
 * with catalogue v2 (docs/v2/PROPERTY-CATALOGUE.md). Development and test databases only.
 * Without --yes it only shows what would be removed.
 */
import { loadEnv } from '../config/env';
import '../db/models';
import { createLogger } from '../lib/logger';
import { connectDatabase, disconnectDatabase } from './mongoose';
import { catalogueCounts, resetCatalogue } from './resetCatalogue';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  if (env.NODE_ENV === 'production') {
    throw new Error('db:reset-catalogue is for development and test databases only.');
  }
  await connectDatabase(env.MONGODB_URI, logger);
  try {
    if (!process.argv.includes('--yes')) {
      const counts = await catalogueCounts();
      logger.warn(
        { database: env.MONGODB_URI.replace(/\/\/[^@]*@/, '//***@'), ...counts },
        'This would DELETE the items above (and the property and import files), then load catalogue v2. Users, roles and company settings stay. Run again with --yes to do it.',
      );
      return;
    }
    const removed = await resetCatalogue({ nodeEnv: env.NODE_ENV, uploadDir: env.UPLOAD_DIR });
    logger.info({ removed }, 'Catalogue v2 loaded');
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
