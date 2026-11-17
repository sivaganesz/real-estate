import { Router } from 'express';
import { z } from 'zod';
import { APP_VERSION } from '../../config/app';
import { databaseStatus } from '../../db/mongoose';
import { registry } from '../../docs/openapi';
import { MIGRATIONS } from '../../migrations';
import { pendingMigrations } from '../../migrations/runner';

const HealthSchema = registry.register(
  'Health',
  z.object({
    status: z.enum(['ok', 'degraded']),
    database: z.enum(['connected', 'connecting', 'disconnected']),
    uptimeSeconds: z.number().int(),
    version: z.string(),
  }),
);

const healthResponse = { 'application/json': { schema: z.object({ data: HealthSchema }) } };

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'API and database status',
  responses: {
    200: { description: 'API is running and the database is connected', content: healthResponse },
    503: { description: 'Database is not connected', content: healthResponse },
  },
});

registry.registerPath({
  method: 'get',
  path: '/live',
  tags: ['System'],
  summary: 'Liveness: the process is up (for the process supervisor)',
  responses: { 200: { description: 'Process is running' } },
});

registry.registerPath({
  method: 'get',
  path: '/ready',
  tags: ['System'],
  summary: 'Readiness: database connected and migrations applied (for the load balancer)',
  responses: {
    200: { description: 'Ready to take traffic' },
    503: { description: 'Not ready: database down or migrations pending' },
  },
});

export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  res.json({ data: { status: 'ok' } });
});

healthRouter.get('/ready', async (_req, res) => {
  const database = databaseStatus();
  const pending =
    database === 'connected' ? (await pendingMigrations(MIGRATIONS)).map((m) => m.id) : null;
  const ready = database === 'connected' && pending?.length === 0;
  res.status(ready ? 200 : 503).json({
    data: { status: ready ? 'ok' : 'not_ready', database, pendingMigrations: pending },
  });
});

healthRouter.get('/health', (_req, res) => {
  const database = databaseStatus();
  const healthy = database === 'connected';
  res.status(healthy ? 200 : 503).json({
    data: {
      status: healthy ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      version: APP_VERSION,
    },
  });
});
