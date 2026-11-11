import path from 'node:path';
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
import { healthRouter } from './modules/health/health.routes';

/** Everything the app needs from outside; passed in so tests can swap providers. */
export interface AppDeps {
  env: Env;
  logger: Logger;
  storage: StorageProvider;
  email: EmailProvider;
}

/** Routes under /api/v1. Modules (auth, users, settings, …) are added here from step 1.3. */
function createApiRouter(_deps: AppDeps): express.Router {
  return express.Router();
}

export function createApp(deps: AppDeps): Express {
  const { env, logger } = deps;
  const app = express();

  app.disable('x-powered-by');
  // Behind a reverse proxy in production: trust its X-Forwarded-For (needed for rate limits).
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);

  app.use(requestLogger(logger));
  app.use(securityMiddleware(env));
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
