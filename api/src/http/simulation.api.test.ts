import {
  simulationResponseSchema,
  validationMessages,
  type SimulationRequestInput,
} from '@consignado/shared';
import { fictitiousCnpjs, fictitiousCpfs } from '@consignado/shared/fixtures';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import type { BankAdapter, BankQuoteResult } from '../domain/bank-adapter';
import { Decimal } from '../domain/money';
import { createLogger } from '../infra/logger';
import { SimulationService, type Logger } from '../services/simulation.service';
import type { Simulator } from './controllers/simulation.controller';

const [cpf] = fictitiousCpfs;
const [cnpj] = fictitiousCnpjs;
const webOrigin = 'http://localhost:5173';

const validBody: SimulationRequestInput = {
  cpf: cpf.masked,
  employerCnpj: cnpj.masked,
  salaryCents: 500000,
  existingDeductionsCents: 50000,
  requestedAmountCents: 1000000,
  termMonths: 24,
};

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn() } satisfies Logger;
}

function fakeAdapter(bankId: string, result: BankQuoteResult, delayMs = 0) {
  return {
    bankId,
    bankName: `Banco ${bankId[0]?.toUpperCase()}${bankId.slice(1)}`,
    quote: vi.fn(
      () => new Promise<BankQuoteResult>((resolve) => setTimeout(() => resolve(result), delayMs)),
    ),
  } satisfies BankAdapter;
}

function success(rate: string): BankQuoteResult {
  return { status: 'success', annualRate: new Decimal(rate) };
}

function createTestApp({
  adapters = [fakeAdapter('alpha', success('0.24')), fakeAdapter('beta', success('0.215'))],
  timeoutMs = 1000,
  logger = fakeLogger(),
  simulationService,
}: {
  adapters?: BankAdapter[];
  timeoutMs?: number;
  logger?: Logger;
  simulationService?: Simulator;
} = {}) {
  return createApp({
    simulationService: simulationService ?? new SimulationService({ adapters, timeoutMs, logger }),
    logger,
    webOrigin,
  });
}

function simulate(app: ReturnType<typeof createTestApp>, body: object = validBody) {
  return request(app).post('/api/simulations').send(body);
}

