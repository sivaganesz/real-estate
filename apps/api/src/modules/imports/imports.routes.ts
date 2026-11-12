import {
  commitImportBodySchema,
  idSchema,
  IMPORT_MAX_BYTES,
  importBatchDetailSchema,
  importBatchSchema,
  importSubcategoryQuerySchema,
  listImportsQuerySchema,
  pageMetaSchema,
} from '@real-estate/shared';
import type { RequestHandler, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ErrorResponseSchema, registry } from '../../docs/openapi';
import { AppError } from '../../lib/errors';
import { sendData, sendList } from '../../lib/http';
import { singleFileUpload } from '../../lib/storage';
import { authenticate, requirePermission } from '../../middleware/auth';
import { endpoint } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { ImportsService } from './imports.service';

const BASE = '/api/v1/admin/imports';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
const err = (description: string) => ({ description, content: json(ErrorResponseSchema) });
const data = (schema: z.ZodType) => ({
  description: 'OK',
  content: json(z.object({ data: schema })),
});
const secured = { security: [{ bearerAuth: [] }], tags: ['Bulk import'] };
const idParams = z.object({ id: idSchema });
const errors = {
  400: err('Invalid input or file'),
  401: err('Not signed in'),
  403: err('Needs imports:run'),
  404: err('Not found'),
};
const xlsxFile = {
  description: 'Excel file',
  content: { [XLSX]: { schema: z.string().meta({ format: 'binary' }) } },
};

registry.registerPath({
  ...secured,
  method: 'get',
  path: `${BASE}/template`,
  summary: 'Download the Excel template for a subcategory (columns, dropdowns, instructions)',
  request: { query: importSubcategoryQuerySchema },
  responses: { 200: xlsxFile, ...errors },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: BASE,
  summary:
    'Upload a filled template: every row is checked and duplicates are found (nothing is imported yet)',
  request: {
    query: importSubcategoryQuerySchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.string().meta({ format: 'binary' }) }),
        },
      },
    },
  },
  responses: { 201: data(importBatchDetailSchema), ...errors, 422: err('Subcategory inactive') },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: BASE,
  summary: 'Import history',
  request: { query: listImportsQuerySchema },
  responses: {
    200: {
      description: 'Imports',
      content: json(z.object({ data: z.array(importBatchSchema), meta: pageMetaSchema })),
    },
    ...errors,
  },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: `${BASE}/{id}`,
  summary: 'One import with its rows (errors, duplicates, outcome)',
  request: { params: idParams },
  responses: { 200: data(importBatchDetailSchema), ...errors },
});
registry.registerPath({
  ...secured,
  method: 'post',
  path: `${BASE}/{id}/commit`,
  summary: 'Import the valid rows as Draft or Published; skip or update duplicates',
  request: { params: idParams, body: { content: json(commitImportBodySchema) } },
  responses: { 200: data(importBatchDetailSchema), ...errors, 409: err('Already imported') },
});
registry.registerPath({
  ...secured,
  method: 'get',
  path: `${BASE}/{id}/error-report`,
  summary: 'The rows that need attention, with an "Errors" column (Excel)',
  request: { params: idParams },
  responses: { 200: xlsxFile, ...errors },
});

function sendXlsx(res: Response, file: { data: Buffer; fileName: string }) {
  res.setHeader('content-type', XLSX);
  res.setHeader(
    'content-disposition',
    `attachment; filename="${file.fileName.replace(/[^\w.-]/g, '_')}"`,
  );
  res.setHeader('cache-control', 'no-store');
  res.send(file.data);
}

function excelUpload(): RequestHandler {
  const upload = singleFileUpload('excel', { maxBytes: IMPORT_MAX_BYTES });
  return (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError(
            400,
            'FILE_TOO_LARGE',
            `The file can be up to ${IMPORT_MAX_BYTES / 1024 / 1024} MB.`,
          ),
        );
      }
      if (error) return next(error);
      if (!req.file) {
        return next(
          new AppError(400, 'FILE_REQUIRED', 'Choose the filled .xlsx template to upload.'),
        );
      }
      next();
    });
  };
}

export function createImportsRouter(deps: { auth: AuthService; imports: ImportsService }): Router {
  const { imports } = deps;
  const router = Router();
  router.use(authenticate(deps.auth.accessTokens), requirePermission('imports:run'));

  router.get(
    '/template',
    endpoint({ query: importSubcategoryQuerySchema }, async ({ query }, _req, res) => {
      sendXlsx(res, await imports.template(query.subcategoryId));
    }),
  );
  router.post(
    '/',
    excelUpload(),
    endpoint({ query: importSubcategoryQuerySchema }, async ({ query }, req, res) => {
      sendData(res, await imports.check(req.user!.id, query.subcategoryId, req.file!), 201);
    }),
  );
  router.get(
    '/',
    endpoint({ query: listImportsQuerySchema }, async ({ query }, _req, res) => {
      const { items, meta } = await imports.list(query.page, query.limit);
      sendList(res, items, meta);
    }),
  );
  router.get(
    '/:id',
    endpoint({ params: idParams }, async ({ params }, _req, res) => {
      sendData(res, await imports.detail(params.id));
    }),
  );
  router.post(
    '/:id/commit',
    endpoint(
      { params: idParams, body: commitImportBodySchema },
      async ({ params, body }, req, res) => {
        sendData(res, await imports.commit(req.user!.id, params.id, body));
      },
    ),
  );
  router.get(
    '/:id/error-report',
    endpoint({ params: idParams }, async ({ params }, _req, res) => {
      sendXlsx(res, await imports.errorReport(params.id));
    }),
  );
  return router;
}
