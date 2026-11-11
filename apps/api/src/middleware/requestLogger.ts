import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../lib/logger';

const SAFE_REQUEST_ID = /^[\w-]{1,100}$/;

/**
 * Logs every request and gives it an id (`req.id`). A valid incoming `x-request-id` header
 * is reused; otherwise a new id is generated. The id is returned in the `x-request-id`
 * response header and in every error response.
 */
export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
          ? incoming
          : `req_${randomUUID()}`;
      res.setHeader('x-request-id', id);
      return id;
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    autoLogging: { ignore: (req) => req.url === '/health' },
  });
}
