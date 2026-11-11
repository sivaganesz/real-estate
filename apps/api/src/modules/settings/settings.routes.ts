import {
  companySettingsSchema,
  LOGO_MAX_BYTES,
  updateCompanySettingsBodySchema,
} from '@real-estate/shared';
import type { RequestHandler } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ErrorResponseSchema, registry } from '../../docs/openapi';
import { AppError } from '../../lib/errors';
import { sendData } from '../../lib/http';
import { singleFileUpload } from '../../lib/storage';
import { authenticate, requirePermission } from '../../middleware/auth';
import { endpoint } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { CompanySettingsService } from './company.service';

// ------------------------------------------------------------------ OpenAPI

const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
const err = (description: string) => ({ description, content: json(ErrorResponseSchema) });
const secured = { security: [{ bearerAuth: [] }], tags: ['Settings'] };
const companyResponse = {
  description: 'Company info',
  content: json(z.object({ data: companySettingsSchema })),
};

registry.registerPath({
  ...secured,
  method: 'get',
  path: '/api/v1/admin/settings/company',
  summary: 'Company info (any signed-in user; used for the portal branding)',
  responses: { 200: companyResponse, 401: err('Not signed in') },
});
registry.registerPath({
  ...secured,
  method: 'put',
  path: '/api/v1/admin/settings/company',
  summary: 'Update company info (needs settings:edit)',
  request: { body: { content: json(updateCompanySettingsBodySchema) } },
  responses: {
    200: companyResponse,
    400: err('Invalid input'),
    401: err('Not signed in'),
    403: err('Missing permission'),
  },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: '/api/v1/admin/settings/company/logo',
  summary: 'Upload or replace the company logo (PNG, JPG or WebP, up to 2 MB)',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.string().meta({ format: 'binary' }) }),
        },
      },
    },
  },
  responses: {
    200: companyResponse,
    400: err('No file, wrong file type, or the file is too large'),
    401: err('Not signed in'),
    403: err('Missing permission'),
  },
});
registry.registerPath({
  ...secured,
  method: 'delete',
  path: '/api/v1/admin/settings/company/logo',
  summary: 'Remove the company logo',
  responses: { 200: companyResponse, 401: err('Not signed in'), 403: err('Missing permission') },
});

// ------------------------------------------------------------------ Routes

/** Accepts the logo file with a clear "too large" message. */
function logoUpload(): RequestHandler {
  const upload = singleFileUpload('image', { maxBytes: LOGO_MAX_BYTES });
  return (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(400, 'FILE_TOO_LARGE', 'The logo must be 2 MB or smaller.'));
      }
      if (error) return next(error);
      if (!req.file) {
        return next(new AppError(400, 'FILE_REQUIRED', 'Choose an image file to upload.'));
      }
      next();
    });
  };
}

export function createSettingsRouter(deps: {
  auth: AuthService;
  company: CompanySettingsService;
}): Router {
  const { auth, company } = deps;
  const router = Router();
  const canEdit = requirePermission('settings:edit');
  router.use(authenticate(auth.accessTokens));

  router.get('/company', async (_req, res) => {
    sendData(res, await company.get());
  });

  router.put(
    '/company',
    canEdit,
    endpoint({ body: updateCompanySettingsBodySchema }, async ({ body }, req, res) => {
      sendData(res, await company.update(req.user!.id, body));
    }),
  );

  router.post('/company/logo', canEdit, logoUpload(), async (req, res) => {
    sendData(res, await company.replaceLogo(req.user!.id, req.file!.buffer));
  });

  router.delete('/company/logo', canEdit, async (req, res) => {
    sendData(res, await company.removeLogo(req.user!.id));
  });

  return router;
}
