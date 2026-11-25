import fs from 'node:fs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from '../config';

const LOCAL_URI = 'mongodb://127.0.0.1:27027/estate';
let memory: MongoMemoryServer | null = null;

/**
 * Uses MONGODB_URI when set. Otherwise starts an embedded MongoDB so the app
 * runs with no setup; in dev its data is kept in .data/mongo between restarts.
 */
export async function connectDb(opts: { ephemeral?: boolean } = {}) {
  let uri = config.mongoUri;
  // After a restart (watch mode, a second terminal) the embedded database may
  // still be running and holding its files: reuse it instead of starting another.
  if (!uri && !opts.ephemeral) {
    try {
      await mongoose.connect(LOCAL_URI, { serverSelectionTimeoutMS: 1500 });
      return LOCAL_URI;
    } catch {
      await mongoose.disconnect().catch(() => {});
    }
  }
  if (!uri) {
    // The binary is downloaded once at install time into the workspace root cache.
    process.env.MONGOMS_DOWNLOAD_DIR ??= config.mongoBinaryDir;
    if (opts.ephemeral) {
      memory = await MongoMemoryServer.create();
    } else {
      fs.mkdirSync(config.dataDir, { recursive: true });
      memory = await MongoMemoryServer.create({
        // A small cache keeps the embedded database inside a 512 MB server (Render's free plan).
        instance: { dbPath: config.dataDir, storageEngine: 'wiredTiger', port: 27027, args: ['--wiredTigerCacheSizeGB', '0.25'] },
      });
    }
    uri = memory.getUri('estate');
  }
  await mongoose.connect(uri);
  return uri;
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memory) await memory.stop();
  memory = null;
}
