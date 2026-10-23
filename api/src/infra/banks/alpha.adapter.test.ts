import { fictitiousCnpjs, fictitiousCpfs } from '@consignado/shared/fixtures';
import nock from 'nock';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { connectionRefused, replyAfter } from '../nock-replies';
import { AlphaAdapter } from './alpha.adapter';

const BASE_URL = 'http://alpha.test';
const ROUTE = '/v1/loan-quotes';
const QUOTE_ID = '6f1c2a4e-8b3d-4f5a-9c7e-1d2b3a4c5e6f';

const request = {
  cpf: fictitiousCpfs[0].digits,
  employerCnpj: fictitiousCnpjs[0].digits,
  amountCents: 1000000,
  termMonths: 24,
};

const adapter = new AlphaAdapter({ baseUrl: BASE_URL });

function quote(signal = AbortSignal.timeout(1000)) {
  return adapter.quote(request, signal);
}

beforeAll(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
});

describe('AlphaAdapter', () => {
  it('identifica o Banco Alpha', () => {
    expect(adapter.bankId).toBe('alpha');
    expect(adapter.bankName).toBe('Banco Alpha');
  });

  it('traduz a requisição para o contrato do Alpha e a taxa decimal para a taxa canônica', async () => {
    const scope = nock(BASE_URL)
      .post(ROUTE, {
        document: fictitiousCpfs[0].digits,
        employerDocument: fictitiousCnpjs[0].digits,
        amountCents: 1000000,
        termMonths: 24,
      })
      .reply(200, { quoteId: QUOTE_ID, decision: 'approved', annualInterestRate: '0.24' });

    const result = await quote();

    expect(scope.isDone()).toBe(true);
    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.annualRate.toString()).toBe('0.24');
  });

  it('ignora campos extras na resposta do Alpha', async () => {
    nock(BASE_URL).post(ROUTE).reply(200, {
      quoteId: QUOTE_ID,
      decision: 'approved',
      annualInterestRate: '0.26',
      validUntil: '2026-12-31',
    });

    const result = await quote();

    expect(result.status === 'success' && result.annualRate.toString()).toBe('0.26');
  });

  it('traduz a recusa por valor acima do limite', async () => {
    nock(BASE_URL)
      .post(ROUTE)
      .reply(200, { quoteId: QUOTE_ID, decision: 'declined', reasonCode: 'AMOUNT_ABOVE_LIMIT' });

    expect(await quote()).toEqual({ status: 'rejected', reason: 'amount-above-limit' });
  });

  it('traduz a recusa por empregador sem convênio', async () => {
    nock(BASE_URL)
      .post(ROUTE)
      .reply(200, { quoteId: QUOTE_ID, decision: 'declined', reasonCode: 'EMPLOYER_NOT_COVERED' });

    expect(await quote()).toEqual({ status: 'rejected', reason: 'employer-not-covered' });
  });

  it.each(['CREDIT_POLICY', 'constructor'])(
    'trata o motivo desconhecido %s como recusa sem motivo conhecido',
    async (reasonCode) => {
      nock(BASE_URL)
        .post(ROUTE)
        .reply(200, { quoteId: QUOTE_ID, decision: 'declined', reasonCode });

      expect(await quote()).toEqual({ status: 'rejected', reason: 'other' });
    },
  );

  it('devolve timeout e aborta a requisição quando o tempo limite estoura', async () => {
    nock(BASE_URL)
      .post(ROUTE)
      .reply(
        replyAfter(500, 200, {
          quoteId: QUOTE_ID,
          decision: 'approved',
          annualInterestRate: '0.24',
        }),
      );
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
    [503, { error: 'service_unavailable' }],
    [500, 'Internal Server Error'],
    [400, { error: 'invalid_request' }],
  ])('devolve unavailable para a resposta HTTP %i', async (status, body) => {
    nock(BASE_URL).post(ROUTE).reply(status, body);

    expect(await quote()).toEqual({ status: 'unavailable' });
  });

  it('devolve invalid-response quando o corpo não é JSON', async () => {
    nock(BASE_URL).post(ROUTE).reply(200, 'ok', { 'content-type': 'text/plain' });

    expect(await quote()).toEqual({ status: 'invalid-response' });
  });

  it.each([
    ['sem decisão', { quoteId: QUOTE_ID, annualInterestRate: '0.24' }],
    ['com decisão desconhecida', { quoteId: QUOTE_ID, decision: 'pending' }],
    ['recusada sem motivo', { quoteId: QUOTE_ID, decision: 'declined' }],
    ['sem taxa', { quoteId: QUOTE_ID, decision: 'approved' }],
    ['com taxa numérica', { quoteId: QUOTE_ID, decision: 'approved', annualInterestRate: 0.24 }],
    [
      'com taxa em texto livre',
      { quoteId: QUOTE_ID, decision: 'approved', annualInterestRate: '24%' },
    ],
    ['com taxa negativa', { quoteId: QUOTE_ID, decision: 'approved', annualInterestRate: '-0.01' }],
    [
      'com taxa acima de 1000% a.a.',
      { quoteId: QUOTE_ID, decision: 'approved', annualInterestRate: '10.01' },
    ],
  ])('devolve invalid-response para uma resposta %s', async (_case, body) => {
    nock(BASE_URL).post(ROUTE).reply(200, body);

    expect(await quote()).toEqual({ status: 'invalid-response' });
  });
});
