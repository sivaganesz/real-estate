import type { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';

/**
 * Runs `fn` inside a MongoDB transaction (TRD §5, H-4). With `transactionAsyncLocalStorage`
 * on (db/mongoose.ts) every Mongoose call made inside `fn` joins the transaction
 * automatically, so services don't pass sessions around.
 *
 * The driver retries `fn` on transient errors, so `fn` must only touch the database:
 * files, emails and other side effects belong before or after it. Nested calls reuse the
 * outer transaction.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (inTransaction()) return fn();
  let result!: T;
  await mongoose.connection.transaction(async () => {
    result = await fn();
  });
  return result;
}

/** Mongoose keeps the active session here when `transactionAsyncLocalStorage` is on (untyped). */
const store = mongoose as unknown as {
  transactionAsyncLocalStorage?: AsyncLocalStorage<{ session?: ClientSession }>;
};

/** True while running inside `withTransaction`. */
export function inTransaction(): boolean {
  return Boolean(store.transactionAsyncLocalStorage?.getStore()?.session);
}
