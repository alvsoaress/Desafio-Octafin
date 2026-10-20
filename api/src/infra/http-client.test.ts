import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import nock from 'nock';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { postJson } from './http-client';
import { connectionRefused, replyAfter } from './nock-replies';

const BASE_URL = 'http://banco.test';

beforeAll(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
  nock.disableNetConnect();
});

describe('postJson', () => {
  it('envia o corpo em JSON e lê a resposta JSON', async () => {
    nock(BASE_URL)
      .post('/cotacao', { valor: 1 })
      .matchHeader('content-type', 'application/json')
      .reply(200, { taxa: '0.24' });

    const result = await postJson(`${BASE_URL}/cotacao`, { valor: 1 }, AbortSignal.timeout(1000));

    expect(result).toEqual({ kind: 'response', status: 200, body: { taxa: '0.24' } });
  });

  it('devolve o status de uma resposta de erro com JSON', async () => {
    nock(BASE_URL).post('/cotacao').reply(503, { erro: 'servico_indisponivel' });

    const result = await postJson(`${BASE_URL}/cotacao`, {}, AbortSignal.timeout(1000));

    expect(result).toEqual({
      kind: 'response',
      status: 503,
      body: { erro: 'servico_indisponivel' },
    });
  });

  it('identifica um corpo que não é JSON', async () => {
    nock(BASE_URL).post('/cotacao').reply(200, 'ok', { 'content-type': 'text/plain' });

    const result = await postJson(`${BASE_URL}/cotacao`, {}, AbortSignal.timeout(1000));

    expect(result).toEqual({ kind: 'not-json', status: 200 });
  });

  it('identifica um erro de conexão', async () => {
    nock(BASE_URL).post('/cotacao').replyWithError(connectionRefused());

    const result = await postJson(`${BASE_URL}/cotacao`, {}, AbortSignal.timeout(1000));

    expect(result).toEqual({ kind: 'network-error' });
  });

  it('identifica uma conexão recusada de verdade', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    nock.enableNetConnect('127.0.0.1');

    const result = await postJson(
      `http://127.0.0.1:${port}/cotacao`,
      {},
      AbortSignal.timeout(1000),
    );

    expect(result).toEqual({ kind: 'network-error' });
  });

  it('aborta a requisição quando o tempo limite estoura', async () => {
    nock(BASE_URL)
      .post('/cotacao')
      .reply(replyAfter(500, 200, { taxa: '0.24' }));
    const signal = AbortSignal.timeout(50);
    let aborted = false;
    signal.addEventListener('abort', () => {
      aborted = true;
    });
    const startedAt = performance.now();

    const result = await postJson(`${BASE_URL}/cotacao`, {}, signal);

    expect(result).toEqual({ kind: 'timeout' });
    expect(aborted).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});
