import { Router } from 'express';
import { z } from 'zod';
import { APP_VERSION } from '../../config/app';
import { databaseStatus } from '../../db/mongoose';
import { registry } from '../../docs/openapi';

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

export const healthRouter = Router();

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
