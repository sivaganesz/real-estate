import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { parseEnv } from '../config/env';
import type { Env } from '../config/env';
import type { EmailMessage, EmailProvider } from '../lib/email';
import { createLogger } from '../lib/logger';
import { LocalStorageProvider } from '../lib/storage';

export const TEST_ENV_VARS = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/real_estate_test',
  JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0001',
  ADMIN_ORIGIN: 'http://localhost:5173',
  APP_BASE_URL: 'http://localhost:5173',
  EMAIL_PROVIDER: 'console',
} as const;

export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({ ...TEST_ENV_VARS, ...overrides });
}

/** Email provider that records messages instead of sending them. */
export class FakeEmailProvider implements EmailProvider {
  readonly name = 'fake';
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
    return { id: `fake_${this.sent.length}` };
  }
}

/** Builds the app with a temporary upload folder and a fake email provider. */
export async function buildTestApp(envOverrides: Record<string, string> = {}) {
  const uploadDir = await mkdtemp(path.join(tmpdir(), 're-uploads-'));
  const env = testEnv({ UPLOAD_DIR: uploadDir, ...envOverrides });
  // Always silent in tests, even when a test simulates NODE_ENV=production.
  const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' });
  const storage = new LocalStorageProvider(uploadDir);
  const email = new FakeEmailProvider();
  const app = createApp({ env, logger, storage, email });
  return {
    app,
    env,
    storage,
    email,
    uploadDir,
    cleanup: () => rm(uploadDir, { recursive: true, force: true }),
  };
}

/** Starts an in-memory MongoDB and connects Mongoose to it. */
export async function startTestDatabase() {
  // The default 10 s start limit is too tight when every package's tests run at once.
  const server = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await mongoose.connect(server.getUri(), { dbName: 'real_estate_test' });
  return {
    clear: async () => {
      const collections = await mongoose.connection.db?.collections();
      await Promise.all((collections ?? []).map((c) => c.deleteMany({})));
    },
    stop: async () => {
      await mongoose.disconnect();
      await server.stop();
    },
  };
}
