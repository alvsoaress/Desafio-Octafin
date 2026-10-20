import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('createApp', () => {
  it('responde 404 para rota inexistente', async () => {
    const response = await request(createApp()).get('/rota-inexistente');

    expect(response.status).toBe(404);
  });
});
