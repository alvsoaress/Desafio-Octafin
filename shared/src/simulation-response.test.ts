import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
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

const betaOffer = {
  annualRate: '0.215000',
  monthlyRate: '0.016361',
  installmentCents: 50717,
  totalCents: 1217208,
  totalInterestCents: 217208,
  withinMargin: true,
  maxInstallmentCents: 125000,
  maxFinanceableCents: null,
};

const alphaSuccess = referenceResponse.results[0]!;
const betaSuccess = {
  bankId: 'beta',
  bankName: 'Banco Beta',
  status: 'success',
  offer: betaOffer,
};

const overMarginResponse = {
  ...referenceResponse,
  partial: false,
  margin: { consignableCents: 105000, availableCents: 45000 },
  results: [
    {
      ...alphaSuccess,
      offer: {
        ...alphaOffer,
        withinMargin: false,
        maxInstallmentCents: 45000,
        maxFinanceableCents: 869852,
      },
    },
  ],
};

function issuePaths(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value);

  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

function withAlphaOffer(offer: object) {
  return {
    ...referenceResponse,
    partial: false,
    results: [{ ...alphaSuccess, offer: { ...alphaOffer, ...offer } }],
  };
}

function withRequest(requestedAmountCents: number, termMonths: number) {
  const totalCents = alphaOffer.installmentCents * termMonths;

  return {
    ...withAlphaOffer({
      totalCents,
      totalInterestCents: Math.max(0, totalCents - requestedAmountCents),
    }),
    request: { requestedAmountCents, termMonths },
  };
}

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
    const offer = { ...alphaOffer, withinMargin: false, maxInstallmentCents: 45000 };

    expect(issuePaths(offerSchema, offer)).toEqual([['maxFinanceableCents']]);
  });

  it('aceita oferta dentro da margem com a parcela igual à parcela máxima', () => {
    expect(offerSchema.safeParse({ ...alphaOffer, maxInstallmentCents: 51733 }).success).toBe(true);
  });

  it('recusa withinMargin verdadeiro com a parcela acima da parcela máxima', () => {
    expect(issuePaths(offerSchema, { ...alphaOffer, maxInstallmentCents: 51732 })).toEqual([
      ['withinMargin'],
    ]);
  });

  it.each([125000, 51733])(
    'recusa withinMargin falso com a parcela cabendo na parcela máxima de %i',
    (maxInstallmentCents) => {
      const offer = {
        ...alphaOffer,
        withinMargin: false,
        maxInstallmentCents,
        maxFinanceableCents: 869852,
      };

      expect(issuePaths(offerSchema, offer)).toEqual([['withinMargin']]);
    },
  );

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

  it.each(['amount-above-limit', 'employer-not-covered', 'low-score', 'other'])(
    'aceita a recusa do banco com o motivo %s',
    (reason) => {
      const result = { ...identity, status: 'rejected', rejection: { reason, message: 'Motivo.' } };

      expect(bankResultSchema.safeParse(result).success).toBe(true);
    },
  );

  it.each([
    ['sem rejection', {}],
    ['com motivo desconhecido', { rejection: { reason: 'credit-score', message: 'M.' } }],
    ['sem mensagem', { rejection: { reason: 'other', message: '' } }],
    ['com error no lugar de rejection', { error: { code: 'rejected', message: 'M.' } }],
    ['com offer', { offer: alphaOffer, rejection: { reason: 'other', message: 'M.' } }],
  ])('recusa rejected %s', (_case, fields) => {
    expect(bankResultSchema.safeParse({ ...identity, status: 'rejected', ...fields }).success).toBe(
      false,
    );
  });

  it('recusa status desconhecido', () => {
    const result = { ...identity, status: 'error', error: { code: 'error', message: 'M.' } };

    expect(bankResultSchema.safeParse(result).success).toBe(false);
  });
});

