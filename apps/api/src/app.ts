import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './lib/http';
import { requireAuth } from './lib/auth';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { aiRouter } from './routes/ai';
import { modules, publicRouter } from './modules';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));
  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);

  const api = express.Router();
  api.use(requireAuth);
  api.use('/users', usersRouter);
  api.use('/ai', aiRouter);
  for (const m of modules) api.use(m.path, m.router);
  app.use('/api', api);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}
