import {
  bulkStatusBodySchema,
  bulkStatusResultSchema,
  changeStatusBodySchema,
  createPropertyBodySchema,
  idSchema,
  listPropertiesQuerySchema,
  locationSuggestionSchema,
  locationSuggestionsQuerySchema,
  MEDIA_RULES,
  pageMetaSchema,
  propertyHistoryEntrySchema,
  propertyListItemSchema,
  propertySchema,
  propertyStatusCountsSchema,
  reorderMediaBodySchema,
  uploadMediaQuerySchema,
  updatePropertyBodySchema,
} from '@real-estate/shared';
import type { RequestHandler } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ErrorResponseSchema, registry } from '../../docs/openapi';
import { sendData, sendList } from '../../lib/http';
import { authenticate, requirePermission } from '../../middleware/auth';
import { endpoint } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import { AppError } from '../../lib/errors';
import { fileExtension } from '../../lib/storage';
import type { PropertyMediaService } from './media.service';
import type { PropertiesService } from './properties.service';

// ------------------------------------------------------------------ OpenAPI

const BASE = '/api/v1/admin/properties';
const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
const err = (description: string) => ({ description, content: json(ErrorResponseSchema) });
const data = (schema: z.ZodType, description = 'OK') => ({
  description,
  content: json(z.object({ data: schema })),
});
const secured = { security: [{ bearerAuth: [] }], tags: ['Properties'] };
const idParams = z.object({ id: idSchema });
const readErrors = { 401: err('Not signed in'), 403: err('Missing permission') };
const writeErrors = {
  400: err('Invalid input'),
  ...readErrors,
  404: err('Property not found'),
  422: err('Not allowed now (status rules, missing details to publish, inactive subcategory)'),
};

registry.registerPath({
  ...secured,
  method: 'get',
  path: BASE,
  summary:
    'List properties: search, filters, sorting and pagination (archived left out unless asked)',
  request: { query: listPropertiesQuerySchema },
  responses: {
    200: {
      description: 'Properties',
      content: json(z.object({ data: z.array(propertyListItemSchema), meta: pageMetaSchema })),
    },
    ...readErrors,
  },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: `${BASE}/status-counts`,
  summary: 'Number of properties per status (for the list tabs)',
  responses: { 200: data(propertyStatusCountsSchema), ...readErrors },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: `${BASE}/location-suggestions`,
  summary: 'Cities, localities, pincodes or states already used, most used first',
  request: { query: locationSuggestionsQuerySchema },
  responses: { 200: data(z.array(locationSuggestionSchema)), ...readErrors },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: BASE,
  summary: 'Create a property as a Draft (needs properties:write)',
  request: { body: { content: json(createPropertyBodySchema) } },
  responses: { 201: data(propertySchema), ...writeErrors },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: `${BASE}/bulk-status`,
  summary: 'Change the status of several properties (each failure says why)',
  request: { body: { content: json(bulkStatusBodySchema) } },
  responses: { 200: data(bulkStatusResultSchema), ...writeErrors },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: `${BASE}/{id}`,
  summary: 'One property, with what is still missing before it can be published',
  request: { params: idParams },
  responses: { 200: data(propertySchema), ...readErrors, 404: err('Property not found') },
});
registry.registerPath({
  ...secured,
  method: 'patch',
  path: `${BASE}/{id}`,
  summary: 'Edit a property (only the parts sent change)',
  request: { params: idParams, body: { content: json(updatePropertyBodySchema) } },
  responses: { 200: data(propertySchema), ...writeErrors },
});
registry.registerPath({
  ...secured,
  method: 'delete',
  path: `${BASE}/{id}`,
  summary: 'Archive a property (nothing is permanently deleted)',
  request: { params: idParams },
  responses: { 200: data(propertySchema), ...writeErrors },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: `${BASE}/{id}/status`,
  summary: 'Publish, unpublish, mark booked / sold / rented / leased, archive or restore',
  request: { params: idParams, body: { content: json(changeStatusBodySchema) } },
  responses: { 200: data(propertySchema), ...writeErrors },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: `${BASE}/{id}/duplicate`,
  summary: 'Copy a property as a new Draft',
  request: { params: idParams },
  responses: { 201: data(propertySchema), ...writeErrors },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: `${BASE}/{id}/history`,
  summary: 'Change history: who changed what, and when',
  request: { params: idParams },
  responses: { 200: data(z.array(propertyHistoryEntrySchema)), ...readErrors },
});

const mediaParams = z.object({ id: idSchema, mediaId: idSchema });
registry.registerPath({
  ...secured,
  method: 'post',
  path: `${BASE}/{id}/media`,
  summary:
    'Upload one file: photo (JPG/PNG/WebP, 10 MB, saved as WebP in 3 sizes), video (MP4/WebM, 50 MB), floor plan (image or PDF) or brochure / document (PDF, 20 MB)',
  request: {
    params: idParams,
    query: uploadMediaQuerySchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.string().meta({ format: 'binary' }) }),
        },
      },
    },
  },
  responses: { 201: data(propertySchema), ...writeErrors },
});
registry.registerPath({
  ...secured,
  method: 'put',
  path: `${BASE}/{id}/media/order`,
  summary: 'Save the order of the files (every media id, in order)',
  request: { params: idParams, body: { content: json(reorderMediaBodySchema) } },
  responses: { 200: data(propertySchema), ...writeErrors },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: `${BASE}/{id}/media/{mediaId}/cover`,
  summary: 'Make this photo the cover',
  request: { params: mediaParams },
  responses: { 200: data(propertySchema), ...writeErrors },
});
registry.registerPath({
  ...secured,
  method: 'delete',
  path: `${BASE}/{id}/media/{mediaId}`,
  summary: 'Delete a file (and its resized copies)',
  request: { params: mediaParams },
  responses: { 200: data(propertySchema), ...writeErrors },
});

