/**
 * Application errors. Anything thrown as an AppError is returned to the client as
 * { error: { code, message, details?, requestId } } with the given HTTP status (TRD §5.2).
 */

export interface ErrorDetail {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: ErrorDetail[]) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const validationError = (details: ErrorDetail[]) =>
  new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid', details);

export const unauthenticated = (message = 'Please sign in to continue') =>
  new AppError(401, 'UNAUTHENTICATED', message);

export const forbidden = (message = "You don't have permission to do this") =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);

export const businessRule = (message: string) => new AppError(422, 'BUSINESS_RULE', message);

export const upstreamError = (message = 'An external service is unavailable. Please try again.') =>
  new AppError(502, 'UPSTREAM_ERROR', message);
