import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../lib/logger';
import { hashPassword } from '../../lib/password';
import { buildTestApp, startTestDatabase } from '../../test/helpers';
import { CSRF_HEADER } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import { AuthTokenModel } from '../auth/authToken.model';
import { RefreshTokenModel } from '../auth/refreshToken.model';
import { ChangeLogModel } from '../changeLogs/changeLog.model';
import { UserModel } from './user.model';
import { UsersService } from './users.service';

const PASSWORD = 'correct-horse-9';

async function createUser(overrides: Record<string, unknown> = {}) {
  return UserModel.create({
    name: 'Owner Name',
    email: 'owner@company.com',
    role: 'admin',
    status: 'active',
    passwordHash: await hashPassword(PASSWORD),
    ...overrides,
  });
}

describe('users', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let owner: Awaited<ReturnType<typeof createUser>>;
  let token: string;

  const api = () => ({
    get: (path: string) =>
      request(ctx.app).get(`/api/v1/admin${path}`).set('authorization', `Bearer ${token}`),
    post: (path: string, body?: object) =>
      request(ctx.app)
        .post(`/api/v1/admin${path}`)
        .set('authorization', `Bearer ${token}`)
        .send(body),
    patch: (path: string, body: object) =>
      request(ctx.app)
        .patch(`/api/v1/admin${path}`)
        .set('authorization', `Bearer ${token}`)
        .send(body),
  });

  async function signIn(email: string) {
    const res = await request(ctx.app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    return res.body.data.accessToken as string;
  }

  function linkTokenFromLastEmail(path: string): string {
    const text = ctx.email.sent.at(-1)?.text ?? '';
    const match = text.match(new RegExp(`${path}\\?token=([\\w%-]+)`));
    if (!match) throw new Error(`No ${path} link in email`);
    return decodeURIComponent(match[1]!);
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    await Promise.all([
      UserModel.syncIndexes(),
      AuthTokenModel.syncIndexes(),
      RefreshTokenModel.syncIndexes(),
    ]);
  });
  afterAll(async () => {
    await db.stop();
  });
  beforeEach(async () => {
    await db.clear();
    ctx = await buildTestApp();
    owner = await createUser();
    token = await signIn('owner@company.com');
  });

  describe('permissions', () => {
    it('only Admins can use the users API', async () => {
      await createUser({ email: 'manager@company.com', role: 'sales_manager', name: 'Manager' });
      token = await signIn('manager@company.com');
      const res = await api().get('/users');
      expect(res.status).toBe(403);
      expect((await request(ctx.app).get('/api/v1/admin/users')).status).toBe(401);
    });
  });

  describe('list and stats', () => {
    beforeEach(async () => {
      await createUser({
        email: 'agent.a@company.com',
        name: 'Agent A',
        role: 'sales_executive',
        phone: '+919876543210',
      });
      await createUser({
        email: 'agent.b@company.com',
        name: 'Agent B',
        role: 'sales_executive',
        status: 'invited',
        passwordHash: undefined,
      });
      await createUser({
        email: 'agent.c@company.com',
        name: 'Agent C',
        role: 'sales_executive',
        lockedUntil: new Date(Date.now() + 600_000),
      });
      await createUser({
        email: 'former@company.com',
        name: 'Former Staff',
        role: 'admin',
        status: 'inactive',
      });
    });

    it('lists users with pagination meta and no password hashes', async () => {
      const res = await api().get('/users?limit=2');
      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
      expect(res.body.data).toHaveLength(2);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('filters by search text, role and status (including locked)', async () => {
      expect(
        (await api().get('/users?q=agent b')).body.data.map((u: { name: string }) => u.name),
      ).toEqual(['Agent B']);
      expect((await api().get('/users?q=98765')).body.data[0].name).toBe('Agent A');
      expect((await api().get('/users?role=sales_executive')).body.meta.total).toBe(3);
      const locked = (await api().get('/users?status=locked')).body.data;
      expect(locked.map((u: { name: string }) => u.name)).toEqual(['Agent C']);
      expect(locked[0].locked).toBe(true);
      expect((await api().get('/users?status=inactive')).body.data[0].name).toBe('Former Staff');
    });

    it('rejects unknown sort fields and invalid filters', async () => {
      expect((await api().get('/users?sort=passwordHash')).status).toBe(400);
      expect((await api().get('/users?status=deleted')).status).toBe(400);
    });

    it('returns status counts', async () => {
      const res = await api().get('/users/stats');
      expect(res.body.data).toEqual({ active: 3, invited: 1, locked: 1, inactive: 1 });
    });
  });

  describe('invite and accept', () => {
    it('invites a user, emails a 72-hour link, and the user can accept it and is signed in', async () => {
      const res = await api().post('/users', {
        name: 'Priya Kumar',
        email: 'Priya@Company.com',
        phone: '9876543210',
        role: 'sales_executive',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.emailSent).toBe(true);
      expect(res.body.data.user).toMatchObject({
        email: 'priya@company.com',
        phone: '+919876543210',
        status: 'invited',
        role: 'sales_executive',
      });
      const expiresIn = Date.parse(res.body.data.user.inviteExpiresAt) - Date.now();
      expect(expiresIn).toBeGreaterThan(71 * 3600_000);
      expect(ctx.email.sent.at(-1)).toMatchObject({ to: 'priya@company.com' });
      expect(ctx.email.sent.at(-1)!.text).toContain('Owner Name has invited you');

      const inviteToken = linkTokenFromLastEmail('accept-invite');
      const info = await request(ctx.app)
        .post('/api/v1/auth/invite/info')
        .send({ token: inviteToken });
      expect(info.body.data).toEqual({
        name: 'Priya Kumar',
        email: 'priya@company.com',
        role: 'sales_executive',
        roleName: 'Sales Executive',
        invitedBy: 'Owner Name',
      });

      const accepted = await request(ctx.app)
        .post('/api/v1/auth/accept-invite')
        .send({ token: inviteToken, password: 'new-agent-pass-1' });
      expect(accepted.status).toBe(200);
      expect(accepted.body.data.user.email).toBe('priya@company.com');
      expect(accepted.body.data.accessToken).toEqual(expect.any(String));
      expect((await UserModel.findOne({ email: 'priya@company.com' }).lean())?.status).toBe(
        'active',
      );

      // The link only works once.
      const again = await request(ctx.app)
        .post('/api/v1/auth/accept-invite')
        .send({ token: inviteToken, password: 'new-agent-pass-1' });
      expect(again.status).toBe(400);
    });

    it('rejects duplicate emails and invalid input', async () => {
      const dup = await api().post('/users', {
        name: 'Someone',
        email: 'OWNER@company.com',
        role: 'admin',
      });
      expect(dup.status).toBe(409);
      expect(dup.body.error.message).toBe('A user with this email already exists.');

      const bad = await api().post('/users', {
        name: 'X',
        email: 'nope',
        phone: '123',
        role: 'Boss!',
      });
      expect(bad.status).toBe(400);
      const paths = bad.body.error.details.map((d: { path: string }) => d.path);
      expect(paths).toEqual(
        expect.arrayContaining(['body.name', 'body.email', 'body.phone', 'body.role']),
      );
    });

    it('reports when the invite email could not be sent', async () => {
      ctx.email.send = async () => {
        throw new Error('provider down');
      };
      const res = await api().post('/users', {
        name: 'Priya Kumar',
        email: 'priya@company.com',
        role: 'admin',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.emailSent).toBe(false);
    });

    it('resending an invite replaces the old link', async () => {
      const { body } = await api().post('/users', {
        name: 'Priya Kumar',
        email: 'priya@company.com',
        role: 'admin',
      });
      const first = linkTokenFromLastEmail('accept-invite');
      const resent = await api().post(`/users/${body.data.user.id}/resend-invite`);
      expect(resent.status).toBe(200);
      const second = linkTokenFromLastEmail('accept-invite');
      expect(second).not.toBe(first);
      expect(
        (await request(ctx.app).post('/api/v1/auth/invite/info').send({ token: first })).status,
      ).toBe(400);
      expect(
        (await request(ctx.app).post('/api/v1/auth/invite/info').send({ token: second })).status,
      ).toBe(200);

      expect((await api().post(`/users/${owner._id}/resend-invite`)).status).toBe(422);
    });

    it('rejects expired invite links', async () => {
      await api().post('/users', {
        name: 'Priya Kumar',
        email: 'priya@company.com',
        role: 'admin',
      });
      const inviteToken = linkTokenFromLastEmail('accept-invite');
      await AuthTokenModel.updateMany(
        { type: 'invite' },
        { expiresAt: new Date(Date.now() - 1000) },
      );
      const res = await request(ctx.app)
        .post('/api/v1/auth/accept-invite')
        .send({ token: inviteToken, password: 'new-agent-pass-1' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/invalid or has expired/);
    });
  });

  describe('edit and safety rules', () => {
    it('edits name, phone and role, and records the change', async () => {
      const agent = await createUser({
        email: 'agent@company.com',
        name: 'Agent',
        role: 'sales_executive',
        phone: '+919876543210',
      });
      const res = await api().patch(`/users/${agent._id}`, {
        name: 'Agent Renamed',
        phone: '',
        role: 'admin',
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ name: 'Agent Renamed', phone: null, role: 'admin' });
      const log = await ChangeLogModel.findOne({
        entityId: agent._id,
        action: 'role_changed',
      }).lean();
      expect(log?.changes).toMatchObject({
        role: ['sales_executive', 'admin'],
        name: ['Agent', 'Agent Renamed'],
      });
      expect(log?.actorId).toBe(owner._id);
    });

    it("doesn't let you change your own role or deactivate yourself", async () => {
      const role = await api().patch(`/users/${owner._id}`, { role: 'sales_manager' });
      expect(role.status).toBe(422);
      expect(role.body.error.message).toBe("You can't change your own role.");
      expect((await api().post(`/users/${owner._id}/deactivate`)).status).toBe(422);
      // Editing your own name is fine.
      expect((await api().patch(`/users/${owner._id}`, { name: 'Owner Renamed' })).status).toBe(
        200,
      );
    });

    it('lets an Admin demote another Admin while another stays active', async () => {
      await createUser({ email: 'second@company.com', name: 'Second Owner' });
      token = await signIn('second@company.com');
      const res = await api().patch(`/users/${owner._id}`, { role: 'sales_manager' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ role: 'sales_manager', roleName: 'Sales Manager' });
    });

    it('refuses a role that does not exist', async () => {
      const res = await api().post('/users', {
        name: 'Nobody',
        email: 'nobody@company.com',
        role: 'r_does-not-exist',
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNKNOWN_ROLE');
    });

    it('two Admins demoting each other at once can never leave zero Admins (ROLE-02)', async () => {
      const second = await createUser({ email: 'second@company.com', name: 'Second Owner' });
      const secondToken = await signIn('second@company.com');
      const [a, b] = await Promise.all([
        api().patch(`/users/${second._id}`, { role: 'sales_manager' }),
        request(ctx.app)
          .patch(`/api/v1/admin/users/${owner._id}`)
          .set('authorization', `Bearer ${secondToken}`)
          .send({ role: 'sales_manager' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409].sort());
      expect(await UserModel.countDocuments({ role: 'admin', status: 'active' })).toBe(1);
    });

    it('never removes the last active Admin (service safety net)', async () => {
      // Through the API this can't happen (you can't demote or deactivate yourself), so call
      // the service directly with an actor who isn't a stored user.
      const service = new UsersService({
        env: ctx.env,
        email: ctx.email,
        logger: createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
        auth: new AuthService({
          env: ctx.env,
          email: ctx.email,
          logger: createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
        }),
      });
      const outsider = {
        id: '0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60',
        name: 'System',
        email: 's@x.com',
        phone: null,
        role: 'admin',
        roleName: 'Admin',
        permissions: [],
      };
      await expect(
        service.update(outsider, owner._id, { role: 'sales_manager' }),
      ).rejects.toMatchObject({ code: 'LAST_ADMIN' });
      await expect(service.deactivate(outsider, owner._id)).rejects.toMatchObject({
        code: 'LAST_ADMIN',
      });
    });

    it('returns 404 for unknown users and 400 for malformed ids', async () => {
      expect((await api().get('/users/0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60')).status).toBe(404);
      expect((await api().get('/users/not-a-uuid')).status).toBe(400);
    });
  });

  describe('deactivate, reactivate, unlock, reset', () => {
    it('deactivating signs the user out everywhere and blocks sign-in', async () => {
      const agent = await createUser({
        email: 'agent@company.com',
        name: 'Agent',
        role: 'sales_executive',
      });
      const login = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: 'agent@company.com', password: PASSWORD });
      const cookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const res = await api().post(`/users/${agent._id}/deactivate`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('inactive');

      const refresh = await request(ctx.app)
        .post('/api/v1/auth/refresh')
        .set('cookie', cookie)
        .set(CSRF_HEADER, '1');
      expect(refresh.status).toBe(401);
      const again = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: 'agent@company.com', password: PASSWORD });
      expect(again.status).toBe(403);

      const back = await api().post(`/users/${agent._id}/reactivate`);
      expect(back.body.data.status).toBe('active');
      expect(
        (
          await request(ctx.app)
            .post('/api/v1/auth/login')
            .send({ email: 'agent@company.com', password: PASSWORD })
        ).status,
      ).toBe(200);
    });

    it('reactivating someone who never accepted their invite returns them to "invited"', async () => {
      const invited = await createUser({
        email: 'inv@company.com',
        name: 'Invited',
        status: 'inactive',
        passwordHash: undefined,
        role: 'admin',
      });
      const res = await api().post(`/users/${invited._id}/reactivate`);
      expect(res.body.data.status).toBe('invited');
    });

    it('unlocks a locked account', async () => {
      const agent = await createUser({
        email: 'agent@company.com',
        name: 'Agent',
        role: 'sales_executive',
        lockedUntil: new Date(Date.now() + 600_000),
        failedLoginCount: 0,
      });
      expect((await api().get(`/users/${agent._id}`)).body.data.locked).toBe(true);
      const res = await api().post(`/users/${agent._id}/unlock`);
      expect(res.body.data.locked).toBe(false);
      expect(
        (
          await request(ctx.app)
            .post('/api/v1/auth/login')
            .send({ email: 'agent@company.com', password: PASSWORD })
        ).status,
      ).toBe(200);
    });

    it('sends a password reset email to active users only', async () => {
      const agent = await createUser({
        email: 'agent@company.com',
        name: 'Agent',
        role: 'sales_executive',
      });
      const res = await api().post(`/users/${agent._id}/send-password-reset`);
      expect(res.body.data).toEqual({ emailSent: true });
      expect(ctx.email.sent.at(-1)).toMatchObject({ to: 'agent@company.com' });
      expect(ctx.email.sent.at(-1)!.text).toContain('/reset-password?token=');

      const invited = await createUser({
        email: 'inv@company.com',
        name: 'Invited',
        status: 'invited',
        passwordHash: undefined,
        role: 'admin',
      });
      expect((await api().post(`/users/${invited._id}/send-password-reset`)).status).toBe(422);
    });
  });
});
