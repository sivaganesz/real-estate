import mongoose from 'mongoose';
import type { Logger } from '../lib/logger';

// Reject unknown query fields. Operator injection is blocked earlier: request bodies are
// stripped of "$" keys (middleware/sanitize.ts) and every input is validated with Zod.
mongoose.set('strictQuery', true);
// Every Mongoose call inside withTransaction() joins the transaction (db/transaction.ts).
mongoose.set('transactionAsyncLocalStorage', true);

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected';

export async function connectDatabase(uri: string, logger: Logger): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await assertReplicaSet();
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
}

/**
 * Transactions need a replica set (a single-node one is enough, TRD H-4). Fails fast with a
 * clear message instead of failing later on the first multi-document write.
 */
export async function assertReplicaSet(): Promise<void> {
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName) {
    throw new Error(
      'MongoDB is not running as a replica set, so transactions are unavailable. ' +
        'Start it with `pnpm db:up` (docker-compose runs a single-node replica set) and use ' +
        '`?directConnection=true` in MONGODB_URI.',
    );
  }
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
