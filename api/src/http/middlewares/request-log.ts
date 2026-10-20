import type { RequestHandler } from 'express';
import type { Logger } from '../../services/simulation.service';

export function requestLog(logger: Logger): RequestHandler {
  return (request, response, next) => {
    const startedAt = performance.now();

    response.once('close', () => {
      logger.info(
        {
          requestId: response.locals.requestId,
          method: request.method,
          path: request.path,
          status: response.writableFinished ? response.statusCode : 'aborted',
          durationMs: Math.round(performance.now() - startedAt),
        },
        'Requisição concluída',
      );
    });

    next();
  };
}
