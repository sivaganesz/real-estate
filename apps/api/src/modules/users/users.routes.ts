import {
  emailResultSchema,
  idSchema,
  inviteUserBodySchema,
  listUsersQuerySchema,
  pageMetaSchema,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_MATRIX,
  ROLES,
  updateUserBodySchema,
  userSchema,
  userStatsSchema,
} from '@real-estate/shared';
import { Router } from 'express';
import { z } from 'zod';
import { ErrorResponseSchema, registry } from '../../docs/openapi';
import { sendData, sendList } from '../../lib/http';
import { authenticate, requirePermission } from '../../middleware/auth';
import { endpoint } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { UsersService } from './users.service';

// ------------------------------------------------------------------ OpenAPI

const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
const err = (description: string) => ({ description, content: json(ErrorResponseSchema) });
const data = (schema: z.ZodType, description = 'OK') => ({
  description,
  content: json(z.object({ data: schema })),
});
const idParams = z.object({ id: idSchema });
const secured = { security: [{ bearerAuth: [] }], tags: ['Users'] };
const common = {
  401: err('Not signed in'),
  403: err('Only Super Admins can manage users'),
};

const roleInfoSchema = z.object({
  role: z.enum(ROLES),
  label: z.string(),
  description: z.string(),
});
const rolesResponseSchema = z.object({
  roles: z.array(roleInfoSchema),
  matrix: z.array(
    z.object({
      module: z.string(),
      phase: z.number().int(),
      access: z.record(z.enum(ROLES), z.enum(['full', 'none', 'own', 'view'])),
    }),
  ),
});

registry.registerPath({
  ...secured,
  method: 'get',
  path: '/api/v1/admin/users',
  summary: 'List users (search, role and status filters, pagination)',
  request: { query: listUsersQuerySchema },
  responses: {
    200: {
      description: 'Users',
      content: json(z.object({ data: z.array(userSchema), meta: pageMetaSchema })),
    },
    ...common,
  },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: '/api/v1/admin/users/stats',
  summary: 'Counts of active, invited, locked and inactive users',
  responses: { 200: data(userStatsSchema), ...common },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: '/api/v1/admin/users',
  summary: 'Invite a user (emails a 72-hour link)',
  request: { body: { content: json(inviteUserBodySchema) } },
  responses: {
    201: data(z.object({ user: userSchema }).extend(emailResultSchema.shape), 'Invited'),
    400: err('Invalid input'),
    409: err('A user with this email already exists'),
    ...common,
  },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: '/api/v1/admin/users/{id}',
  summary: 'Get one user',
  request: { params: idParams },
  responses: { 200: data(userSchema), 404: err('User not found'), ...common },
});
registry.registerPath({
  ...secured,
  method: 'patch',
  path: '/api/v1/admin/users/{id}',
  summary: 'Edit name, phone or role (you cannot change your own role)',
  request: { params: idParams, body: { content: json(updateUserBodySchema) } },
  responses: {
    200: data(userSchema),
    404: err('User not found'),
    422: err('Business rule, e.g. own role or last Super Admin'),
    ...common,
  },
});
for (const [action, summary, response] of [
  [
    'resend-invite',
    'Send a new invite link to an invited user',
    z.object({ user: userSchema }).extend(emailResultSchema.shape),
  ],
  ['deactivate', 'Deactivate a user (signs them out everywhere)', userSchema],
  ['reactivate', 'Reactivate a deactivated user', userSchema],
  ['send-password-reset', 'Email the user a password reset link', emailResultSchema],
  ['unlock', 'Unlock an account locked after failed logins', userSchema],
] as const) {
  registry.registerPath({
    ...secured,
    method: 'post',
    path: `/api/v1/admin/users/{id}/${action}`,
    summary,
    request: { params: idParams },
    responses: {
      200: data(response),
      404: err('User not found'),
      422: err('Not allowed for this user'),
      ...common,
    },
  });
}
registry.registerPath({
  ...secured,
  tags: ['Users'],
  method: 'get',
  path: '/api/v1/admin/roles',
  summary: 'The three fixed roles and what each can do (read-only)',
  responses: { 200: data(rolesResponseSchema), ...common },
});

// ------------------------------------------------------------------ Routes

export function createUsersRouter(deps: { users: UsersService; auth: AuthService }): Router {
  const { users, auth } = deps;
  const router = Router();
  router.use(authenticate(auth.accessTokens), requirePermission('users:manage'));

  router.get(
    '/users',
    endpoint({ query: listUsersQuerySchema }, async ({ query }, _req, res) => {
      const { items, meta } = await users.list(query);
      sendList(res, items, meta);
    }),
  );

  router.get('/users/stats', async (_req, res) => {
    sendData(res, await users.stats());
  });

  router.post(
    '/users',
    endpoint({ body: inviteUserBodySchema }, async ({ body }, req, res) => {
      sendData(res, await users.invite(req.user!, body), 201);
    }),
  );

  router.get(
    '/users/:id',
    endpoint({ params: idParams }, async ({ params }, _req, res) => {
      sendData(res, await users.get(params.id));
    }),
  );

  router.patch(
    '/users/:id',
    endpoint(
      { params: idParams, body: updateUserBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await users.update(req.user!, params.id, body));
      },
    ),
  );

  const action = (
    path: string,
    run: (actorId: Parameters<UsersService['unlock']>[0], id: string) => Promise<unknown>,
  ) =>
    router.post(
      `/users/:id/${path}`,
      endpoint({ params: idParams }, async ({ params }, req, res) => {
        sendData(res, await run(req.user!, params.id));
      }),
    );
  action('resend-invite', (actor, id) => users.resendInvite(actor, id));
  action('deactivate', (actor, id) => users.deactivate(actor, id));
  action('reactivate', (actor, id) => users.reactivate(actor, id));
  action('send-password-reset', (actor, id) => users.sendPasswordReset(actor, id));
  action('unlock', (actor, id) => users.unlock(actor, id));

  router.get('/roles', (_req, res) => {
    sendData(res, {
      roles: ROLES.map((role) => ({
        role,
        label: ROLE_LABELS[role],
        description: ROLE_DESCRIPTIONS[role],
      })),
      matrix: ROLE_MATRIX,
    });
  });

  return router;
}
