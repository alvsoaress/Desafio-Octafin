import { fictitiousCpfs } from '@consignado/shared/fixtures';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../../services/simulation.service';
import { errorHandler } from './error-handler';
import { requestId } from './request-id';

const [cpf] = fictitiousCpfs;

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn() } satisfies Logger;
}

function createTestApp(logger: Logger = fakeLogger()) {
  const app = express();
  app.use(requestId());
  app.use(express.json({ limit: '10kb' }));
  app.post('/echo', (_request, response) => {
    response.json({ ok: true });
  });
  app.get('/sync-error', () => {
    throw new Error(`cpf ${cpf.digits}`);
  });
  app.get('/async-error', async () => {
    await Promise.resolve();
    throw new TypeError(`cpf ${cpf.digits}`);
  });
  app.use(errorHandler(logger));
  return app;
}

function bodyOfSize(bytes: number): string {
  const prefix = '{"text":"';
  const suffix = '"}';

  return `${prefix}${'a'.repeat(bytes - prefix.length - suffix.length)}${suffix}`;
}

describe('errorHandler', () => {
  it('responde 400 invalid_json para JSON malformado', async () => {
    const response = await request(createTestApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'invalid_json',
      requestId: response.headers['x-request-id'],
    });
  });

  it('responde 413 payload_too_large para corpo acima de 10 KB', async () => {
    const response = await request(createTestApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(bodyOfSize(11 * 1024));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: 'payload_too_large',
      requestId: response.headers['x-request-id'],
    });
  });

  it('aceita corpo abaixo de 10 KB', async () => {
    const response = await request(createTestApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(bodyOfSize(9 * 1024));

    expect(response.status).toBe(200);
  });

  it.each(['/sync-error', '/async-error'])(
    'responde 500 em %s sem pilha nem mensagem, e loga só o nome do erro',
    async (path) => {
      const logger = fakeLogger();

      const response = await request(createTestApp(logger)).get(path);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'internal_error',
        requestId: response.headers['x-request-id'],
      });
      expect(response.text).not.toContain(cpf.digits);
      expect(logger.error).toHaveBeenCalledWith(
        {
          requestId: response.headers['x-request-id'],
          errorName: path === '/sync-error' ? 'Error' : 'TypeError',
        },
        'Erro inesperado na API',
      );
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain(cpf.digits);
    },
  );
});
