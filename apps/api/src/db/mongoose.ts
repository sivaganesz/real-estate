import mongoose from 'mongoose';
import type { Logger } from '../lib/logger';

// Reject unknown query fields. Operator injection is blocked earlier: request bodies are
// stripped of "$" keys (middleware/sanitize.ts) and every input is validated with Zod.
mongoose.set('strictQuery', true);

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected';

export async function connectDatabase(uri: string, logger: Logger): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
}

/** Creates missing indexes and removes indexes no longer defined in the schemas. */
export async function syncDatabaseIndexes(logger: Logger): Promise<void> {
  await mongoose.syncIndexes();
  logger.info({ models: Object.keys(mongoose.models) }, 'MongoDB indexes in sync');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function databaseStatus(): DatabaseStatus {
  switch (mongoose.connection.readyState) {
    case mongoose.ConnectionStates.connected:
      return 'connected';
    case mongoose.ConnectionStates.connecting:
      return 'connecting';
    default:
      return 'disconnected';
  }
}
