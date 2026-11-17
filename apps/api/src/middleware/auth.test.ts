import type { AuthUser } from '@real-estate/shared';
import { effectivePermissions, SYSTEM_ROLES } from '@real-estate/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../lib/logger';
import { requirePermission } from './auth';
import { errorHandler } from './errorHandler';

function appAs(user: AuthUser | undefined) {
  const app = express();
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.get('/users', requirePermission('users:manage'), (_req, res) => {
    res.json({ data: 'ok' });
  });
  app.use(errorHandler(createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' })));
  return app;
}

const userWithRole = (role: 'admin' | 'sales_executive'): AuthUser => ({
  id: '0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60',
  name: 'Test',
  email: 't@x.com',
  phone: null,
  role,
  roleName: SYSTEM_ROLES[role].name,
  permissions: effectivePermissions(role, SYSTEM_ROLES[role].permissions),
});

describe('requirePermission', () => {
  it('allows a role that has the permission', async () => {
    expect((await request(appAs(userWithRole('admin'))).get('/users')).status).toBe(200);
  });

  it('returns 403 for a role without the permission', async () => {
    const res = await request(appAs(userWithRole('sales_executive'))).get('/users');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 when nobody is signed in', async () => {
    expect((await request(appAs(undefined)).get('/users')).status).toBe(401);
  });
});
