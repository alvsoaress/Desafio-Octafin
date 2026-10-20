import { describe, expect, it } from 'vitest';
import {
  bankResultSchema,
  offerSchema,
  rateSchema,
  simulationResponseSchema,
} from './simulation-response';

const alphaOffer = {
  annualRate: '0.240000',
  monthlyRate: '0.018088',
  installmentCents: 51733,
  totalCents: 1241592,
  totalInterestCents: 241592,
  withinMargin: true,
  maxInstallmentCents: 125000,
  maxFinanceableCents: null,
};

const referenceResponse = {
  requestId: '3f2b8c1e-5d4a-4f6b-9c7e-1a2b3c4d5e6f',
  partial: true,
  margin: { consignableCents: 175000, availableCents: 125000 },
  request: { requestedAmountCents: 1000000, termMonths: 24 },
  results: [
    { bankId: 'alpha', bankName: 'Banco Alpha', status: 'success', offer: alphaOffer },
    {
      bankId: 'beta',
      bankName: 'Banco Beta',
      status: 'timeout',
      error: { code: 'timeout', message: 'O Banco Beta não respondeu a tempo.' },
    },
  ],
};

describe('rateSchema', () => {
  it.each(['0.240000', '0.018088', '0.000000'])('aceita %s', (rate) => {
    expect(rateSchema.safeParse(rate).success).toBe(true);
  });

  it.each([0.24, '0.24', '-0.018088', '0.0180880', '.018088'])('recusa %s', (rate) => {
    expect(rateSchema.safeParse(rate).success).toBe(false);
  });
});

describe('offerSchema', () => {
  it('aceita oferta dentro da margem com maxFinanceableCents nulo', () => {
    expect(offerSchema.safeParse(alphaOffer).success).toBe(true);
  });

  it('aceita oferta fora da margem com maxFinanceableCents preenchido', () => {
    const offer = {
      ...alphaOffer,
      withinMargin: false,
      maxInstallmentCents: 45000,
      maxFinanceableCents: 869852,
    };

    expect(offerSchema.safeParse(offer).success).toBe(true);
  });

  it('recusa oferta dentro da margem com maxFinanceableCents preenchido', () => {
    expect(offerSchema.safeParse({ ...alphaOffer, maxFinanceableCents: 869852 }).success).toBe(
      false,
    );
  });

  it('recusa oferta fora da margem sem maxFinanceableCents', () => {
    expect(offerSchema.safeParse({ ...alphaOffer, withinMargin: false }).success).toBe(false);
  });

  it('recusa centavos não inteiros', () => {
    expect(offerSchema.safeParse({ ...alphaOffer, installmentCents: 517.33 }).success).toBe(false);
  });
});

describe('bankResultSchema', () => {
  const identity = { bankId: 'beta', bankName: 'Banco Beta' };

  it.each(['timeout', 'unavailable', 'invalid-response'])(
    'aceita o status %s com error',
    (status) => {
      const result = { ...identity, status, error: { code: status, message: 'Mensagem.' } };

      expect(bankResultSchema.safeParse(result).success).toBe(true);
    },
  );

  it('recusa success sem offer', () => {
    expect(bankResultSchema.safeParse({ ...identity, status: 'success' }).success).toBe(false);
  });

  it('recusa success com error', () => {
    const result = {
      ...identity,
      status: 'success',
      offer: alphaOffer,
      error: { code: 'timeout', message: 'Mensagem.' },
    };

    expect(bankResultSchema.safeParse(result).success).toBe(false);
  });

  it('recusa falha com offer', () => {
    const result = {
      ...identity,
      status: 'timeout',
      offer: alphaOffer,
      error: { code: 'timeout', message: 'Mensagem.' },
    };

    expect(bankResultSchema.safeParse(result).success).toBe(false);
  });

  it('recusa error.code diferente do status', () => {
    const result = {
      ...identity,
      status: 'timeout',
      error: { code: 'unavailable', message: 'M.' },
    };

    expect(bankResultSchema.safeParse(result).success).toBe(false);
  });

  it('recusa status desconhecido', () => {
    const result = { ...identity, status: 'error', error: { code: 'error', message: 'M.' } };

    expect(bankResultSchema.safeParse(result).success).toBe(false);
  });
});

describe('simulationResponseSchema', () => {
  it('aceita o exemplo da RF-07.2', () => {
    expect(simulationResponseSchema.parse(referenceResponse)).toEqual(referenceResponse);
  });

  it('aceita partial falso quando todos os bancos responderam', () => {
    const response = {
      ...referenceResponse,
      partial: false,
      results: [referenceResponse.results[0]],
    };

    expect(simulationResponseSchema.safeParse(response).success).toBe(true);
  });

  it('recusa partial falso com um banco em timeout', () => {
    expect(
      simulationResponseSchema.safeParse({ ...referenceResponse, partial: false }).success,
    ).toBe(false);
  });

  it('recusa partial verdadeiro quando todos responderam', () => {
    const response = { ...referenceResponse, results: [referenceResponse.results[0]] };

    expect(simulationResponseSchema.safeParse(response).success).toBe(false);
  });

  it('recusa requestId que não é UUID', () => {
    expect(
      simulationResponseSchema.safeParse({ ...referenceResponse, requestId: 'b3f1' }).success,
    ).toBe(false);
  });

  it('recusa results vazio', () => {
    const response = { ...referenceResponse, partial: false, results: [] };

    expect(simulationResponseSchema.safeParse(response).success).toBe(false);
  });
});
