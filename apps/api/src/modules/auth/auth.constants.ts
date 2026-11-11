/** Authentication settings (TRD §6, PRD ADM-AUTH). */

/** Access token (JWT, sent as `Authorization: Bearer …`). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Absolute session length from sign-in, even if the user stays active. */
export const SESSION_MAX_DAYS = 7;

/** Signed out after this much inactivity (no token refresh within the window). */
export const SESSION_IDLE_MINUTES = 30;

/** A refresh token reused within this window is treated as a harmless race (e.g. two tabs). */
export const REFRESH_REUSE_GRACE_SECONDS = 10;

/** Account lock after repeated failed logins. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

/** One-time links sent by email. */
export const PASSWORD_RESET_TTL_MINUTES = 60;
export const INVITE_TTL_HOURS = 72;

/** Refresh token cookie: httpOnly, only sent to the auth routes. */
export const REFRESH_COOKIE_NAME = 're_refresh';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** Cookie-based endpoints (refresh, logout) require this header as a CSRF guard. */
export const CSRF_HEADER = 'x-requested-with';

export const TOKEN_ISSUER = 'real-estate-api';
export const TOKEN_AUDIENCE = 'real-estate-admin';