describe('simulationResponseSchema', () => {
  it('aceita o exemplo de referência', () => {
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

  it('trata a recusa do banco como resposta, sem resultado parcial', () => {
    const rejected = {
      bankId: 'beta',
      bankName: 'Banco Beta',
      status: 'rejected',
      rejection: { reason: 'employer-not-covered', message: 'Sem convênio.' },
    };
    const response = { ...referenceResponse, results: [alphaSuccess, rejected] };

    expect(simulationResponseSchema.safeParse({ ...response, partial: false }).success).toBe(true);
    expect(simulationResponseSchema.safeParse({ ...response, partial: true }).success).toBe(false);
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

describe('simulationResponseSchema: consistência', () => {
  it('aceita margem disponível igual à consignável', () => {
    const response = {
      ...withAlphaOffer({ maxInstallmentCents: 175000 }),
      margin: { consignableCents: 175000, availableCents: 175000 },
    };

    expect(simulationResponseSchema.safeParse(response).success).toBe(true);
  });

  it('recusa margem disponível maior que a consignável', () => {
    const response = {
      ...withAlphaOffer({ maxInstallmentCents: 175001 }),
      margin: { consignableCents: 175000, availableCents: 175001 },
    };

    expect(issuePaths(simulationResponseSchema, response)).toEqual([['margin', 'availableCents']]);
  });

  it.each([
    [50000, 6],
    [50000000, 96],
  ])('aceita o valor %i e o prazo %i nos limites da requisição', (amount, term) => {
    expect(simulationResponseSchema.safeParse(withRequest(amount, term)).success).toBe(true);
  });

  it.each([
    [1000000, 5, 'termMonths'],
    [1000000, 97, 'termMonths'],
    [49999, 24, 'requestedAmountCents'],
    [50000001, 24, 'requestedAmountCents'],
  ])('recusa o valor %i com o prazo %i, fora dos limites', (amount, term, field) => {
    expect(issuePaths(simulationResponseSchema, withRequest(amount, term))).toEqual([
      ['request', field],
    ]);
  });

  it('recusa dois resultados de sucesso do mesmo banco', () => {
    const response = {
      ...referenceResponse,
      partial: false,
      results: [alphaSuccess, alphaSuccess],
    };

    expect(issuePaths(simulationResponseSchema, response)).toEqual([['results', 1, 'bankId']]);
  });

  it('recusa um sucesso e uma falha do mesmo banco', () => {
    const response = {
      ...referenceResponse,
      results: [alphaSuccess, { ...referenceResponse.results[1], bankId: 'alpha' }],
    };

    expect(issuePaths(simulationResponseSchema, response)).toEqual([['results', 1, 'bankId']]);
  });

  it('recusa parcela máxima diferente da margem disponível', () => {
    expect(
      issuePaths(simulationResponseSchema, withAlphaOffer({ maxInstallmentCents: 125001 })),
    ).toEqual([['results', 0, 'offer', 'maxInstallmentCents']]);
  });

  it('recusa total diferente da parcela vezes o prazo', () => {
    const response = withAlphaOffer({ totalCents: 1241593, totalInterestCents: 241593 });

    expect(issuePaths(simulationResponseSchema, response)).toEqual([
      ['results', 0, 'offer', 'totalCents'],
    ]);
  });

  it('recusa juros diferentes do total menos o valor pedido', () => {
    expect(
      issuePaths(simulationResponseSchema, withAlphaOffer({ totalInterestCents: 241591 })),
    ).toEqual([['results', 0, 'offer', 'totalInterestCents']]);
  });

  it('aceita oferta fora da margem com valor financiável igual ao valor pedido', () => {
    const response = {
      ...overMarginResponse,
      results: [
        {
          ...overMarginResponse.results[0]!,
          offer: { ...overMarginResponse.results[0]!.offer, maxFinanceableCents: 1000000 },
        },
      ],
    };

    expect(simulationResponseSchema.safeParse(overMarginResponse).success).toBe(true);
    expect(simulationResponseSchema.safeParse(response).success).toBe(true);
  });

  it('recusa valor financiável maior que o valor pedido', () => {
    const response = {
      ...overMarginResponse,
      results: [
        {
          ...overMarginResponse.results[0]!,
          offer: { ...overMarginResponse.results[0]!.offer, maxFinanceableCents: 1000001 },
        },
      ],
    };

    expect(issuePaths(simulationResponseSchema, response)).toEqual([
      ['results', 0, 'offer', 'maxFinanceableCents'],
    ]);
  });

  it('aponta o banco inconsistente quando ele é o segundo', () => {
    const response = {
      ...referenceResponse,
      partial: false,
      results: [
        alphaSuccess,
        {
          ...betaSuccess,
          offer: { ...betaOffer, totalCents: 1217209, totalInterestCents: 217209 },
        },
      ],
    };

    expect(issuePaths(simulationResponseSchema, response)).toEqual([
      ['results', 1, 'offer', 'totalCents'],
    ]);
  });

  it('explica a regra violada em português', () => {
    const result = simulationResponseSchema.safeParse(
      withAlphaOffer({ totalCents: 1241593, totalInterestCents: 241593 }),
    );

    expect(result.error?.issues[0]?.message).toBe('totalCents deve ser a parcela vezes o prazo.');
  });
});
