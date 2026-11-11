import { timingSafeEqual } from 'node:crypto';
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import type { Express, RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import { APP_NAME, APP_VERSION } from '../config/app';
import type { Env } from '../config/env';

extendZodWithOpenApi(z);

/**
 * One registry for the whole API. Each module registers its routes and schemas here when
 * it is imported; the document is generated from the same Zod schemas used for
 * validation (TRD §5.4).
 */
export const registry = new OpenAPIRegistry();

export const ErrorResponseSchema = registry.register(
  'ErrorResponse',
  z.object({
    error: z.object({
      code: z.string().meta({ example: 'VALIDATION_ERROR' }),
      message: z.string().meta({ example: 'Some fields are invalid' }),
      details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
      requestId: z.string().meta({ example: 'req_6f1c…' }),
    }),
  }),
);

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: APP_NAME,
      version: APP_VERSION,
      description:
        'REST API for the real estate admin portal. Responses use `{ data, meta }`; errors use `{ error: { code, message, details, requestId } }`.',
    },
    servers: [{ url: '/' }],
  });
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function basicAuth(credentials: string): RequestHandler {
  const expected = Buffer.from(credentials).toString('base64');
  return (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const given = header.startsWith('Basic ') ? header.slice(6) : '';
    if (given && safeEqual(given, expected)) return next();
    res.set('WWW-Authenticate', 'Basic realm="API docs"');
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'API docs require a login',
        requestId: String(req.id ?? ''),
      },
    });
  };
}

/**
 * Swagger UI at /api/docs and the raw spec at /api/openapi.json. Open in development and
 * test; in production the docs are only served when SWAGGER_BASIC_AUTH is set.
 */
export function mountApiDocs(app: Express, env: Env): void {
  const isProduction = env.NODE_ENV === 'production';
  if (isProduction && !env.SWAGGER_BASIC_AUTH) return;

  const guard: RequestHandler[] = env.SWAGGER_BASIC_AUTH ? [basicAuth(env.SWAGGER_BASIC_AUTH)] : [];
  const document = buildOpenApiDocument();

  app.get('/api/openapi.json', ...guard, (_req, res) => {
    res.json(document);
  });
  app.use(
    '/api/docs',
    ...guard,
    swaggerUi.serve,
    swaggerUi.setup(document, { customSiteTitle: `${APP_NAME} docs` }),
  );
}
