import { toFieldErrors } from '@consignado/shared';
import type { RequestHandler } from 'express';
import type { z } from 'zod';

export function validateBody(schema: z.ZodType): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        error: 'validation_error',
        fields: toFieldErrors(result.error),
        requestId: response.locals.requestId,
      });
      return;
    }

    request.body = result.data;
    next();
  };
}
