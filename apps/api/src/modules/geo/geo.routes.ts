import { geoPlaceSchema, geoReverseQuerySchema, geoSearchQuerySchema } from '@real-estate/shared';
import { Router } from 'express';
import { z } from 'zod';
import { ErrorResponseSchema, registry } from '../../docs/openapi';
import { sendData } from '../../lib/http';
import { authenticate, requirePermission } from '../../middleware/auth';
import { endpoint } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { GeocodingService } from './geo.service';

const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
const err = (description: string) => ({ description, content: json(ErrorResponseSchema) });
const secured = { security: [{ bearerAuth: [] }], tags: ['Map'] };
const place = {
  description: 'The place, or null when nothing was found',
  content: json(z.object({ data: geoPlaceSchema.nullable() })),
};
const errors = {
  400: err('Invalid input'),
  401: err('Not signed in'),
  403: err('Needs properties:write'),
  502: err('The map lookup service is unavailable'),
};

registry.registerPath({
  ...secured,
  method: 'get',
  path: '/api/v1/admin/geo/search',
  summary: 'Find an address on the map (city, area, pincode) for the property form',
  request: { query: geoSearchQuerySchema },
  responses: { 200: place, ...errors },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: '/api/v1/admin/geo/reverse',
  summary: 'Nearest address to a map pin',
  request: { query: geoReverseQuerySchema },
  responses: { 200: place, ...errors },
});

export function createGeoRouter(deps: { auth: AuthService; geo: GeocodingService }): Router {
  const router = Router();
  router.use(authenticate(deps.auth.accessTokens), requirePermission('properties:write'));
  router.get(
    '/search',
    endpoint({ query: geoSearchQuerySchema }, async ({ query }, _req, res) => {
      sendData(res, await deps.geo.search(query));
    }),
  );
  router.get(
    '/reverse',
    endpoint({ query: geoReverseQuerySchema }, async ({ query }, _req, res) => {
      sendData(res, await deps.geo.reverse(query.lat, query.lng));
    }),
  );
  return router;
}
