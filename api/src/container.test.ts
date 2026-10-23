import { simulationRequestSchema } from '@consignado/shared';
import { fictitiousCnpjs, fictitiousCpfs, fictitiousCustomer } from '@consignado/shared/fixtures';
import nock from 'nock';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ApiConfig } from './config/env';
import { createContainer } from './container';

const config: ApiConfig = {
  port: 3000,
  webOrigin: 'http://localhost:5173',
  alphaBaseUrl: 'http://alpha.test',
  betaBaseUrl: 'http://beta.test',
  bankTimeoutMs: 1000,
  logLevel: 'silent',
};

beforeAll(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
});

describe('createContainer', () => {
  it('consulta o Alpha e o Beta, nessa ordem, nas URLs da configuração', async () => {
    const beta = nock(config.betaBaseUrl)
      .post('/api/simulacao')
      .reply(200, { codigo: 'b-1', taxaAnualPercentual: '21.50', valorParcela: '507.17' });
    const alpha = nock(config.alphaBaseUrl)
      .post('/v1/loan-quotes')
      .reply(200, { quoteId: 'a-1', decision: 'approved', annualInterestRate: '0.24' });
    const { simulationService } = createContainer(config);

    const response = await simulationService.simulate(
      simulationRequestSchema.parse({
        name: fictitiousCustomer.name,
        email: fictitiousCustomer.email,
        cpf: fictitiousCpfs[0].digits,
        employerCnpj: fictitiousCnpjs[0].digits,
        salaryCents: 500000,
        existingDeductionsCents: 50000,
        requestedAmountCents: 1000000,
        termMonths: 24,
      }),
      crypto.randomUUID(),
    );

    expect(alpha.isDone()).toBe(true);
    expect(beta.isDone()).toBe(true);
    expect(response.results.map(({ bankId, status }) => ({ bankId, status }))).toEqual([
      { bankId: 'alpha', status: 'success' },
      { bankId: 'beta', status: 'success' },
    ]);
  });
});
