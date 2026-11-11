import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password';
import { buildTestApp, startTestDatabase } from '../../test/helpers';
import { CSRF_HEADER, REFRESH_COOKIE_NAME } from '../auth/auth.constants';
import { RefreshTokenModel } from '../auth/refreshToken.model';
import { ChangeLogModel } from '../changeLogs/changeLog.model';
import { UserModel } from '../users/user.model';

const PASSWORD = 'correct-horse-9';

describe('profile', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let userId: string;
  let token: string;
  let cookie: string;

  const authed = (req: request.Test) => req.set('authorization', `Bearer ${token}`);
  const cookieFrom = (res: request.Response) =>
    (res.headers['set-cookie'] as unknown as string[])
      .find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`))!
      .split(';')[0]!;

  beforeAll(async () => {
    db = await startTestDatabase();
    await Promise.all([UserModel.syncIndexes(), RefreshTokenModel.syncIndexes()]);
  });
  afterAll(async () => {
    await db.stop();
  });
  beforeEach(async () => {
    await db.clear();
    ctx = await buildTestApp();
    const user = await UserModel.create({
      name: 'Agent Ravi',
      email: 'ravi@company.com',
      phone: '+919876543210',
      role: 'sales_agent',
      status: 'active',
      passwordHash: await hashPassword(PASSWORD),
    });
    userId = user._id;
    const login = await request(ctx.app)
      .post('/api/v1/auth/login')
      .send({ email: 'ravi@company.com', password: PASSWORD });
    token = login.body.data.accessToken;
    cookie = cookieFrom(login);
  });

  it('any role can read their own profile (no password hash)', async () => {
    const res = await authed(request(ctx.app).get('/api/v1/admin/profile'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: userId,
      name: 'Agent Ravi',
      email: 'ravi@company.com',
      phone: '+919876543210',
      role: 'sales_agent',
    });
    expect(res.body.data.lastLoginAt).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect((await request(ctx.app).get('/api/v1/admin/profile')).status).toBe(401);
  });

  it('other /admin paths are not blocked by the Super Admin guard (404, not 403)', async () => {
    const res = await authed(request(ctx.app).get('/api/v1/admin/does-not-exist'));
    expect(res.status).toBe(404);
    expect((await authed(request(ctx.app).get('/api/v1/admin/users'))).status).toBe(403);
  });

  it('updates name and phone, clears the phone with "", and ignores email/role', async () => {
    const res = await authed(request(ctx.app).patch('/api/v1/admin/profile')).send({
      name: 'Ravi Kumar',
      phone: '',
      email: 'hacker@company.com',
      role: 'super_admin',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Ravi Kumar',
      phone: null,
      email: 'ravi@company.com',
      role: 'sales_agent',
    });
    const log = await ChangeLogModel.findOne({
      entityId: userId,
      action: 'profile_updated',
    }).lean();
    expect(log?.changes).toMatchObject({ name: ['Agent Ravi', 'Ravi Kumar'] });

    const bad = await authed(request(ctx.app).patch('/api/v1/admin/profile')).send({
      phone: '123',
    });
    expect(bad.status).toBe(400);
  });

  describe('change password', () => {
    it('requires the correct current password', async () => {
      const res = await authed(request(ctx.app).post('/api/v1/admin/profile/change-password')).send(
        {
          currentPassword: 'wrong-password-1',
          newPassword: 'brand-new-pass-7',
        },
      );
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
      expect(res.body.error.details[0].path).toBe('body.currentPassword');
    });

    it('rejects weak or unchanged passwords', async () => {
      const weak = await authed(
        request(ctx.app).post('/api/v1/admin/profile/change-password'),
      ).send({
        currentPassword: PASSWORD,
        newPassword: 'short',
      });
      expect(weak.status).toBe(400);
      const same = await authed(
        request(ctx.app).post('/api/v1/admin/profile/change-password'),
      ).send({
        currentPassword: PASSWORD,
        newPassword: PASSWORD,
      });
      expect(same.status).toBe(400);
      expect(same.body.error.details[0].message).toMatch(/different from your current one/);
    });

    it('saves the new password, signs out other devices, keeps this one signed in and emails the user', async () => {
      const res = await authed(request(ctx.app).post('/api/v1/admin/profile/change-password')).send(
        {
          currentPassword: PASSWORD,
          newPassword: 'brand-new-pass-7',
        },
      );
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      const newCookie = cookieFrom(res);

      // The old session (other device) is revoked…
      const old = await request(ctx.app)
        .post('/api/v1/auth/refresh')
        .set('cookie', cookie)
        .set(CSRF_HEADER, '1');
      expect(old.status).toBe(401);
      // …but the new cookie for this device works.
      const fresh = await request(ctx.app)
        .post('/api/v1/auth/refresh')
        .set('cookie', newCookie)
        .set(CSRF_HEADER, '1');
      expect(fresh.status).toBe(200);

      const login = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: 'ravi@company.com', password: 'brand-new-pass-7' });
      expect(login.status).toBe(200);
      expect(ctx.email.sent.at(-1)).toMatchObject({ to: 'ravi@company.com' });
      expect(ctx.email.sent.at(-1)!.subject).toMatch(/password was changed/);
      expect(
        await ChangeLogModel.exists({ entityId: userId, action: 'password_changed' }),
      ).toBeTruthy();
    });
  });
});
