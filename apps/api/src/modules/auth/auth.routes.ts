import {
  acceptInviteBodySchema,
  authUserSchema,
  forgotPasswordBodySchema,
  inviteInfoSchema,
  loginBodySchema,
  resetPasswordBodySchema,
  sessionResponseSchema,
} from '@real-estate/shared';
import { Router } from 'express';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env';
import { ErrorResponseSchema, registry } from '../../docs/openapi';
import { sendData } from '../../lib/http';
import { authenticate, requireCsrfHeader } from '../../middleware/auth';
import { authRateLimiter, passwordResetRateLimiter } from '../../middleware/rateLimit';
import { endpoint } from '../../middleware/validate';
import { CSRF_HEADER, REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants';
import type { UsersService } from '../users/users.service';
import type { AuthService, Session } from './auth.service';

// ------------------------------------------------------------------ OpenAPI

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
const errorResponse = (description: string) => ({
  description,
  content: json(ErrorResponseSchema),
});
const sessionResponse = {
  description: 'Signed in. The refresh token is set as an httpOnly cookie.',
  content: json(z.object({ data: sessionResponseSchema })),
};
const messageResponse = (description: string) => ({
  description,
  content: json(z.object({ data: z.object({ message: z.string() }) })),
});
const csrfHeader = z.object({ [CSRF_HEADER]: z.string().meta({ example: 'XMLHttpRequest' }) });

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['Auth'],
  summary: 'Sign in with email and password',
  request: { body: { content: json(loginBodySchema) } },
  responses: {
    200: sessionResponse,
    400: errorResponse('Invalid input'),
    401: errorResponse('Email or password is incorrect'),
    403: errorResponse('Account is not active'),
    423: errorResponse('Account locked after too many failed attempts'),
    429: errorResponse('Too many attempts'),
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/refresh',
  tags: ['Auth'],
  summary: 'Get a new access token using the refresh cookie (rotates the cookie)',
  request: { headers: csrfHeader },
  responses: {
    200: sessionResponse,
    401: errorResponse('Session expired'),
    403: errorResponse('Missing CSRF header'),
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['Auth'],
  summary: 'Sign out (revokes the session and clears the cookie)',
  request: { headers: csrfHeader },
  responses: { 204: { description: 'Signed out' }, 403: errorResponse('Missing CSRF header') },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  tags: ['Auth'],
  summary: 'The signed-in user and their permissions',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Current user', content: json(z.object({ data: authUserSchema })) },
    401: errorResponse('Not signed in or token expired'),
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/forgot-password',
  tags: ['Auth'],
  summary: 'Email a password reset link (always returns 200)',
  request: { body: { content: json(forgotPasswordBodySchema) } },
  responses: { 200: messageResponse('Request accepted'), 429: errorResponse('Too many requests') },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/reset-password',
  tags: ['Auth'],
  summary: 'Set a new password using the link token (signs out all sessions)',
  request: { body: { content: json(resetPasswordBodySchema) } },
  responses: {
    200: messageResponse('Password changed'),
    400: errorResponse('Invalid input, or the link is invalid or expired'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/auth/invite',
  tags: ['Auth'],
  summary: 'Details of an invite link (for the accept-invite screen)',
  request: { query: z.object({ token: z.string() }) },
  responses: {
    200: { description: 'Invite is valid', content: json(z.object({ data: inviteInfoSchema })) },
    400: errorResponse('The link is invalid or has expired'),
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/accept-invite',
  tags: ['Auth'],
  summary: 'Set a password from an invite link; activates the account and signs in',
  request: { body: { content: json(acceptInviteBodySchema) } },
  responses: {
    200: sessionResponse,
    400: errorResponse('Invalid input, or the link is invalid or expired'),
  },
});

// ------------------------------------------------------------------ Routes

function clientInfo(req: Request) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

export function createAuthRouter(deps: {
  env: Env;
  auth: AuthService;
  users: UsersService;
}): Router {
  const { env, auth, users } = deps;
  const router = Router();

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };

  function sendSession(res: Response, session: Session) {
    res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
      ...cookieOptions,
      expires: session.refreshExpiresAt,
    });
    sendData(res, {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: session.user,
    });
  }

  const readRefreshCookie = (req: Request): string | undefined => {
    const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
    return typeof value === 'string' ? value : undefined;
  };

  router.post(
    '/login',
    authRateLimiter(),
    endpoint({ body: loginBodySchema }, async ({ body }, req, res) => {
      sendSession(res, await auth.login(body.email, body.password, clientInfo(req)));
    }),
  );

  router.post('/refresh', requireCsrfHeader, async (req, res) => {
    try {
      sendSession(res, await auth.refresh(readRefreshCookie(req), clientInfo(req)));
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
      throw err;
    }
  });

  router.post('/logout', requireCsrfHeader, async (req, res) => {
    await auth.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    res.status(204).end();
  });

  router.get('/me', authenticate(auth.accessTokens), (req, res) => {
    sendData(res, req.user);
  });

  router.post(
    '/forgot-password',
    passwordResetRateLimiter(),
    endpoint({ body: forgotPasswordBodySchema }, async ({ body }, _req, res) => {
      await auth.forgotPassword(body.email);
      sendData(res, {
        message: "If an account exists for this email, we've sent a link to reset the password.",
      });
    }),
  );

  router.post(
    '/reset-password',
    authRateLimiter(),
    endpoint({ body: resetPasswordBodySchema }, async ({ body }, _req, res) => {
      await auth.resetPassword(body.token, body.password);
      sendData(res, { message: 'Your password has been changed. Please sign in.' });
    }),
  );

  router.get(
    '/invite',
    authRateLimiter(),
    endpoint(
      { query: z.object({ token: z.string().min(20).max(200) }) },
      async ({ query }, _req, res) => {
        sendData(res, await users.getInviteInfo(query.token));
      },
    ),
  );

  router.post(
    '/accept-invite',
    authRateLimiter(),
    endpoint({ body: acceptInviteBodySchema }, async ({ body }, req, res) => {
      sendSession(res, await users.acceptInvite(body.token, body.password, clientInfo(req)));
    }),
  );

  return router;
}
