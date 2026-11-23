import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/user';

export const DEMO_PASSWORD = 'demo1234';

type Seeder = { name: string; run: (ctx: SeedCtx) => Promise<void> };
export type SeedCtx = { users: Record<'admin' | 'manager' | 'priya' | 'arun' | 'divya', { _id: mongoose.Types.ObjectId; name: string }> };

const seeders: Seeder[] = [];
/** Each module adds its demo data here, so the seed grows with the product. */
export function registerSeeder(name: string, run: Seeder['run']) {
  seeders.push({ name, run });
}

export async function seedAll() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const admin = await User.create({ name: 'Anitha Rao', email: 'admin@estate.test', phone: '+919840000001', role: 'admin', passwordHash: hash });
  const manager = await User.create({ name: 'Karthik Menon', email: 'manager@estate.test', phone: '+919840000002', role: 'manager', passwordHash: hash });
  const exec = (name: string, email: string, phone: string) =>
    User.create({ name, email, phone, role: 'executive', managerId: manager._id, passwordHash: hash });
  const priya = await exec('Priya Sundar', 'priya@estate.test', '+919840000003');
  const arun = await exec('Arun Kumar', 'arun@estate.test', '+919840000004');
  const divya = await exec('Divya Raman', 'divya@estate.test', '+919840000005');
  const ctx: SeedCtx = { users: { admin, manager, priya, arun, divya } };
  for (const s of seeders) await s.run(ctx);
}

export async function seedIfEmpty() {
  if ((await User.estimatedDocumentCount()) > 0) return false;
  await seedAll();
  console.log(`Seeded demo data. Sign in as admin@estate.test / manager@estate.test / priya@estate.test with password "${DEMO_PASSWORD}".`);
  return true;
}

export async function resetAndSeed() {
  await mongoose.connection.dropDatabase();
  await seedAll();
}
