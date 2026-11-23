import fs from 'node:fs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from '../config';

let memory: MongoMemoryServer | null = null;

/**
 * Uses MONGODB_URI when set. Otherwise starts an embedded MongoDB so the app
 * runs with no setup; in dev its data is kept in .data/mongo between restarts.
 */
export async function connectDb(opts: { ephemeral?: boolean } = {}) {
  let uri = config.mongoUri;
  if (!uri) {
    // The binary is downloaded once at install time into the workspace root cache.
    process.env.MONGOMS_DOWNLOAD_DIR ??= config.mongoBinaryDir;
    if (opts.ephemeral) {
      memory = await MongoMemoryServer.create();
    } else {
      fs.mkdirSync(config.dataDir, { recursive: true });
      memory = await MongoMemoryServer.create({
        instance: { dbPath: config.dataDir, storageEngine: 'wiredTiger', port: 27027 },
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
