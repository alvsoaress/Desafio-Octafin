import type { RequestHandler } from 'express';

export type LogLine = (line: string) => void;

export function requestLog(bank: string, log: LogLine = console.log): RequestHandler {
  return (request, response, next) => {
    const startedAt = performance.now();

    response.once('close', () => {
      log(
        JSON.stringify({
          bank,
          method: request.method,
          path: request.path,
          status: response.writableFinished ? response.statusCode : 'aborted',
          durationMs: Math.round(performance.now() - startedAt),
        }),
      );
    });

    next();
  };
}
