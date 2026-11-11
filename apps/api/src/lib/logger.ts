import { pino } from 'pino';
import type { Logger } from 'pino';
import type { Env } from '../config/env';

export type { Logger };

/**
 * JSON logs (pretty-printed in development). Tokens, passwords, cookies and phone numbers
 * are masked (TRD §16).
 */
export function createLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  return pino({
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.phone',
      ],
      censor: '[redacted]',
    },
    ...(env.NODE_ENV === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  });
}
