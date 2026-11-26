import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { EMAIL, login, setup, teardown } from './helpers';

let app: Express;
beforeAll(async () => {
  app = await setup();
});
afterAll(teardown);

describe('switch role (demo accounts only)', () => {
  it('lists every demo account by role, and switches straight into one', async () => {
    const manager = await login(app, EMAIL.manager);
    const options = (await manager.get('/api/auth/switch')).body.options as { id: string; name: string; role: string }[];
    expect(options.map((o) => o.role)).toEqual(expect.arrayContaining(['admin', 'manager', 'executive']));
    expect(options[0].role).toBe('admin');

    const priya = options.find((o) => o.name === 'Priya Sundar')!;
    const r = await manager.post('/api/auth/switch').send({ userId: priya.id });
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ name: 'Priya Sundar', role: 'executive' });
    // The same browser session is now Priya, with an executive's permissions.
    expect((await manager.get('/api/auth/me')).body.user.role).toBe('executive');
    expect((await manager.post('/api/users').send({ name: 'No Way', email: 'no@way.in', role: 'admin', password: '12345678' })).status).toBe(403);

    // And back up to admin.
    const admin = options.find((o) => o.role === 'admin')!;
    await manager.post('/api/auth/switch').send({ userId: admin.id });
    expect((await manager.get('/api/auth/me')).body.user.role).toBe('admin');
  });

  it('a real (non-demo) account sees no options and cannot switch', async () => {
    const admin = await login(app, EMAIL.admin);
    await admin.post('/api/users').send({ name: 'Real Person', email: 'real.person@company.in', role: 'executive', password: 'realpass123' });
    const real = request.agent(app);
    expect((await real.post('/api/auth/login').send({ email: 'real.person@company.in', password: 'realpass123' })).status).toBe(200);
    expect((await real.get('/api/auth/switch')).body.options).toEqual([]);
    const target = ((await admin.get('/api/auth/switch')).body.options as { id: string; role: string }[]).find((o) => o.role === 'admin')!;
    const r = await real.post('/api/auth/switch').send({ userId: target.id });
    expect(r.status).toBe(403);
    expect((await real.get('/api/auth/me')).body.user.email).toBe('real.person@company.in');
  });

  it('cannot switch into an account outside the demo list', async () => {
    const manager = await login(app, EMAIL.manager);
    const r = await manager.post('/api/auth/switch').send({ userId: '64b000000000000000000000' });
    expect(r.status).toBe(404);
    expect((await request(app).get('/api/auth/switch')).status).toBe(401);
  });
});
