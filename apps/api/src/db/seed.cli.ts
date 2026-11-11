/**
 * Seed script: `pnpm --filter @real-estate/api seed`
 * Reads SEED_SUPERADMIN_NAME / SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD from
 * apps/api/.env, creates the first Super Admin and the default company settings.
 */
import { loadEnv } from '../config/env';
import { createLogger } from '../lib/logger';
import { connectDatabase, disconnectDatabase } from './mongoose';
import { seedCompanySettings, seedSuperAdmin, superAdminSeedSchema } from './seed';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);

  const input = superAdminSeedSchema.safeParse({
    name: process.env.SEED_SUPERADMIN_NAME,
    email: process.env.SEED_SUPERADMIN_EMAIL,
    password: process.env.SEED_SUPERADMIN_PASSWORD,
  });
  if (!input.success) {
    const lines = input.error.issues.map(
      (i) => `  - SEED_SUPERADMIN_${String(i.path[0]).toUpperCase()}: ${i.message}`,
    );
    throw new Error(`Seed values are missing or invalid in apps/api/.env:\n${lines.join('\n')}`);
  }

  await connectDatabase(env.MONGODB_URI, logger);
  try {
    const admin = await seedSuperAdmin(input.data);
    logger.info(
      admin === 'created'
        ? `Super Admin created: ${input.data.email}`
        : 'A Super Admin already exists, skipped',
    );
    const company = await seedCompanySettings();
    logger.info(
      company === 'created'
        ? 'Default company settings created'
        : 'Company settings already exist, skipped',
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
