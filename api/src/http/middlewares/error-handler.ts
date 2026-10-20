import type { ErrorRequestHandler } from 'express';
import type { Logger } from '../../services/simulation.service';

const bodyParserErrors: Record<string, { status: number; error: string }> = {
  'entity.parse.failed': { status: 400, error: 'invalid_json' },
  'entity.too.large': { status: 413, error: 'payload_too_large' },
};

function bodyParserError(error: unknown) {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    return undefined;
  }

  return typeof error.type === 'string' ? bodyParserErrors[error.type] : undefined;
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const { requestId } = response.locals;
    const known = bodyParserError(error);

    if (known) {
      response.status(known.status).json({ error: known.error, requestId });
      return;
    }

    logger.error(
      { requestId, errorName: error instanceof Error ? error.name : typeof error },
      'Erro inesperado na API',
    );
    response.status(500).json({ error: 'internal_error', requestId });
  };
}
