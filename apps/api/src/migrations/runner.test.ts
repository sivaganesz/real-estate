import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { inTransaction, withTransaction } from '../db/transaction';
import { createLogger } from '../lib/logger';
import { buildTestApp, startTestDatabase } from '../test/helpers';
import type { Migration } from './runner';
import { migrateDown, migrateUp, pendingMigrations } from './runner';

const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' });
const Thing = mongoose.model('TxThing', new mongoose.Schema({ _id: String, n: Number }));

let db: Awaited<ReturnType<typeof startTestDatabase>>;
beforeAll(async () => {
  db = await startTestDatabase();
  await Thing.createCollection();
});
afterAll(async () => db.stop());
beforeEach(async () => db.clear());

describe('withTransaction', () => {
  it('commits every write made inside it', async () => {
    await withTransaction(async () => {
      expect(inTransaction()).toBe(true);
      await Thing.create({ _id: 'a', n: 1 });
      await Thing.updateOne({ _id: 'a' }, { $inc: { n: 1 } });
    });
    expect(inTransaction()).toBe(false);
    expect((await Thing.findById('a').lean())?.n).toBe(2);
  });

  it('rolls back every write when it throws', async () => {
    await Thing.create({ _id: 'a', n: 1 });
    await expect(
      withTransaction(async () => {
        await Thing.updateOne({ _id: 'a' }, { $set: { n: 5 } });
        await Thing.create({ _id: 'b', n: 1 });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await Thing.findById('a').lean())?.n).toBe(1);
    expect(await Thing.exists({ _id: 'b' })).toBeNull();
  });

  it('returns the callback result and reuses an outer transaction', async () => {
    const result = await withTransaction(async () => {
      await Thing.create({ _id: 'a', n: 1 });
      return withTransaction(async () => Thing.countDocuments());
    });
    expect(result).toBe(1);
  });
});

describe('migrations', () => {
  const ran: string[] = [];
  const make = (id: string, withDown = true): Migration => ({
    id,
    description: id,
    up: async () => {
      ran.push(`up:${id}`);
    },
    ...(withDown && {
      down: async () => {
        ran.push(`down:${id}`);
      },
    }),
  });

  beforeEach(() => {
    ran.length = 0;
  });

  it('applies pending migrations once, in id order', async () => {
    const all = [make('0002-b'), make('0001-a')];
    expect((await pendingMigrations(all)).map((m) => m.id)).toEqual(['0002-b', '0001-a']);
    expect(await migrateUp(all, logger)).toEqual(['0001-a', '0002-b']);
    expect(await migrateUp(all, logger)).toEqual([]);
    expect(ran).toEqual(['up:0001-a', 'up:0002-b']);
    expect(await pendingMigrations(all)).toEqual([]);
  });

  it('reverts the last applied migration', async () => {
    const all = [make('0001-a'), make('0002-b')];
    await migrateUp(all, logger);
    expect(await migrateDown(all, logger)).toBe('0002-b');
    expect((await pendingMigrations(all)).map((m) => m.id)).toEqual(['0002-b']);
  });

  it('refuses to revert a migration without a down step', async () => {
    const all = [make('0001-a', false)];
    await migrateUp(all, logger);
    await expect(migrateDown(all, logger)).rejects.toThrow(/can't be reversed/);
  });

  it('refuses to run while another run holds the lock', async () => {
    await mongoose.connection
      .db!.collection<{ _id: string; at: Date }>('migrations')
      .insertOne({ _id: '__lock', at: new Date() });
    await expect(migrateUp([make('0001-a')], logger)).rejects.toThrow(/in progress/);
  });

  it('a failed migration is not recorded, so it runs again next time', async () => {
    const failing: Migration = {
      id: '0001-x',
      description: 'x',
      up: async () => {
        throw new Error('nope');
      },
    };
    await expect(migrateUp([failing], logger)).rejects.toThrow('nope');
    expect(await pendingMigrations([failing])).toHaveLength(1);
  });
});

describe('health endpoints', () => {
  it('/live is always ok; /ready reports pending migrations', async () => {
    const { app, cleanup } = await buildTestApp();
    await request(app).get('/live').expect(200);
    const res = await request(app).get('/ready').expect(503);
    expect(res.body.data.database).toBe('connected');
    expect(res.body.data.pendingMigrations.length).toBeGreaterThan(0);
    await cleanup();
  });
});
