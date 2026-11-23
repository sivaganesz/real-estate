import mongoose from 'mongoose';
import { connectDb, disconnectDb } from './connect';
import { resetAndSeed, DEMO_PASSWORD } from './seed';
import { config } from '../config';
import '../modules';

// If the dev server is running, its embedded database is already up: reuse it.
let reused = false;
if (!config.mongoUri) {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27027/estate', { serverSelectionTimeoutMS: 1500 });
    reused = true;
  } catch {
    await mongoose.disconnect().catch(() => {});
  }
}
if (!reused) await connectDb();
await resetAndSeed();
console.log(`Database reset with demo data. Password for every demo user: ${DEMO_PASSWORD}`);
if (reused) await mongoose.disconnect();
else await disconnectDb();
