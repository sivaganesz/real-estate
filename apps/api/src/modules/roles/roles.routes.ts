import {
  createRoleBodySchema,
  moveRoleUsersBodySchema,
  permissionCatalogSchema,
  roleKeySchema,
  roleOptionSchema,
  roleSchema,
  updateRoleBodySchema,
} from '@real-estate/shared';
import { Router } from 'express';
import { z } from 'zod';
import { requireIfMatch } from '../../db/versionPlugin';
import { ErrorResponseSchema, registry } from '../../docs/openapi';
import { sendData } from '../../lib/http';
import { authenticate, requirePermission } from '../../middleware/auth';
import { endpoint } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { RolesService } from './roles.service';

// ------------------------------------------------------------------ OpenAPI

const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
const err = (description: string) => ({ description, content: json(ErrorResponseSchema) });
const data = (schema: z.ZodType, description = 'OK') => ({
  description,
  content: json(z.object({ data: schema })),
});
const keyParams = z.object({ key: roleKeySchema });
const secured = { security: [{ bearerAuth: [] }], tags: ['Roles'] };
const common = { 401: err('Not signed in'), 403: err('Only Admins can manage roles') };
const ifMatch = z.object({ 'if-match': z.string().meta({ example: '"2"' }) });
const rolesListSchema = z.object({
  roles: z.array(roleSchema),
  matrix: z.array(
    z.object({
      module: z.string(),
      release: z.string(),
      access: z.record(z.string(), z.enum(['full', 'none', 'own', 'view'])),
    }),
  ),
});

registry.registerPath({
  ...secured,
  method: 'get',
  path: '/api/v1/admin/permissions',
  summary: 'The fixed permission catalogue offered by the role editor (ROLE-07)',
  responses: { 200: data(permissionCatalogSchema), ...common },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: '/api/v1/admin/roles',
  summary: 'Roles with user counts, plus the permission matrix (one column per role)',
  responses: { 200: data(rolesListSchema), ...common },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: '/api/v1/admin/roles/options',
  summary: 'Slim role list for the Invite user / Edit user pickers',
  responses: { 200: data(z.array(roleOptionSchema)), ...common },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: '/api/v1/admin/roles',
  summary: 'Create a custom role (ROLE-04)',
  request: { body: { content: json(createRoleBodySchema) } },
  responses: {
    201: data(roleSchema, 'Created'),
    ...common,
    409: err('A role with this name already exists'),
    422: err('Reserved permission (users / roles management is Admin only)'),
  },
});
registry.registerPath({
  ...secured,
  method: 'patch',
  path: '/api/v1/admin/roles/{key}',
  summary: 'Edit a role (ROLE-05). System roles: permissions only; Admin: never',
  request: { params: keyParams, headers: ifMatch, body: { content: json(updateRoleBodySchema) } },
  responses: {
    200: data(roleSchema),
    ...common,
    409: err('VERSION_CONFLICT or duplicate name'),
    422: err('Reserved permission, or renaming a system role'),
    428: err('If-Match header missing'),
  },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: '/api/v1/admin/roles/{key}/reset',
  summary: 'Reset Sales Manager / Sales Executive to the default permissions',
  request: { params: keyParams },
  responses: { 200: data(roleSchema), ...common },
});
registry.registerPath({
  ...secured,
  method: 'delete',
  path: '/api/v1/admin/roles/{key}',
  summary: 'Delete a custom role that no user has (ROLE-06)',
  request: { params: keyParams },
  responses: {
    204: { description: 'Deleted' },
    ...common,
    409: err('ROLE_IN_USE: move its users first (details carry the user count)'),
  },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: '/api/v1/admin/roles/{key}/move-users',
  summary: 'Move every user of this role to another role, in one transaction (ROLE-06)',
  request: { params: keyParams, body: { content: json(moveRoleUsersBodySchema) } },
  responses: { 200: data(z.object({ moved: z.number().int() })), ...common },
});

// ------------------------------------------------------------------ Routes

export function createRolesRouter(deps: { roles: RolesService; auth: AuthService }): Router {
  const { roles, auth } = deps;
  const router = Router();
  const signedIn = authenticate(auth.accessTokens);

  // Role pickers on the Users screens need only user management.
  router.get('/roles/options', signedIn, requirePermission('users:manage'), async (_req, res) => {
    sendData(res, await roles.options());
  });

  router.use(['/roles', '/permissions'], signedIn, requirePermission('roles:manage'));

  router.get('/permissions', (_req, res) => {
    sendData(res, roles.catalog());
  });

  router.get('/roles', async (_req, res) => {
    sendData(res, await roles.list());
  });

  router.post(
    '/roles',
    endpoint({ body: createRoleBodySchema }, async ({ body }, req, res) => {
      sendData(res, await roles.create(req.user!, body), 201);
    }),
  );

  router.patch(
    '/roles/:key',
    endpoint(
      { params: keyParams, body: updateRoleBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await roles.update(req.user!, params.key, body, requireIfMatch(req)));
      },
    ),
  );

  router.post(
    '/roles/:key/reset',
    endpoint({ params: keyParams }, async ({ params }, req, res) => {
      sendData(res, await roles.reset(req.user!, params.key));
    }),
  );

  router.delete(
    '/roles/:key',
    endpoint({ params: keyParams }, async ({ params }, req, res) => {
      await roles.remove(req.user!, params.key);
      res.status(204).end();
    }),
  );

  router.post(
    '/roles/:key/move-users',
    endpoint(
      { params: keyParams, body: moveRoleUsersBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await roles.moveUsers(req.user!, params.key, body.toRole));
      },
    ),
  );

  return router;
}
