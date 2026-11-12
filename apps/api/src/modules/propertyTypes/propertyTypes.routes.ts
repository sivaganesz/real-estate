import {
  addAttributeBodySchema,
  attributeMatchSchema,
  CATEGORY_KEYS,
  createAmenityBodySchema,
  createSubcategoryBodySchema,
  idSchema,
  propertyTypesSchema,
  reorderAmenitiesBodySchema,
  updateAmenityBodySchema,
  updateAttributeBodySchema,
  updateSubcategoryBodySchema,
} from '@real-estate/shared';
import { Router } from 'express';
import { z } from 'zod';
import { ErrorResponseSchema, registry } from '../../docs/openapi';
import { sendData } from '../../lib/http';
import { authenticate, requirePermission } from '../../middleware/auth';
import { endpoint } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { AttributeTarget, PropertyTypesService } from './propertyTypes.service';

// ------------------------------------------------------------------ OpenAPI

const BASE = '/api/v1/admin/property-types';
const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
const err = (description: string) => ({ description, content: json(ErrorResponseSchema) });
const secured = { security: [{ bearerAuth: [] }], tags: ['Property types'] };
const setup = {
  description: 'The full, updated setup',
  content: json(z.object({ data: propertyTypesSchema })),
};
const editErrors = {
  400: err('Invalid input'),
  401: err('Not signed in'),
  403: err('Needs settings:edit'),
  404: err('Not found'),
  409: err('Duplicate name, code prefix or attribute'),
  422: err('Category set up later, or locked by existing properties'),
};

const subcategoryParams = z.object({ id: idSchema });
const categoryParams = z.object({ key: z.enum(CATEGORY_KEYS) });
const subAttrParams = z.object({ id: idSchema, attributeId: idSchema });
const catAttrParams = z.object({ key: z.enum(CATEGORY_KEYS), attributeId: idSchema });
const searchQuery = z.object({ q: z.string().trim().max(60).default('') });

registry.registerPath({
  ...secured,
  method: 'get',
  path: BASE,
  summary: 'Categories, subcategories and their attributes (any role that can view properties)',
  responses: { 200: setup, 401: err('Not signed in') },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: `${BASE}/attributes`,
  summary: 'Find existing attributes by name, to reuse instead of creating duplicates',
  request: { query: searchQuery },
  responses: {
    200: {
      description: 'Matches',
      content: json(z.object({ data: z.array(attributeMatchSchema) })),
    },
    401: err('Not signed in'),
    403: err('Needs settings:edit'),
  },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: `${BASE}/subcategories`,
  summary: 'Add a subcategory',
  request: { body: { content: json(createSubcategoryBodySchema) } },
  responses: { 201: setup, ...editErrors },
});
registry.registerPath({
  ...secured,
  method: 'patch',
  path: `${BASE}/subcategories/{id}`,
  summary: 'Edit a subcategory (name, code prefix, purposes, active)',
  request: { params: subcategoryParams, body: { content: json(updateSubcategoryBodySchema) } },
  responses: { 200: setup, ...editErrors },
});
registry.registerPath({
  ...secured,
  method: 'delete',
  path: `${BASE}/subcategories/{id}`,
  summary: 'Delete a subcategory that has no properties',
  request: { params: subcategoryParams },
  responses: { 200: setup, ...editErrors },
});
for (const [scope, path, params] of [
  ['a category (common attribute)', `${BASE}/categories/{key}/attributes`, categoryParams],
  ['a subcategory', `${BASE}/subcategories/{id}/attributes`, subcategoryParams],
] as const) {
  registry.registerPath({
    ...secured,
    method: 'post',
    path,
    summary: `Add a new or existing attribute to ${scope}`,
    request: { params, body: { content: json(addAttributeBodySchema) } },
    responses: { 201: setup, ...editErrors },
  });
  const itemParams = params === categoryParams ? catAttrParams : subAttrParams;
  registry.registerPath({
    ...secured,
    method: 'patch',
    path: `${path}/{attributeId}`,
    summary: `Edit an attribute of ${scope} (name, type, options apply everywhere it is used)`,
    request: { params: itemParams, body: { content: json(updateAttributeBodySchema) } },
    responses: { 200: setup, ...editErrors },
  });
  registry.registerPath({
    ...secured,
    method: 'delete',
    path: `${path}/{attributeId}`,
    summary: `Remove an attribute from ${scope}`,
    request: { params: itemParams },
    responses: { 200: setup, ...editErrors },
  });
}

