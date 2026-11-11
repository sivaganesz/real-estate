import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z, ZodType } from 'zod';
import { validationError } from '../lib/errors';
import type { ErrorDetail } from '../lib/errors';

export interface RequestSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

type Output<T> = T extends ZodType ? z.output<T> : undefined;

export interface ValidatedInput<S extends RequestSchemas> {
  params: Output<S['params']>;
  query: Output<S['query']>;
  body: Output<S['body']>;
}

/**
 * Validates params, query and body with Zod, then calls the handler with typed values.
 * Invalid input returns 400 VALIDATION_ERROR with one detail per problem field.
 * (Express 5 forwards rejected promises to the error handler automatically.)
 *
 * @example
 * router.get('/users', endpoint({ query: listUsersQuery }, async ({ query }, req, res) => { ... }));
 */
export function endpoint<S extends RequestSchemas>(
  schemas: S,
  handler: (input: ValidatedInput<S>, req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return async (req, res, next) => {
    const details: ErrorDetail[] = [];
    const input: Record<string, unknown> = {};

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        input[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ path: [part, ...issue.path].join('.'), message: issue.message });
        }
      }
    }

    if (details.length > 0) throw validationError(details);
    if (input.body !== undefined) req.body = input.body;
    await handler(input as unknown as ValidatedInput<S>, req, res, next);
  };
}
