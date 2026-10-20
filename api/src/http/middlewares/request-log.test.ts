import { fictitiousCpfs } from '@consignado/shared/fixtures';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../../services/simulation.service';
import { requestId } from './request-id';
import { requestLog } from './request-log';

const [cpf] = fictitiousCpfs;

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn() } satisfies Logger;
}

function createTestApp(logger: Logger) {
  const app = express();
  app.use(requestId());
  app.use(requestLog(logger));
  app.use(express.json());
  app.post('/simulations', (_request, response) => {
    response.status(201).json({ ok: true });
  });
  return app;
}

describe('requestLog', () => {
  it('loga requestId, método, caminho, status e duração', async () => {
    const logger = fakeLogger();

    const response = await request(createTestApp(logger)).post('/simulations').send({});
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      {
        requestId: response.headers['x-request-id'],
        method: 'POST',
        path: '/simulations',
        status: 201,
        durationMs: expect.any(Number) as number,
      },
      'Requisição concluída',
    );
    const [[data]] = logger.info.mock.calls as [[{ durationMs: number }]];
    expect(Number.isInteger(data.durationMs)).toBe(true);
  });

  it('não loga corpo nem cabeçalhos', async () => {
    const logger = fakeLogger();

    await request(createTestApp(logger))
      .post('/simulations')
      .set('Authorization', 'Bearer segredo')
      .send({ cpf: cpf.digits, salaryCents: 512345 });
    await new Promise((resolve) => setImmediate(resolve));

    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logged).not.toContain(cpf.digits);
    expect(logged).not.toContain('512345');
    expect(logged).not.toContain('segredo');
  });
});