const amenityParams = z.object({ id: idSchema });
registry.registerPath({
  ...secured,
  method: 'post',
  path: `${BASE}/categories/{key}/amenities`,
  summary: 'Add an amenity to a category (for all its subcategories or some)',
  request: { params: categoryParams, body: { content: json(createAmenityBodySchema) } },
  responses: { 201: setup, ...editErrors },
});
registry.registerPath({
  ...secured,
  method: 'put',
  path: `${BASE}/categories/{key}/amenities/order`,
  summary: 'Save the order of the amenity checklist (every amenity id, in order)',
  request: { params: categoryParams, body: { content: json(reorderAmenitiesBodySchema) } },
  responses: { 200: setup, ...editErrors },
});
registry.registerPath({
  ...secured,
  method: 'patch',
  path: `${BASE}/amenities/{id}`,
  summary: 'Edit an amenity (name, icon, subcategories, active)',
  request: { params: amenityParams, body: { content: json(updateAmenityBodySchema) } },
  responses: { 200: setup, ...editErrors },
});
registry.registerPath({
  ...secured,
  method: 'delete',
  path: `${BASE}/amenities/{id}`,
  summary: 'Delete an amenity that no property has ticked',
  request: { params: amenityParams },
  responses: { 200: setup, ...editErrors },
});

// ------------------------------------------------------------------ Routes

export function createPropertyTypesRouter(deps: {
  auth: AuthService;
  propertyTypes: PropertyTypesService;
}): Router {
  const { auth, propertyTypes: service } = deps;
  const router = Router();
  const canEdit = requirePermission('settings:edit');
  router.use(authenticate(auth.accessTokens));

  router.get('/', requirePermission('properties:read'), async (_req, res) => {
    sendData(res, await service.getAll());
  });

  router.get(
    '/attributes',
    canEdit,
    endpoint({ query: searchQuery }, async ({ query }, _req, res) => {
      sendData(res, await service.searchAttributes(query.q));
    }),
  );

  router.post(
    '/subcategories',
    canEdit,
    endpoint({ body: createSubcategoryBodySchema }, async ({ body }, req, res) => {
      sendData(res, await service.createSubcategory(req.user!.id, body), 201);
    }),
  );
  router.patch(
    '/subcategories/:id',
    canEdit,
    endpoint(
      { params: subcategoryParams, body: updateSubcategoryBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await service.updateSubcategory(req.user!.id, params.id, body));
      },
    ),
  );
  router.delete(
    '/subcategories/:id',
    canEdit,
    endpoint({ params: subcategoryParams }, async ({ params }, req, res) => {
      sendData(res, await service.deleteSubcategory(req.user!.id, params.id));
    }),
  );

  // Attributes: the same three actions for a category's common attributes and a subcategory.
  const targets = [
    {
      path: '/categories/:key/attributes',
      params: categoryParams,
      itemParams: catAttrParams,
      target: (p: { key: (typeof CATEGORY_KEYS)[number] }): AttributeTarget => ({
        kind: 'category',
        key: p.key,
      }),
    },
    {
      path: '/subcategories/:id/attributes',
      params: subcategoryParams,
      itemParams: subAttrParams,
      target: (p: { id: string }): AttributeTarget => ({ kind: 'subcategory', id: p.id }),
    },
  ] as const;

  for (const t of targets) {
    const toTarget = t.target as (p: Record<string, string>) => AttributeTarget;
    router.post(
      t.path,
      canEdit,
      endpoint(
        { params: t.params, body: addAttributeBodySchema },
        async ({ params, body }, req, res) => {
          sendData(res, await service.addAttribute(req.user!.id, toTarget(params), body), 201);
        },
      ),
    );
    router.patch(
      `${t.path}/:attributeId`,
      canEdit,
      endpoint(
        { params: t.itemParams, body: updateAttributeBodySchema },
        async ({ params, body }, req, res) => {
          sendData(
            res,
            await service.updateAttribute(req.user!.id, toTarget(params), params.attributeId, body),
          );
        },
      ),
    );
    router.delete(
      `${t.path}/:attributeId`,
      canEdit,
      endpoint({ params: t.itemParams }, async ({ params }, req, res) => {
        sendData(
          res,
          await service.removeAttribute(req.user!.id, toTarget(params), params.attributeId),
        );
      }),
    );
  }

  // Amenities
  router.post(
    '/categories/:key/amenities',
    canEdit,
    endpoint(
      { params: categoryParams, body: createAmenityBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await service.createAmenity(req.user!.id, params.key, body), 201);
      },
    ),
  );
  router.put(
    '/categories/:key/amenities/order',
    canEdit,
    endpoint(
      { params: categoryParams, body: reorderAmenitiesBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await service.reorderAmenities(req.user!.id, params.key, body.ids));
      },
    ),
  );
  router.patch(
    '/amenities/:id',
    canEdit,
    endpoint(
      { params: amenityParams, body: updateAmenityBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await service.updateAmenity(req.user!.id, params.id, body));
      },
    ),
  );
  router.delete(
    '/amenities/:id',
    canEdit,
    endpoint({ params: amenityParams }, async ({ params }, req, res) => {
      sendData(res, await service.deleteAmenity(req.user!.id, params.id));
    }),
  );

  return router;
}
