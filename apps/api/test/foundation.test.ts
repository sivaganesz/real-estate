import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { EMAIL, login, setup, teardown } from './helpers';

let app: Express;
beforeAll(async () => {
  app = await setup();
});
afterAll(teardown);

describe('foundation', () => {
  it('rejects a wrong password with a clear message', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL.admin, password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/do not match/);
  });

  it('returns the signed-in user and AI mode', async () => {
    const agent = await login(app, EMAIL.priya);
    const res = await agent.get('/api/auth/me');
    expect(res.body.user.role).toBe('executive');
    expect(['claude', 'offline']).toContain(res.body.ai.mode);
  });

  it('blocks executives from managing users', async () => {
    const agent = await login(app, EMAIL.priya);
    const res = await agent.post('/api/users').send({ name: 'X Y', email: 'x@y.z', role: 'admin', password: '12345678' });
    expect(res.status).toBe(403);
  });

  it('stops an admin from demoting themselves', async () => {
    const agent = await login(app, EMAIL.admin);
    const me = (await agent.get('/api/auth/me')).body.user;
    const res = await agent.patch(`/api/users/${me.id}`).send({ role: 'executive' });
    expect(res.status).toBe(400);
  });

  it('answers in offline mode without an AI key', async () => {
    const agent = await login(app, EMAIL.priya);
    const res = await agent.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'hello' }] });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('offline');
    expect(res.body.reply).toMatch(/offline mode/);
  });
});
