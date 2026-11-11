import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password';
import { buildTestApp, startTestDatabase } from '../../test/helpers';
import { UserModel } from '../users/user.model';
import { CSRF_HEADER, REFRESH_COOKIE_NAME } from './auth.constants';
import { AuthTokenModel } from './authToken.model';
import { RefreshTokenModel } from './refreshToken.model';

const PASSWORD = 'correct-horse-9';
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function createUser(overrides: Record<string, unknown> = {}) {
  return UserModel.create({
    name: 'Admin User',
    email: 'admin@company.com',
    role: 'admin',
    status: 'active',
    passwordHash: await hashPassword(PASSWORD),
    ...overrides,
  });
}

function login(
  app: Parameters<typeof request>[0],
  email = 'admin@company.com',
  password = PASSWORD,
) {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

function refreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (!cookie) throw new Error('No refresh cookie set');
  return cookie.split(';')[0]!;
}

describe('auth', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    db = await startTestDatabase();
    await Promise.all([
      UserModel.syncIndexes(),
      RefreshTokenModel.syncIndexes(),
      AuthTokenModel.syncIndexes(),
    ]);
  });
  afterAll(async () => {
    await db.stop();
  });
  beforeEach(async () => {
    await db.clear();
    ctx = await buildTestApp(); // fresh app = fresh rate-limit counters
  });

  describe('login', () => {
    it('signs in, returns the user with permissions and sets an httpOnly refresh cookie', async () => {
      const user = await createUser();
      expect(user._id).toMatch(UUID_V7);

      const res = await login(ctx.app, 'ADMIN@company.com ');
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.expiresIn).toBe(900);
      expect(res.body.data.user).toMatchObject({
        id: user._id,
        email: 'admin@company.com',
        role: 'admin',
      });
      expect(res.body.data.user.permissions).toContain('settings:edit');
      expect(res.body.data.user.permissions).not.toContain('users:manage');

      const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
      expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=`);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

      const stored = await UserModel.findById(user._id).lean();
      expect(stored?.lastLoginAt).toBeInstanceOf(Date);
      expect(await RefreshTokenModel.countDocuments({ userId: user._id })).toBe(1);
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      await createUser();
      const wrong = await login(ctx.app, 'admin@company.com', 'wrong-pass-1');
      const unknown = await login(ctx.app, 'nobody@company.com', 'wrong-pass-1');
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      });
      expect(unknown.body.error.message).toBe(wrong.body.error.message);
    });

    it('locks the account for 15 minutes after 5 failed attempts', async () => {
      const user = await createUser();
      for (let i = 0; i < 5; i++) {
        expect((await login(ctx.app, 'admin@company.com', 'wrong-pass-1')).status).toBe(401);
      }
      const locked = await login(ctx.app); // correct password, but locked
      expect(locked.status).toBe(423);
      expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
      expect(locked.body.error.message).toMatch(/15 minutes/);

      // Once the lock expires, the correct password works again and the counter resets.
      await UserModel.updateOne({ _id: user._id }, { lockedUntil: new Date(Date.now() - 1000) });
      expect((await login(ctx.app)).status).toBe(200);
      expect((await UserModel.findById(user._id).lean())?.failedLoginCount).toBe(0);
    });

    it('rejects inactive users (after checking the password) and invited users without a password', async () => {
      await createUser({ status: 'inactive' });
      const inactive = await login(ctx.app);
      expect(inactive.status).toBe(403);
      expect(inactive.body.error.code).toBe('ACCOUNT_INACTIVE');

      await createUser({
        email: 'invited@company.com',
        status: 'invited',
        passwordHash: undefined,
      });
      expect((await login(ctx.app, 'invited@company.com')).status).toBe(401);
    });

    it('validates the request body', async () => {
      const res = await request(ctx.app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rate-limits login attempts per IP', async () => {
      for (let i = 0; i < 10; i++) await login(ctx.app, 'nobody@company.com', 'x');
      const limited = await login(ctx.app, 'nobody@company.com', 'x');
      expect(limited.status).toBe(429);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('me', () => {
    it('returns the signed-in user', async () => {
      await createUser({ role: 'super_admin' });
      const { body } = await login(ctx.app);
      const res = await request(ctx.app)
        .get('/api/v1/auth/me')
        .set('authorization', `Bearer ${body.data.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('super_admin');
      expect(res.body.data.permissions).toContain('users:manage');
    });

    it('requires a valid token and an active user', async () => {
      const user = await createUser();
      const { body } = await login(ctx.app);
      expect((await request(ctx.app).get('/api/v1/auth/me')).status).toBe(401);
      expect(
        (await request(ctx.app).get('/api/v1/auth/me').set('authorization', 'Bearer garbage'))
          .status,
      ).toBe(401);

      // Deactivation takes effect immediately, even with an unexpired token.
      await UserModel.updateOne({ _id: user._id }, { status: 'inactive' });
      const res = await request(ctx.app)
        .get('/api/v1/auth/me')
        .set('authorization', `Bearer ${body.data.accessToken}`);
      expect(res.status).toBe(401);
    });
  });

  describe('refresh and logout', () => {
    it('requires the CSRF header', async () => {
      const res = await request(ctx.app).post('/api/v1/auth/refresh');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_HEADER_MISSING');
    });

    it('rotates the refresh token and issues a new access token', async () => {
      await createUser();
      const first = refreshCookie(await login(ctx.app));
      const res = await request(ctx.app)
        .post('/api/v1/auth/refresh')
        .set('cookie', first)
        .set(CSRF_HEADER, 'XMLHttpRequest');
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(refreshCookie(res)).not.toBe(first);
    });

    it('revokes the whole session when an old refresh token is reused', async () => {
      await createUser();
      const first = refreshCookie(await login(ctx.app));
      const second = refreshCookie(
        await request(ctx.app)
          .post('/api/v1/auth/refresh')
          .set('cookie', first)
          .set(CSRF_HEADER, '1'),
      );
      // Move the first token's revocation outside the grace window, then reuse it.
      await RefreshTokenModel.updateMany(
        { replacedBy: { $ne: null } },
        { revokedAt: new Date(Date.now() - 60_000) },
      );
      const reuse = await request(ctx.app)
        .post('/api/v1/auth/refresh')
        .set('cookie', first)
        .set(CSRF_HEADER, '1');
      expect(reuse.status).toBe(401);
      // The newer token from the same session is now revoked too.
      const after = await request(ctx.app)
        .post('/api/v1/auth/refresh')
        .set('cookie', second)
        .set(CSRF_HEADER, '1');
      expect(after.status).toBe(401);
    });

    it('signs out after 30 minutes without a refresh', async () => {
      await createUser();
      const cookie = refreshCookie(await login(ctx.app));
      await RefreshTokenModel.collection.updateMany(
        {},
        { $set: { createdAt: new Date(Date.now() - 31 * 60_000) } },
      );
      const res = await request(ctx.app)
        .post('/api/v1/auth/refresh')
        .set('cookie', cookie)
        .set(CSRF_HEADER, '1');
      expect(res.status).toBe(401);
    });

    it('logout revokes the session and clears the cookie', async () => {
      await createUser();
      const cookie = refreshCookie(await login(ctx.app));
      const out = await request(ctx.app)
        .post('/api/v1/auth/logout')
        .set('cookie', cookie)
        .set(CSRF_HEADER, '1');
      expect(out.status).toBe(204);
      expect((out.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(/re_refresh=;/);
      const res = await request(ctx.app)
        .post('/api/v1/auth/refresh')
        .set('cookie', cookie)
        .set(CSRF_HEADER, '1');
      expect(res.status).toBe(401);
    });
  });

  describe('forgot and reset password', () => {
    function resetTokenFromEmail(): string {
      const mail = ctx.email.sent.at(-1);
      const match = mail?.text?.match(/reset-password\?token=([\w%-]+)/);
      if (!match) throw new Error('No reset link in email');
      return decodeURIComponent(match[1]!);
    }

    it('always answers 200 and only emails existing active users', async () => {
      const unknown = await request(ctx.app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@company.com' });
      expect(unknown.status).toBe(200);
      expect(ctx.email.sent).toHaveLength(0);

      await createUser();
      const known = await request(ctx.app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'admin@company.com' });
      expect(known.status).toBe(200);
      expect(known.body.data.message).toBe(unknown.body.data.message);
      expect(ctx.email.sent).toHaveLength(1);
      expect(ctx.email.sent[0]).toMatchObject({ to: 'admin@company.com' });
      expect(ctx.email.sent[0]!.text).toContain('http://localhost:5173/reset-password?token=');
    });

    it('resets the password once, signs out all sessions and unlocks the account', async () => {
      const user = await createUser({ lockedUntil: new Date(Date.now() + 10 * 60_000) });
      await RefreshTokenModel.create({
        userId: user._id,
        tokenHash: 'existing-session',
        familyId: 'f1',
        sessionStartedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      });

      await request(ctx.app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'admin@company.com' });
      const token = resetTokenFromEmail();

      const reset = await request(ctx.app)
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'brand-new-pass-7' });
      expect(reset.status).toBe(200);
      expect(ctx.email.sent.at(-1)!.subject).toMatch(/password was changed/);

      expect(await RefreshTokenModel.countDocuments({ userId: user._id, revokedAt: null })).toBe(0);
      expect((await login(ctx.app)).status).toBe(401);
      expect((await login(ctx.app, 'admin@company.com', 'brand-new-pass-7')).status).toBe(200);

      const again = await request(ctx.app)
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'another-pass-8' });
      expect(again.status).toBe(400);
    });

    it('rejects expired links and weak passwords', async () => {
      await createUser();
      await request(ctx.app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'admin@company.com' });
      const token = resetTokenFromEmail();

      const weak = await request(ctx.app)
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'short' });
      expect(weak.status).toBe(400);
      expect(weak.body.error.code).toBe('VALIDATION_ERROR');

      await AuthTokenModel.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
      const expired = await request(ctx.app)
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'brand-new-pass-7' });
      expect(expired.status).toBe(400);
      expect(expired.body.error.message).toMatch(/invalid or has expired/);
    });
  });
});
