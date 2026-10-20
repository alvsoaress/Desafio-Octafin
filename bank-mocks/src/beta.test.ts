import { fictitiousCpfs } from '@consignado/shared/fixtures';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { BETA_SLOW_DELAY_MS, createBetaApp, type BetaOptions } from './beta';
import { BETA_SCENARIOS } from './config';

const cpf = fictitiousCpfs[0];

const validBody = {
  cpf: cpf.digits,
  valor: '10000.00',
  prazoMeses: 24,
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type BetaQuote = { codigo: string; taxaAnualPercentual?: string };

function postSimulation(body: unknown, options: BetaOptions = {}) {
  return request(createBetaApp({ delayMs: 0, slowDelayMs: 0, ...options }))
    .post('/api/simulacao')
    .send(body as object);
}

describe('POST /api/simulacao', () => {
  describe('cenário ok', () => {
    it('devolve a taxa anual em percentual', async () => {
      const response = await postSimulation(validBody, { scenario: 'ok' });
      const body = response.body as BetaQuote;

      expect(response.status).toBe(200);
      expect(Object.keys(body).sort()).toEqual(['codigo', 'taxaAnualPercentual']);
      expect(body.taxaAnualPercentual).toBe('21.50');
      expect(body.codigo).toMatch(uuidPattern);
      expect(response.text).not.toContain(cpf.digits);
    });

    it.each([
      ['CPF com máscara', { cpf: cpf.masked }],
      ['CPF com dígito verificador errado', { cpf: '38192746501' }],
      ['CPF ausente', { cpf: undefined }],
      ['valor como número', { valor: 10000 }],
      ['valor com vírgula', { valor: '10000,00' }],
      ['valor sem centavos', { valor: '10000' }],
      ['valor zero', { valor: '0.00' }],
      ['prazo abaixo de 6', { prazoMeses: 5 }],
      ['prazo acima de 96', { prazoMeses: 97 }],
      ['prazo como string', { prazoMeses: '24' }],
      ['campo desconhecido', { document: cpf.digits }],
    ])('recusa %s com HTTP 400', async (_case, overrides) => {
      const response = await postSimulation({ ...validBody, ...overrides }, { scenario: 'ok' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ erro: 'requisicao_invalida' });
      expect(response.text).not.toContain(cpf.digits);
    });

    it('recusa JSON malformado com HTTP 400', async () => {
      const response = await request(createBetaApp({ scenario: 'ok', delayMs: 0 }))
        .post('/api/simulacao')
        .set('content-type', 'application/json')
        .send('{"cpf":');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ erro: 'requisicao_invalida' });
    });
  });

  describe('cenário slow', () => {
    it('só responde depois da espera configurada, com a oferta válida', async () => {
      const startedAt = Date.now();
      const response = await postSimulation(validBody, { scenario: 'slow', slowDelayMs: 50 });

      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(45);
      expect(response.status).toBe(200);
      expect((response.body as BetaQuote).taxaAnualPercentual).toBe('21.50');
    });

    it('demora por padrão mais que o tempo limite padrão da API', () => {
      expect(BETA_SLOW_DELAY_MS).toBe(10_000);
      expect(BETA_SLOW_DELAY_MS).toBeGreaterThan(3000);
    });
  });

  describe('cenário unavailable', () => {
    it.each([
      ['corpo válido', validBody],
      ['corpo inválido', { cpf: 'abc' }],
    ])('responde HTTP 503 com %s', async (_case, body) => {
      const response = await postSimulation(body, { scenario: 'unavailable' });

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ erro: 'servico_indisponivel' });
    });

    it('responde HTTP 503 mesmo com JSON malformado', async () => {
      const response = await request(createBetaApp({ scenario: 'unavailable' }))
        .post('/api/simulacao')
        .set('content-type', 'application/json')
        .send('{"cpf":');

      expect(response.status).toBe(503);
    });
  });

  describe('cenário invalid', () => {
    it('responde HTTP 200 em JSON sem o campo da taxa', async () => {
      const response = await postSimulation(validBody, { scenario: 'invalid' });
      const body = response.body as BetaQuote;

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(body.codigo).toMatch(uuidPattern);
      expect(body).not.toHaveProperty('taxaAnualPercentual');
    });

    it('continua recusando corpo inválido com HTTP 400', async () => {
      const response = await postSimulation(
        { ...validBody, prazoMeses: 5 },
        { scenario: 'invalid' },
      );

      expect(response.status).toBe(400);
    });
  });

  it.each(BETA_SCENARIOS)(
    'no cenário %s responde igual a duas chamadas seguidas',
    async (scenario) => {
      const first = await postSimulation(validBody, { scenario });
      const second = await postSimulation(validBody, { scenario });

      expect(second.status).toBe(first.status);
      expect(Object.keys(second.body as object).sort()).toEqual(
        Object.keys(first.body as object).sort(),
      );
    },
  );
});
