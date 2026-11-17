/**
 * `pnpm seed:demo`: loads the wireframe's 12 sample properties (PRD v2 PROP-13) into a
 * development database that has catalogue v2. Development and test only.
 */
import { loadEnv } from '../config/env';
import '../db/models';
import { createLogger } from '../lib/logger';
import { LocalStorageProvider } from '../lib/storage';
import { UserModel } from '../modules/users/user.model';
import { connectDatabase, disconnectDatabase } from './mongoose';
import { seedDemo } from './seedDemo';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  if (env.NODE_ENV === 'production') {
    throw new Error('seed:demo is for development and test databases only.');
  }
  await connectDatabase(env.MONGODB_URI, logger);
  try {
    const admin = await UserModel.findOne({ role: 'admin', status: 'active' }).lean();
    if (!admin) throw new Error('No active Admin found. Run the seed script first.');
    const result = await seedDemo({
      nodeEnv: env.NODE_ENV,
      actorId: admin._id,
      storage: new LocalStorageProvider(env.UPLOAD_DIR),
      logger,
    });
    logger.info(
      { created: result.created, skipped: result.skipped },
      `Demo properties: ${result.created.length} created, ${result.skipped.length} already there`,
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
