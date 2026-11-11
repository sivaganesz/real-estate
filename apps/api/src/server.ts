import { createApp } from './app';
import { loadEnv } from './config/env';
import './db/models';
import { connectDatabase, disconnectDatabase, syncDatabaseIndexes } from './db/mongoose';
import { createEmailProvider } from './lib/email';
import { createLogger } from './lib/logger';
import { LocalStorageProvider } from './lib/storage';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const storage = new LocalStorageProvider(env.UPLOAD_DIR);
  const email = createEmailProvider(env, logger);

  const app = createApp({ env, logger, storage, email });

  await connectDatabase(env.MONGODB_URI, logger);
  await syncDatabaseIndexes(logger);

  const server = app.listen(env.PORT, () => {
    logger.info(
      { email: email.name, uploads: storage.root },
      `API listening on http://localhost:${env.PORT} (docs: /api/docs)`,
    );
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      disconnectDatabase()
        .catch((err: unknown) => logger.error({ err }, 'Error while disconnecting MongoDB'))
        .finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
