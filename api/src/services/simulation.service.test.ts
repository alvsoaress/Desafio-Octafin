import { randomUUID } from 'node:crypto';
import {
  simulationRequestSchema,
  simulationResponseSchema,
  type SimulationRequest,
  type SimulationRequestInput,
} from '@consignado/shared';
import { fictitiousCnpjs, fictitiousCpfs, fictitiousCustomer } from '@consignado/shared/fixtures';
import { describe, expect, it, vi } from 'vitest';
import type { BankAdapter, BankQuoteRequest, BankQuoteResult } from '../domain/bank-adapter';
import { calculateOffer } from '../domain/loan';
import { Decimal } from '../domain/money';
import {
  bankErrorMessage,
  bankRejectionMessage,
  SimulationService,
  type Logger,
} from './simulation.service';

const CPF = fictitiousCpfs[0];

function simulationRequest(overrides: Partial<SimulationRequestInput> = {}) {
  return simulationRequestSchema.parse({
    name: fictitiousCustomer.name,
    email: fictitiousCustomer.email,
    cpf: CPF.masked,
    employerCnpj: fictitiousCnpjs[0].masked,
    salaryCents: 500000,
    existingDeductionsCents: 50000,
    requestedAmountCents: 1000000,
    termMonths: 24,
    ...overrides,
  });
}

function fakeAdapter(
  bankId: string,
  quote: (request: BankQuoteRequest, signal: AbortSignal) => Promise<BankQuoteResult>,
) {
  return {
    bankId,
    bankName: `Banco ${bankId[0]?.toUpperCase()}${bankId.slice(1)}`,
    quote: vi.fn(quote),
  } satisfies BankAdapter;
}

function respondsWith(result: BankQuoteResult, delayMs = 0) {
  return () =>
    new Promise<BankQuoteResult>((resolve) => setTimeout(() => resolve(result), delayMs));
}

function success(rate: string): BankQuoteResult {
  return { status: 'success', annualRate: new Decimal(rate) };
}

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn() } satisfies Logger;
}

function createService(adapters: BankAdapter[], timeoutMs = 1000, logger = fakeLogger()) {
  const service = new SimulationService({ adapters, timeoutMs, logger });

  return {
    async simulate(request: SimulationRequest, requestId: string) {
      return simulationResponseSchema.parse(await service.simulate(request, requestId));
    },
  };
}

describe('bankErrorMessage', () => {
  it.each([
    ['timeout', 'O Banco Beta não respondeu a tempo.'],
    ['unavailable', 'O Banco Beta está indisponível no momento.'],
    ['invalid-response', 'O Banco Beta devolveu uma resposta que não conseguimos ler.'],
  ] as const)('dá a mensagem do status %s', (status, message) => {
    expect(bankErrorMessage('Banco Beta', status)).toBe(message);
  });

  it('usa o nome do banco na mensagem', () => {
    expect(bankErrorMessage('Banco Alpha', 'timeout')).toBe('O Banco Alpha não respondeu a tempo.');
  });
});

describe('bankRejectionMessage', () => {
  it.each([
    ['amount-above-limit', 'O Banco Alpha não aprova esse valor. Tente um valor menor.'],
    ['employer-not-covered', 'O Banco Alpha não tem convênio com o seu empregador.'],
    ['other', 'O Banco Alpha recusou a proposta.'],
  ] as const)('dá a mensagem do motivo %s', (reason, message) => {
    expect(bankRejectionMessage('Banco Alpha', reason)).toBe(message);
  });
});

