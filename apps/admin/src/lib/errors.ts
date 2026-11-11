import { ApiError } from './api';

/** A user-friendly message for any error thrown by the API client. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status >= 500) return 'Something went wrong on our side. Please try again.';
    return error.message;
  }
  if (error instanceof TypeError)
    return "Can't reach the server. Check your connection and try again.";
  return 'Something went wrong. Please try again.';
}
