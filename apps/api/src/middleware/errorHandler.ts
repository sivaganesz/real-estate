import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { AppError, badRequest, notFound } from '../lib/errors';
import type { Logger } from '../lib/logger';

/** Unknown routes → 404 in the standard error format. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`Route ${req.method} ${req.path} not found`));
};

function toAppError(err: unknown): AppError | undefined {
  if (err instanceof AppError) return err;

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return new AppError(400, 'FILE_TOO_LARGE', 'File is too large');
    return badRequest(err.message);
  }

  if (err && typeof err === 'object') {
    const e = err as {
      type?: string;
      name?: string;
      code?: number;
      status?: number;
      expose?: boolean;
      hasErrorLabel?: (label: string) => boolean;
    };
    // body-parser errors
    if (e.type === 'entity.too.large')
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    if (e.type === 'entity.parse.failed') return badRequest('Request body is not valid JSON');
    // Mongoose / MongoDB
    if (e.name === 'CastError') return badRequest('Invalid id');
    if (e.code === 11000) return new AppError(409, 'DUPLICATE', 'This record already exists');
    // A transaction that still conflicted after the driver's retries (two saves at once).
    if (e.code === 112 || e.hasErrorLabel?.('TransientTransactionError')) {
      return new AppError(
        409,
        'WRITE_CONFLICT',
        'Someone else saved at the same moment. Please try again.',
      );
    }
    // Other client errors raised by Express and its middleware keep their 4xx status (L7).
    if (typeof e.status === 'number' && e.status >= 400 && e.status < 500 && e.expose) {
      return new AppError(e.status, 'BAD_REQUEST', 'The request could not be processed');
    }
  }
  return undefined;
}

/**
 * Converts every error into { error: { code, message, details?, requestId } } (TRD §5.2).
 * Unexpected errors are logged and returned as 500 without internal details.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    // A response already started (e.g. a file stream failed midway): let Express close it (L7).
    if (res.headersSent) {
      logger.error({ err, requestId: req.id }, 'Error after the response started');
      next(err);
      return;
    }
    const requestId = String(req.id ?? '');
    let appError = toAppError(err);

    if (!appError) {
      logger.error({ err, requestId }, 'Unhandled error');
      appError = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
    } else if (appError.status >= 500) {
      logger.error({ err, requestId }, appError.message);
    }

    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details && { details: appError.details }),
        requestId,
      },
    });
  };
}