describe('POST /api/simulations', () => {
  it('responde 200 com a resposta consolidada do contrato', async () => {
    const response = await simulate(createTestApp());

    expect(response.status).toBe(200);
    expect(simulationResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body).toMatchObject({
      requestId: response.headers['x-request-id'],
      partial: false,
      margin: { consignableCents: 175000, availableCents: 125000 },
      request: { requestedAmountCents: 1000000, termMonths: 24 },
      results: [
        {
          bankId: 'alpha',
          bankName: 'Banco Alpha',
          status: 'success',
          offer: {
            annualRate: '0.240000',
            monthlyRate: '0.018088',
            installmentCents: 51733,
            totalCents: 1241592,
            totalInterestCents: 241592,
            withinMargin: true,
            maxInstallmentCents: 125000,
            maxFinanceableCents: null,
          },
        },
        { bankId: 'beta', status: 'success' },
      ],
    });
  });

  it.each([
    ['cpf', { cpf: '381.927.465-01' }, validationMessages.cpf],
    ['employerCnpj', { employerCnpj: '11.111.111/1111-11' }, validationMessages.employerCnpj],
    [
      'existingDeductionsCents',
      { existingDeductionsCents: 500001 },
      validationMessages.existingDeductionsCents,
    ],
    [
      'requestedAmountCents',
      { requestedAmountCents: 49999 },
      validationMessages.requestedAmountCents,
    ],
    ['termMonths', { termMonths: 97 }, validationMessages.termMonths],
    ['foo', { foo: 1 }, validationMessages.unknownField],
  ])('responde 400 para %s inválido sem consultar os bancos', async (field, override, message) => {
    const adapters = [fakeAdapter('alpha', success('0.24')), fakeAdapter('beta', success('0.215'))];

    const response = await simulate(createTestApp({ adapters }), { ...validBody, ...override });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'validation_error',
      fields: { [field]: message },
      requestId: response.headers['x-request-id'],
    });
    for (const adapter of adapters) {
      expect(adapter.quote).not.toHaveBeenCalled();
    }
  });

  it('responde 200 com margem zero e consulta os bancos mesmo assim', async () => {
    const adapters = [fakeAdapter('alpha', success('0.24')), fakeAdapter('beta', success('0.215'))];

    const response = await simulate(createTestApp({ adapters }), {
      ...validBody,
      salaryCents: 300000,
      existingDeductionsCents: 105000,
    });

    expect(response.status).toBe(200);
    expect(simulationResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body).toMatchObject({ margin: { availableCents: 0 } });
    expect(response.body).toMatchObject({
      results: [
        { offer: { withinMargin: false, maxFinanceableCents: 0 } },
        { offer: { withinMargin: false, maxFinanceableCents: 0 } },
      ],
    });
    for (const adapter of adapters) {
      expect(adapter.quote).toHaveBeenCalledTimes(1);
    }
  });

  it('responde 200 com partial true quando os dois bancos falham', async () => {
    const response = await simulate(
      createTestApp({
        adapters: [
          fakeAdapter('alpha', { status: 'unavailable' }),
          fakeAdapter('beta', { status: 'invalid-response' }),
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(simulationResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body).toMatchObject({
      partial: true,
      results: [
        {
          status: 'unavailable',
          error: { code: 'unavailable', message: 'O Banco Alpha está indisponível no momento.' },
        },
        {
          status: 'invalid-response',
          error: {
            code: 'invalid-response',
            message: 'O Banco Beta devolveu uma resposta que não conseguimos ler.',
          },
        },
      ],
    });
  });

  it('responde 200 com timeout do banco lento sem esperar por ele', async () => {
    const startedAt = performance.now();

    const response = await simulate(
      createTestApp({
        adapters: [
          fakeAdapter('alpha', success('0.24')),
          fakeAdapter('beta', success('0.215'), 1000),
        ],
        timeoutMs: 50,
      }),
    );

    expect(performance.now() - startedAt).toBeLessThan(500);
    expect(response.status).toBe(200);
    expect(simulationResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body).toMatchObject({
      partial: true,
      results: [
        { bankId: 'alpha', status: 'success' },
        {
          bankId: 'beta',
          status: 'timeout',
          error: { code: 'timeout', message: 'O Banco Beta não respondeu a tempo.' },
        },
      ],
    });
  });

  it('responde 500 internal_error quando o serviço falha', async () => {
    const simulationService: Simulator = {
      simulate: vi.fn().mockRejectedValue(new Error(`cpf ${cpf.digits}`)),
    };

    const response = await simulate(createTestApp({ simulationService }));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'internal_error',
      requestId: response.headers['x-request-id'],
    });
  });

  it('não deixa CPF, CNPJ nem valores nos logs de uma simulação completa', async () => {
    const lines: string[] = [];
    const logger = createLogger({ level: 'info' }, { write: (line: string) => lines.push(line) });

    const response = await simulate(createTestApp({ logger }), {
      ...validBody,
      salaryCents: 512345,
      existingDeductionsCents: 61234,
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(response.status).toBe(200);
    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bankId: 'alpha', status: 'success' }),
        expect.objectContaining({ bankId: 'beta', status: 'success' }),
        expect.objectContaining({ method: 'POST', path: '/api/simulations', status: 200 }),
      ]),
    );
    expect(entries.filter((entry) => 'bankId' in entry)).toHaveLength(2);
    for (const entry of entries.filter((entry) => 'bankId' in entry)) {
      expect(entry).toMatchObject({ durationMs: expect.any(Number) as number });
    }
    const output = lines.join('');
    for (const secret of [cpf.digits, cpf.masked, cnpj.digits, cnpj.masked, '512345', '61234']) {
      expect(output).not.toContain(secret);
    }
  });
});
