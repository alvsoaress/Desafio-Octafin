import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

const webOrigin = 'http://localhost:5173';

function createTestApp() {
  return createApp({ logger: { info: vi.fn(), error: vi.fn() }, webOrigin });
}

describe('createApp', () => {
  it('responde 404 para rota inexistente, com x-request-id', async () => {
    const response = await request(createTestApp()).get('/rota-inexistente');

    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('libera o CORS para a origem configurada', async () => {
    const response = await request(createTestApp())
      .get('/rota-inexistente')
      .set('Origin', webOrigin);

    expect(response.headers['access-control-allow-origin']).toBe(webOrigin);
  });

  it('não envia os cabeçalhos CORS para outra origem', async () => {
    const response = await request(createTestApp())
      .get('/rota-inexistente')
      .set('Origin', 'http://evil.example');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('responde ao preflight da origem configurada', async () => {
    const response = await request(createTestApp())
      .options('/api/simulations')
      .set('Origin', webOrigin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(webOrigin);
  });

  it('responde 413 com x-request-id para corpo acima de 10 KB', async () => {
    const response = await request(createTestApp())
      .post('/api/simulations')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'a'.repeat(11 * 1024) }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: 'payload_too_large',
      requestId: response.headers['x-request-id'],
    });
  });
});
