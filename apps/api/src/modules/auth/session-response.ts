import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../../config/env';
import { sendData } from '../../lib/http';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants';
import type { Session } from './auth.service';

/**
 * Sends a session to the browser: the refresh token as an httpOnly cookie (scoped to the
 * auth routes) and the access token + user in the JSON body. Used by login, refresh,
 * accept-invite and change-password.
 */
export function createSessionResponder(env: Pick<Env, 'NODE_ENV'>) {
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };

  return {
    cookieOptions,
    sendSession(res: Response, session: Session) {
      res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
        ...cookieOptions,
        expires: session.refreshExpiresAt,
      });
      sendData(res, {
        accessToken: session.accessToken,
        expiresIn: session.expiresIn,
        user: session.user,
      });
    },
    clearSession(res: Response) {
      res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    },
  };
}

export function clientInfo(req: Request) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}