describe('SimulationService', () => {
  it('devolve a recusa do banco com o motivo, sem marcar o resultado como parcial', async () => {
    const response = await createService([
      fakeAdapter('alpha', respondsWith(success('0.24'))),
      fakeAdapter('beta', respondsWith({ status: 'rejected', reason: 'employer-not-covered' })),
    ]).simulate(simulationRequest(), randomUUID());

    expect(response.partial).toBe(false);
    expect(response.results[1]).toEqual({
      bankId: 'beta',
      bankName: 'Banco Beta',
      status: 'rejected',
      rejection: {
        reason: 'employer-not-covered',
        message: 'O Banco Beta não tem convênio com o seu empregador.',
      },
    });
  });

  it('marca o resultado como parcial quando um banco recusa e outro não responde', async () => {
    const response = await createService([
      fakeAdapter('alpha', respondsWith({ status: 'rejected', reason: 'amount-above-limit' })),
      fakeAdapter('beta', respondsWith({ status: 'timeout' })),
    ]).simulate(simulationRequest(), randomUUID());

    expect(response.partial).toBe(true);
    expect(response.results.map((result) => result.status)).toEqual(['rejected', 'timeout']);
  });

  it('monta a resposta com as ofertas de todos os bancos', async () => {
    const requestId = randomUUID();
    const service = createService([
      fakeAdapter('alpha', respondsWith(success('0.24'))),
      fakeAdapter('beta', respondsWith(success('0.215'))),
    ]);

    const response = await service.simulate(simulationRequest(), requestId);

    expect(response).toEqual({
      requestId,
      partial: false,
      margin: { consignableCents: 175000, availableCents: 125000 },
      request: { requestedAmountCents: 1000000, termMonths: 24 },
      results: [
        {
          bankId: 'alpha',
          bankName: 'Banco Alpha',
          status: 'success',
          offer: calculateOffer({
            amountCents: 1000000,
            termMonths: 24,
            annualRate: new Decimal('0.24'),
            availableMarginCents: 125000,
          }),
        },
        {
          bankId: 'beta',
          bankName: 'Banco Beta',
          status: 'success',
          offer: calculateOffer({
            amountCents: 1000000,
            termMonths: 24,
            annualRate: new Decimal('0.215'),
            availableMarginCents: 125000,
          }),
        },
      ],
    });
  });

  it('mantém a ordem dos bancos registrados mesmo quando o segundo responde antes', async () => {
    const service = createService([
      fakeAdapter('alpha', respondsWith(success('0.24'), 50)),
      fakeAdapter('beta', respondsWith(success('0.215'))),
    ]);

    const response = await service.simulate(simulationRequest(), randomUUID());

    expect(response.results.map((result) => result.bankId)).toEqual(['alpha', 'beta']);
  });

  it('consulta os bancos em paralelo', async () => {
    const service = createService([
      fakeAdapter('alpha', respondsWith(success('0.24'), 100)),
      fakeAdapter('beta', respondsWith(success('0.215'), 100)),
    ]);
    const startedAt = performance.now();

    await service.simulate(simulationRequest(), randomUUID());

    expect(performance.now() - startedAt).toBeLessThan(190);
  });

  it('envia ao banco só o CPF e o CNPJ sem máscara, o valor e o prazo, sem nome, e-mail nem salário', async () => {
    const alpha = fakeAdapter('alpha', respondsWith(success('0.24')));

    await createService([alpha]).simulate(simulationRequest(), randomUUID());

    expect(alpha.quote).toHaveBeenCalledWith(
      {
        cpf: CPF.digits,
        employerCnpj: fictitiousCnpjs[0].digits,
        amountCents: 1000000,
        termMonths: 24,
      },
      expect.any(AbortSignal),
    );
  });

  it('devolve timeout para o banco que passa do tempo limite e a oferta do que respondeu', async () => {
    const service = createService(
      [
        fakeAdapter('alpha', respondsWith(success('0.24'))),
        fakeAdapter('beta', respondsWith(success('0.215'), 500)),
      ],
      50,
    );
    const startedAt = performance.now();

    const response = await service.simulate(simulationRequest(), randomUUID());

    expect(performance.now() - startedAt).toBeLessThan(400);
    expect(response.partial).toBe(true);
    expect(response.results[0]?.status).toBe('success');
    expect(response.results[1]).toEqual({
      bankId: 'beta',
      bankName: 'Banco Beta',
      status: 'timeout',
      error: { code: 'timeout', message: 'O Banco Beta não respondeu a tempo.' },
    });
  });

  it('aborta o sinal entregue ao banco quando o tempo limite estoura', async () => {
    let received: AbortSignal | undefined;
    const beta = fakeAdapter(
      'beta',
      (_request, signal) =>
        new Promise<BankQuoteResult>(() => {
          received = signal;
        }),
    );

    await createService([beta], 50).simulate(simulationRequest(), randomUUID());

    expect(received?.aborted).toBe(true);
  });

  it('devolve unavailable para o banco cujo adaptador lança exceção, sem derrubar a simulação', async () => {
    const logger = fakeLogger();
    const service = createService(
      [
        fakeAdapter('alpha', () => Promise.reject(new TypeError('falha'))),
        fakeAdapter('beta', respondsWith(success('0.215'))),
      ],
      1000,
      logger,
    );

    const response = await service.simulate(simulationRequest(), randomUUID());

    expect(response.results[0]).toMatchObject({ bankId: 'alpha', status: 'unavailable' });
    expect(response.results[1]?.status).toBe('success');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ bankId: 'alpha', errorName: 'TypeError' }),
      expect.any(String),
    );
  });

  it('trata como unavailable o adaptador que lança exceção antes de devolver a promessa', async () => {
    const throwing: BankAdapter = {
      bankId: 'alpha',
      bankName: 'Banco Alpha',
      quote: () => {
        throw new Error('falha');
      },
    };

    const response = await createService([throwing]).simulate(simulationRequest(), randomUUID());

    expect(response.results[0]?.status).toBe('unavailable');
  });

  it('loga status e duração de cada banco sem dados pessoais', async () => {
    const logger = fakeLogger();
    const requestId = randomUUID();
    const service = createService(
      [
        fakeAdapter('alpha', respondsWith(success('0.24'))),
        fakeAdapter('beta', () => Promise.reject(new Error(`falha com ${CPF.digits}`))),
      ],
      1000,
      logger,
    );

    await service.simulate(simulationRequest(), requestId);

    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      { requestId, bankId: 'alpha', status: 'success', durationMs: expect.any(Number) as number },
      expect.any(String),
    );
    expect(logger.info).toHaveBeenCalledWith(
      {
        requestId,
        bankId: 'beta',
        status: 'unavailable',
        durationMs: expect.any(Number) as number,
      },
      expect.any(String),
    );

    const logged = JSON.stringify([...logger.info.mock.calls, ...logger.error.mock.calls]);

    expect(logged).not.toContain(CPF.digits);
    expect(logged).not.toContain(CPF.masked);
    expect(logged).not.toContain('500000');
    expect(logged).not.toContain('1000000');
  });

  it('consulta os bancos e marca toda oferta fora da margem quando a margem é zero', async () => {
    const alpha = fakeAdapter('alpha', respondsWith(success('0.24')));
    const beta = fakeAdapter('beta', respondsWith(success('0.215')));

    const response = await createService([alpha, beta]).simulate(
      simulationRequest({ salaryCents: 300000, existingDeductionsCents: 105000 }),
      randomUUID(),
    );

    expect(alpha.quote).toHaveBeenCalledOnce();
    expect(beta.quote).toHaveBeenCalledOnce();
    expect(response.margin).toEqual({ consignableCents: 105000, availableCents: 0 });
    expect(response.partial).toBe(false);

    for (const result of response.results) {
      expect(result).toMatchObject({
        status: 'success',
        offer: { withinMargin: false, maxInstallmentCents: 0, maxFinanceableCents: 0 },
      });
    }
  });

  it('devolve resultado parcial com dois erros quando nenhum banco responde', async () => {
    const response = await createService([
      fakeAdapter('alpha', respondsWith({ status: 'unavailable' })),
      fakeAdapter('beta', respondsWith({ status: 'invalid-response' })),
    ]).simulate(simulationRequest(), randomUUID());

    expect(response.partial).toBe(true);
    expect(response.results).toEqual([
      {
        bankId: 'alpha',
        bankName: 'Banco Alpha',
        status: 'unavailable',
        error: { code: 'unavailable', message: 'O Banco Alpha está indisponível no momento.' },
      },
      {
        bankId: 'beta',
        bankName: 'Banco Beta',
        status: 'invalid-response',
        error: {
          code: 'invalid-response',
          message: 'O Banco Beta devolveu uma resposta que não conseguimos ler.',
        },
      },
    ]);
  });

  it('informa o valor financiável do exemplo de margem excedida', async () => {
    const response = await createService([
      fakeAdapter('alpha', respondsWith(success('0.24'))),
    ]).simulate(
      simulationRequest({ salaryCents: 300000, existingDeductionsCents: 60000 }),
      randomUUID(),
    );

    expect(response.margin.availableCents).toBe(45000);
    expect(response.results[0]).toMatchObject({
      status: 'success',
      offer: { installmentCents: 51733, withinMargin: false, maxFinanceableCents: 869852 },
    });
  });
});
