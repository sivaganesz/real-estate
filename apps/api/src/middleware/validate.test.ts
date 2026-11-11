import { paginationQuerySchema } from '@real-estate/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createLogger } from '../lib/logger';
import { errorHandler } from './errorHandler';
import { sanitizeBody, stripMongoOperators } from './sanitize';
import { endpoint } from './validate';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(sanitizeBody);
  app.post(
    '/items/:id',
    endpoint(
      {
        params: z.object({ id: z.string().regex(/^\d+$/) }),
        query: paginationQuerySchema,
        body: z.object({ name: z.string().min(2) }),
      },
      ({ params, query, body }, _req, res) => {
        res.json({
          data: { id: params.id, page: query.page, limit: query.limit, name: body.name },
        });
      },
    ),
  );
  app.use(errorHandler(createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' })));
  return app;
}

describe('endpoint() validation', () => {
  it('passes typed, parsed values to the handler', async () => {
    const res = await request(buildApp()).post('/items/42?page=2').send({ name: 'Villa' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: '42', page: 2, limit: 20, name: 'Villa' });
  });

  it('returns 400 VALIDATION_ERROR with one detail per problem', async () => {
    const res = await request(buildApp()).post('/items/abc?limit=500').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['params.id', 'query.limit', 'body.name']));
  });
});

describe('stripMongoOperators', () => {
  it('removes $-prefixed and dotted keys at any depth', () => {
    expect(
      stripMongoOperators({ email: { $ne: null }, 'a.b': 1, nested: [{ ok: 1, $where: 'x' }] }),
    ).toEqual({ email: {}, nested: [{ ok: 1 }] });
  });
});
