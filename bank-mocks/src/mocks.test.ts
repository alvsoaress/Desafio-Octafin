import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAlphaApp } from './alpha';
import { createBetaApp } from './beta';

describe.each([
  ['Alpha', createAlphaApp],
  ['Beta', createBetaApp],
])('Banco %s', (_name, createApp) => {
  it('responde 404 para rota inexistente', async () => {
    const response = await request(createApp()).get('/rota-inexistente');

    expect(response.status).toBe(404);
  });
});
