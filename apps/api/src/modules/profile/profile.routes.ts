import {
  changePasswordBodySchema,
  profileSchema,
  sessionResponseSchema,
  updateProfileBodySchema,
} from '@real-estate/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env';
import { ErrorResponseSchema, registry } from '../../docs/openapi';
import { sendData } from '../../lib/http';
import { authenticate } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimit';
import { endpoint } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import { clientInfo, createSessionResponder } from '../auth/session-response';
import type { ProfileService } from './profile.service';

// ------------------------------------------------------------------ OpenAPI

const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
const err = (description: string) => ({ description, content: json(ErrorResponseSchema) });
const secured = { security: [{ bearerAuth: [] }], tags: ['Profile'] };

registry.registerPath({
  ...secured,
  method: 'get',
  path: '/api/v1/admin/profile',
  summary: 'Your own profile',
  responses: {
    200: { description: 'Profile', content: json(z.object({ data: profileSchema })) },
    401: err('Not signed in'),
  },
});
registry.registerPath({
  ...secured,
  method: 'patch',
  path: '/api/v1/admin/profile',
  summary: 'Update your name or phone',
  request: { body: { content: json(updateProfileBodySchema) } },
  responses: {
    200: { description: 'Updated profile', content: json(z.object({ data: profileSchema })) },
    400: err('Invalid input'),
    401: err('Not signed in'),
  },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: '/api/v1/admin/profile/change-password',
  summary: 'Change your password (signs out other devices; returns a new session)',
  request: { body: { content: json(changePasswordBodySchema) } },
  responses: {
    200: {
      description: 'Password changed. A new refresh cookie is set for this device.',
      content: json(z.object({ data: sessionResponseSchema })),
    },
    400: err('Invalid input, or the current password is incorrect'),
    401: err('Not signed in'),
    429: err('Too many attempts'),
  },
});

// ------------------------------------------------------------------ Routes

export function createProfileRouter(deps: {
  env: Env;
  auth: AuthService;
  profile: ProfileService;
}): Router {
  const { env, auth, profile } = deps;
  const { sendSession } = createSessionResponder(env);
  const router = Router();
  router.use(authenticate(auth.accessTokens));

  router.get('/', async (req, res) => {
    sendData(res, await profile.get(req.user!.id));
  });

  router.patch(
    '/',
    endpoint({ body: updateProfileBodySchema }, async ({ body }, req, res) => {
      sendData(res, await profile.update(req.user!.id, body));
    }),
  );

  router.post(
    '/change-password',
    authRateLimiter(),
    endpoint({ body: changePasswordBodySchema }, async ({ body }, req, res) => {
      const session = await profile.changePassword(
        req.user!.id,
        body.currentPassword,
        body.newPassword,
        clientInfo(req),
      );
      sendSession(res, session);
    }),
  );

  return router;
}
