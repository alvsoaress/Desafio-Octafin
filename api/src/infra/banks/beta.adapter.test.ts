import { fictitiousCpfs } from '@consignado/shared/fixtures';
import nock from 'nock';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { calculateOffer } from '../../domain/loan';
import { connectionRefused, replyAfter } from '../nock-replies';
import { BetaAdapter } from './beta.adapter';

const BASE_URL = 'http://beta.test';
const ROUTE = '/api/simulacao';
const CODE = '2a9d4c1e-7f3b-4e6a-8d5c-9b1a2c3d4e5f';

const request = {
  cpf: fictitiousCpfs[1].digits,
  amountCents: 1000000,
  termMonths: 24,
};

const adapter = new BetaAdapter({ baseUrl: BASE_URL });

function quote(signal = AbortSignal.timeout(1000)) {
  return adapter.quote(request, signal);
}

beforeAll(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
});

describe('BetaAdapter', () => {
  it('identifica o Banco Beta', () => {
    expect(adapter.bankId).toBe('beta');
    expect(adapter.bankName).toBe('Banco Beta');
  });

  it.each([
    [1000000, '10000.00'],
    [50001, '500.01'],
    [50000, '500.00'],
    [50000000, '500000.00'],
  ])('envia %i centavos como valor "%s" no contrato do Beta', async (amountCents, valor) => {
    const scope = nock(BASE_URL)
      .post(ROUTE, { cpf: fictitiousCpfs[1].digits, valor, prazoMeses: 24 })
      .reply(200, { codigo: CODE, taxaAnualPercentual: '21.50' });

    await adapter.quote({ ...request, amountCents }, AbortSignal.timeout(1000));

    expect(scope.isDone()).toBe(true);
  });

  it('traduz a taxa percentual do Beta para a taxa canônica decimal', async () => {
    nock(BASE_URL).post(ROUTE).reply(200, { codigo: CODE, taxaAnualPercentual: '21.50' });

    const result = await quote();

    expect(result.status).toBe('success');

    if (result.status !== 'success') {
      return;
    }

    expect(result.annualRate.toString()).toBe('0.215');
    expect(
      calculateOffer({
        amountCents: 1000000,
        termMonths: 24,
        annualRate: result.annualRate,
        availableMarginCents: 125000,
      }).monthlyRate,
    ).toBe('0.016361');
  });

  it('ignora campos extras na resposta do Beta', async () => {
    nock(BASE_URL)
      .post(ROUTE)
      .reply(200, { codigo: CODE, taxaAnualPercentual: '19.90', validade: '2026-12-31' });

    const result = await quote();

    expect(result.status === 'success' && result.annualRate.toString()).toBe('0.199');
  });

  it('devolve timeout e aborta a requisição quando o tempo limite estoura', async () => {
    nock(BASE_URL)
      .post(ROUTE)
      .reply(replyAfter(500, 200, { codigo: CODE, taxaAnualPercentual: '21.50' }));
    const signal = AbortSignal.timeout(50);
    let aborted = false;
    signal.addEventListener('abort', () => {
      aborted = true;
    });

    const result = await quote(signal);

    expect(result).toEqual({ status: 'timeout' });
    expect(signal.aborted).toBe(true);
    expect(aborted).toBe(true);
  });

  it('devolve unavailable quando a conexão é recusada', async () => {
    nock(BASE_URL).post(ROUTE).replyWithError(connectionRefused());

    expect(await quote()).toEqual({ status: 'unavailable' });
  });

  it.each([
    [503, { erro: 'servico_indisponivel' }],
    [400, { erro: 'requisicao_invalida' }],
  ])('devolve unavailable para a resposta HTTP %i', async (status, body) => {
    nock(BASE_URL).post(ROUTE).reply(status, body);

    expect(await quote()).toEqual({ status: 'unavailable' });
  });

  it('devolve invalid-response quando o corpo não é JSON', async () => {
    nock(BASE_URL).post(ROUTE).reply(200, 'ok', { 'content-type': 'text/plain' });

    expect(await quote()).toEqual({ status: 'invalid-response' });
  });

  it.each([
    ['sem taxa', { codigo: CODE }],
    ['com taxa numérica', { codigo: CODE, taxaAnualPercentual: 21.5 }],
    ['com taxa em vírgula', { codigo: CODE, taxaAnualPercentual: '21,50' }],
    ['com taxa negativa', { codigo: CODE, taxaAnualPercentual: '-1.00' }],
    ['com taxa acima de 1000% a.a.', { codigo: CODE, taxaAnualPercentual: '1000.01' }],
  ])('devolve invalid-response para uma resposta %s', async (_case, body) => {
    nock(BASE_URL).post(ROUTE).reply(200, body);

    expect(await quote()).toEqual({ status: 'invalid-response' });
  });
});