const ALL_EXTENSIONS = new Set(Object.values(MEDIA_RULES).flatMap((r) => r.extensions));
const MAX_UPLOAD = Math.max(...Object.values(MEDIA_RULES).map((r) => r.maxBytes));

/** One file in memory (`req.file`). Each kind's own type and size are checked by the service. */
function mediaUpload(): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (ALL_EXTENSIONS.has(fileExtension(file.originalname))) return callback(null, true);
      callback(
        new AppError(
          400,
          'INVALID_FILE_TYPE',
          `Allowed file types: ${[...ALL_EXTENSIONS].join(', ')}`,
        ),
      );
    },
  }).single('file');
  return (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError(400, 'FILE_TOO_LARGE', `Files can be up to ${MAX_UPLOAD / 1024 / 1024} MB.`),
        );
      }
      if (error) return next(error);
      if (!req.file) return next(new AppError(400, 'FILE_REQUIRED', 'Choose a file to upload.'));
      next();
    });
  };
}

// ------------------------------------------------------------------ Routes

export function createPropertiesRouter(deps: {
  auth: AuthService;
  properties: PropertiesService;
  media: PropertyMediaService;
}): Router {
  const { auth, properties, media } = deps;
  const router = Router();
  const canRead = requirePermission('properties:read');
  const canWrite = requirePermission('properties:write');
  router.use(authenticate(auth.accessTokens));

  router.get(
    '/',
    canRead,
    endpoint({ query: listPropertiesQuerySchema }, async ({ query }, _req, res) => {
      const { items, meta } = await properties.list(query);
      sendList(res, items, meta);
    }),
  );
  router.get('/status-counts', canRead, async (_req, res) => {
    sendData(res, await properties.statusCounts());
  });
  router.get(
    '/location-suggestions',
    canRead,
    endpoint({ query: locationSuggestionsQuerySchema }, async ({ query }, _req, res) => {
      sendData(res, await properties.locationSuggestions(query.field, query.q, query.city));
    }),
  );
  router.post(
    '/',
    canWrite,
    endpoint({ body: createPropertyBodySchema }, async ({ body }, req, res) => {
      sendData(res, await properties.create(req.user!.id, body), 201);
    }),
  );
  router.post(
    '/bulk-status',
    canWrite,
    endpoint({ body: bulkStatusBodySchema }, async ({ body }, req, res) => {
      sendData(res, await properties.bulkStatus(req.user!.id, body.ids, body.status));
    }),
  );
  router.get(
    '/:id',
    canRead,
    endpoint({ params: idParams }, async ({ params }, _req, res) => {
      sendData(res, await properties.get(params.id));
    }),
  );
  router.patch(
    '/:id',
    canWrite,
    endpoint(
      { params: idParams, body: updatePropertyBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await properties.update(req.user!.id, params.id, body));
      },
    ),
  );
  router.delete(
    '/:id',
    canWrite,
    endpoint({ params: idParams }, async ({ params }, req, res) => {
      sendData(res, await properties.changeStatus(req.user!.id, params.id, 'archived'));
    }),
  );
  router.post(
    '/:id/status',
    canWrite,
    endpoint(
      { params: idParams, body: changeStatusBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await properties.changeStatus(req.user!.id, params.id, body.status));
      },
    ),
  );
  router.post(
    '/:id/duplicate',
    canWrite,
    endpoint({ params: idParams }, async ({ params }, req, res) => {
      sendData(res, await properties.duplicate(req.user!.id, params.id), 201);
    }),
  );
  router.get(
    '/:id/history',
    canRead,
    endpoint({ params: idParams }, async ({ params }, _req, res) => {
      sendData(res, await properties.history(params.id));
    }),
  );

  // Media
  router.post(
    '/:id/media',
    canWrite,
    mediaUpload(),
    endpoint(
      { params: idParams, query: uploadMediaQuerySchema },
      async ({ params, query }, req, res) => {
        sendData(res, await media.upload(req.user!.id, params.id, query.kind, req.file!), 201);
      },
    ),
  );
  router.put(
    '/:id/media/order',
    canWrite,
    endpoint(
      { params: idParams, body: reorderMediaBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await media.reorder(req.user!.id, params.id, body.ids));
      },
    ),
  );
  router.post(
    '/:id/media/:mediaId/cover',
    canWrite,
    endpoint({ params: mediaParams }, async ({ params }, req, res) => {
      sendData(res, await media.setCover(req.user!.id, params.id, params.mediaId));
    }),
  );
  router.delete(
    '/:id/media/:mediaId',
    canWrite,
    endpoint({ params: mediaParams }, async ({ params }, req, res) => {
      sendData(res, await media.remove(req.user!.id, params.id, params.mediaId));
    }),
  );

  return router;
}
