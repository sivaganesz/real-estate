import { createApp } from './app';
import { loadEnv } from './config/env';
import './db/models';
import { connectDatabase, disconnectDatabase } from './db/mongoose';
import { createEmailProvider } from './lib/email';
import { createLogger } from './lib/logger';
import { LocalStorageProvider } from './lib/storage';
import { MIGRATIONS } from './migrations';
import { migrateUp, pendingMigrations } from './migrations/runner';

/** Requests still running after this are cut off so a deploy never hangs (M10). */
const SHUTDOWN_DEADLINE_MS = 25_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const storage = new LocalStorageProvider(env.UPLOAD_DIR);
  const email = createEmailProvider(env, logger);

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    // The process state is unknown after this: log, then exit so the supervisor restarts it.
    logger.fatal({ err }, 'Uncaught exception, exiting');
    process.exit(1);
  });

  await connectDatabase(env.MONGODB_URI, logger);

  // Migrations are a deploy step (`pnpm migrate`). Development applies them automatically
  // for convenience; production refuses to start on an out-of-date database.
  const pending = await pendingMigrations(MIGRATIONS);
  if (pending.length > 0) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        `${pending.length} pending migration(s): ${pending.map((m) => m.id).join(', ')}. ` +
          'Run `pnpm --filter @real-estate/api migrate` before starting the API.',
      );
    }
    await migrateUp(MIGRATIONS, logger);
  }

  const app = createApp({ env, logger, storage, email });
  const server = app.listen(env.PORT, () => {
    logger.info(
      { email: email.name, uploads: storage.root },
      `API listening on http://localhost:${env.PORT} (docs: /api/docs)`,
    );
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down`);
    const deadline = setTimeout(() => {
      logger.error('Shutdown deadline reached, closing open connections');
      server.closeAllConnections();
    }, SHUTDOWN_DEADLINE_MS);
    deadline.unref();
    server.close(() => {
      disconnectDatabase()
        .catch((err: unknown) => logger.error({ err }, 'Error while disconnecting MongoDB'))
        .finally(() => process.exit(0));
    });
    server.closeIdleConnections();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
