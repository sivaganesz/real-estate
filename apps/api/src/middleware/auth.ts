import type { AuthUser, Permission } from '@real-estate/shared';
import type { RequestHandler } from 'express';
import { AppError, forbidden, unauthenticated } from '../lib/errors';
import { CSRF_HEADER } from '../modules/auth/auth.constants';
import { toAuthUser } from '../modules/auth/auth.service';
import { AccessTokenExpiredError } from '../modules/auth/tokens';
import type { AccessTokens } from '../modules/auth/tokens';
import { UserModel } from '../modules/users/user.model';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `authenticate` for signed-in requests. */
      user?: AuthUser;
    }
  }
}

/**
 * Requires a valid `Authorization: Bearer <access token>`. The user is re-read from the
 * database on every request, so deactivation or a role change takes effect immediately.
 */
export function authenticate(accessTokens: AccessTokens): RequestHandler {
  return async (req, _res, next) => {
    const header = req.get('authorization') ?? '';
    if (!header.startsWith('Bearer ')) throw unauthenticated();

    let userId: string;
    try {
      ({ userId } = await accessTokens.verify(header.slice(7)));
    } catch (err) {
      if (err instanceof AccessTokenExpiredError) {
        throw new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please sign in again.');
      }
      throw unauthenticated();
    }

    const user = await UserModel.findById(userId).lean();
    if (!user || user.status !== 'active') throw unauthenticated();
    req.user = toAuthUser(user);
    next();
  };
}

/** Requires every listed permission (use after `authenticate`). */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthenticated();
    if (!permissions.every((p) => req.user!.permissions.includes(p))) throw forbidden();
    next();
  };
}

/**
 * CSRF guard for cookie-authenticated endpoints (refresh, logout): browsers can't send this
 * custom header cross-site without a CORS preflight, which our CORS policy rejects.
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (!req.get(CSRF_HEADER)) {
    throw new AppError(403, 'CSRF_HEADER_MISSING', `Missing ${CSRF_HEADER} header`);
  }
  next();
};
