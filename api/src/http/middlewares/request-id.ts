import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { z } from 'zod';

declare module 'express-serve-static-core' {
  interface Locals {
    requestId: string;
  }
}

export const REQUEST_ID_HEADER = 'x-request-id';

const uuidSchema = z.uuid();

export function requestId(): RequestHandler {
  return (request, response, next) => {
    const received = uuidSchema.safeParse(request.get(REQUEST_ID_HEADER));
    const id = received.success ? received.data : randomUUID();

    response.locals.requestId = id;
    response.set(REQUEST_ID_HEADER, id);
    next();
  };
}
