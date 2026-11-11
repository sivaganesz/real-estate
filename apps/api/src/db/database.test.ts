import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { verifyPassword } from '../lib/password';
import { ChangeLogModel } from '../modules/changeLogs/changeLog.model';
import { diffFields, recordChange } from '../modules/changeLogs/changeLog.service';
import { SettingsModel } from '../modules/settings/settings.model';
import { UserModel } from '../modules/users/user.model';
import { buildTestApp, startTestDatabase } from '../test/helpers';
import { seedCompanySettings, seedSuperAdmin } from './seed';

describe('with a database', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;

  beforeAll(async () => {
    db = await startTestDatabase();
    await UserModel.syncIndexes();
  });
  afterAll(async () => {
    await db.stop();
  });
  beforeEach(async () => {
    await db.clear();
  });

  it('reports healthy when the database is connected', async () => {
    const ctx = await buildTestApp();
    const res = await request(ctx.app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'connected' });
    await ctx.cleanup();
  });

  describe('seed', () => {
    const admin = { name: 'Owner', email: 'Owner@Company.com', password: 'changeme123' };

    it('creates the first Super Admin once, with a hashed password', async () => {
      expect(await seedSuperAdmin({ ...admin, email: 'owner@company.com' })).toBe('created');
      expect(await seedSuperAdmin({ ...admin, email: 'other@company.com' })).toBe('exists');

      const users = await UserModel.find().select('+passwordHash');
      expect(users).toHaveLength(1);
      const user = users[0]!;
      expect(user).toMatchObject({
        email: 'owner@company.com',
        role: 'super_admin',
        status: 'active',
      });
      expect(user.passwordHash).not.toBe(admin.password);
      expect(await verifyPassword(user.passwordHash!, admin.password)).toBe(true);
      expect(await verifyPassword(user.passwordHash!, 'wrong-password1')).toBe(false);
    });

    it('creates default company settings once', async () => {
      expect(await seedCompanySettings()).toBe('created');
      expect(await seedCompanySettings()).toBe('exists');
      const doc = await SettingsModel.findOne({ key: 'company' }).lean();
      expect(doc?.value).toMatchObject({ name: 'Your Company Name', phone: '', email: '' });
    });
  });

  it('enforces unique user emails', async () => {
    await UserModel.create({ name: 'A', email: 'a@x.com', role: 'admin' });
    await expect(UserModel.create({ name: 'B', email: 'A@X.com', role: 'admin' })).rejects.toThrow(
      /duplicate key/,
    );
  });

  it('records change logs with field diffs', async () => {
    const changes = diffFields({ name: 'Old', role: 'admin' }, { name: 'New', role: 'admin' }, [
      'name',
      'role',
    ]);
    expect(changes).toEqual({ name: ['Old', 'New'] });

    const user = await UserModel.create({ name: 'New', email: 'n@x.com', role: 'admin' });
    await recordChange({ entity: 'user', entityId: user._id, action: 'updated', changes });
    const log = await ChangeLogModel.findOne({ entityId: user._id }).lean();
    expect(log).toMatchObject({
      entity: 'user',
      action: 'updated',
      changes: { name: ['Old', 'New'] },
    });
  });
});
