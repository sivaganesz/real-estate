import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Express } from 'express';
import type { Env } from './config/env';
import { mountApiDocs } from './docs/openapi';
import type { EmailProvider } from './lib/email';
import type { Logger } from './lib/logger';
import { PUBLIC_UPLOAD_FOLDERS } from './lib/storage';
import type { StorageProvider } from './lib/storage';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { sanitizeBody } from './middleware/sanitize';
import { securityMiddleware } from './middleware/security';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { healthRouter } from './modules/health/health.routes';

/** Everything the app needs from outside; passed in so tests can swap providers. */
export interface AppDeps {
  env: Env;
  logger: Logger;
  storage: StorageProvider;
  email: EmailProvider;
}

/** Routes under /api/v1. Each module mounts its own router here. */
function createApiRouter(deps: AppDeps): express.Router {
  const router = express.Router();
  const auth = new AuthService(deps);
  router.use('/auth', createAuthRouter({ env: deps.env, auth }));
  return router;
}

export function createApp(deps: AppDeps): Express {
  const { env, logger } = deps;
  const app = express();

  app.disable('x-powered-by');
  // Behind a reverse proxy in production: trust its X-Forwarded-For (needed for rate limits).
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);

  app.use(requestLogger(logger));
  app.use(securityMiddleware(env));
  app.use(cookieParser());
  app.use(sanitizeBody);

  // Public uploaded files (logo, property media). The imports folder is never served.
  for (const folder of PUBLIC_UPLOAD_FOLDERS) {
    app.use(
      `/uploads/${folder}`,
      express.static(path.resolve(env.UPLOAD_DIR, folder), {
        maxAge: '7d',
        index: false,
        dotfiles: 'deny',
      }),
    );
  }

  app.use(healthRouter);
  app.use('/api/v1', createApiRouter(deps));
  mountApiDocs(app, env);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
