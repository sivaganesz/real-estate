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
    const e = err as { type?: string; name?: string; code?: number; status?: number };
    // body-parser errors
    if (e.type === 'entity.too.large')
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    if (e.type === 'entity.parse.failed') return badRequest('Request body is not valid JSON');
    // Mongoose / MongoDB
    if (e.name === 'CastError') return badRequest('Invalid id');
    if (e.code === 11000) return new AppError(409, 'DUPLICATE', 'This record already exists');
  }
  return undefined;
}

/**
 * Converts every error into { error: { code, message, details?, requestId } } (TRD §5.2).
 * Unexpected errors are logged and returned as 500 without internal details.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
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
