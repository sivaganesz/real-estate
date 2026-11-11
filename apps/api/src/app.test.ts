import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from './test/helpers';

describe('app (no database)', () => {
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });
  afterAll(async () => {
    await ctx.cleanup();
  });

  it('reports degraded health when the database is not connected', async () => {
    const res = await request(ctx.app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.data).toMatchObject({ status: 'degraded', database: 'disconnected' });
  });

  it('returns 404 in the standard error format with a request id', async () => {
    const res = await request(ctx.app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toMatch(/^req_/);
    expect(res.headers['x-request-id']).toBe(res.body.error.requestId);
  });

  it('reuses a valid incoming x-request-id', async () => {
    const res = await request(ctx.app).get('/nope').set('x-request-id', 'trace-123');
    expect(res.headers['x-request-id']).toBe('trace-123');
    expect(res.body.error.requestId).toBe('trace-123');
  });

  it('rejects malformed JSON bodies with 400', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/anything')
      .set('content-type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('sets security headers and allows the admin origin', async () => {
    const res = await request(ctx.app).get('/health').set('origin', 'http://localhost:5173');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('serves the OpenAPI document and Swagger UI', async () => {
    const spec = await request(ctx.app).get('/api/openapi.json');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.1.0');
    expect(spec.body.paths['/health']).toBeDefined();
    expect(spec.body.components.schemas.ErrorResponse).toBeDefined();

    const ui = await request(ctx.app).get('/api/docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');
  });

  it('serves public upload folders but never the imports folder', async () => {
    await mkdir(path.join(ctx.uploadDir, 'company', 'logo'), { recursive: true });
    await writeFile(path.join(ctx.uploadDir, 'company', 'logo', 'logo.png'), 'png-bytes');
    await mkdir(path.join(ctx.uploadDir, 'imports', 'b1'), { recursive: true });
    await writeFile(path.join(ctx.uploadDir, 'imports', 'b1', 'file.xlsx'), 'secret');

    expect((await request(ctx.app).get('/uploads/company/logo/logo.png')).status).toBe(200);
    expect((await request(ctx.app).get('/uploads/imports/b1/file.xlsx')).status).toBe(404);
  });
});

describe('API docs in production', () => {
  it('are not served without SWAGGER_BASIC_AUTH', async () => {
    const ctx = await buildTestApp({ NODE_ENV: 'production' });
    expect((await request(ctx.app).get('/api/openapi.json')).status).toBe(404);
    await ctx.cleanup();
  });

  it('require basic auth when SWAGGER_BASIC_AUTH is set', async () => {
    const ctx = await buildTestApp({
      NODE_ENV: 'production',
      SWAGGER_BASIC_AUTH: 'docs:secret-pass',
    });
    expect((await request(ctx.app).get('/api/openapi.json')).status).toBe(401);
    const ok = await request(ctx.app).get('/api/openapi.json').auth('docs', 'secret-pass');
    expect(ok.status).toBe(200);
    await ctx.cleanup();
  });
});
