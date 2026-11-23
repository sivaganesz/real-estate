import { connectDb, disconnectDb } from './connect';
import { resetAndSeed, DEMO_PASSWORD } from './seed';
import '../modules';

await connectDb();
await resetAndSeed();
console.log(`Database reset with demo data. Password for every demo user: ${DEMO_PASSWORD}`);
await disconnectDb();
