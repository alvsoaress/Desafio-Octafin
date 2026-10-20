import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requestId } from './request-id';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function createTestApp() {
  const app = express();
  app.use(requestId());
  app.get('/', (_request, response) => {
    response.json({ requestId: response.locals.requestId });
  });
  return app;
}

describe('requestId', () => {
  it('gera um UUID quando o cabeçalho não vem', async () => {
    const response = await request(createTestApp()).get('/');

    expect(response.headers['x-request-id']).toMatch(uuidPattern);
    expect(response.body).toEqual({ requestId: response.headers['x-request-id'] });
  });

  it('reaproveita um UUID válido', async () => {
    const id = randomUUID();

    const response = await request(createTestApp()).get('/').set('x-request-id', id);

    expect(response.headers['x-request-id']).toBe(id);
    expect(response.body).toEqual({ requestId: id });
  });

  it.each(['abc', `${randomUUID()}-extra`, ''])(
    'gera um novo para o valor inválido "%s"',
    async (value) => {
      const response = await request(createTestApp()).get('/').set('x-request-id', value);

      expect(response.headers['x-request-id']).toMatch(uuidPattern);
      expect(response.headers['x-request-id']).not.toBe(value);
    },
  );
});
