import type { BankResult, Offer, SimulationResponse } from '@consignado/shared';

const requestId = '7d2c1f4e-8a3b-4c5d-9e6f-0a1b2c3d4e5f';
const request = { requestedAmountCents: 1000000, termMonths: 24 };

const alphaOffer: Offer = {
  annualRate: '0.240000',
  monthlyRate: '0.018088',
  installmentCents: 51733,
  totalCents: 1241592,
  totalInterestCents: 241592,
  withinMargin: true,
  maxInstallmentCents: 125000,
  maxFinanceableCents: null,
};

const betaOffer: Offer = {
  annualRate: '0.215000',
  monthlyRate: '0.016361',
  installmentCents: 50717,
  totalCents: 1217208,
  totalInterestCents: 217208,
  withinMargin: true,
  maxInstallmentCents: 125000,
  maxFinanceableCents: null,
};

function success(bankId: 'alpha' | 'beta', offer: Offer): BankResult {
  const bankName = bankId === 'alpha' ? 'Banco Alpha' : 'Banco Beta';

  return { bankId, bankName, status: 'success', offer };
}

export const alphaTimeout: BankResult = {
  bankId: 'alpha',
  bankName: 'Banco Alpha',
  status: 'timeout',
  error: { code: 'timeout', message: 'O Banco Alpha não respondeu a tempo.' },
};

export const betaTimeout: BankResult = {
  bankId: 'beta',
  bankName: 'Banco Beta',
  status: 'timeout',
  error: { code: 'timeout', message: 'O Banco Beta não respondeu a tempo.' },
};

export const betaUnavailable: BankResult = {
  bankId: 'beta',
  bankName: 'Banco Beta',
  status: 'unavailable',
  error: { code: 'unavailable', message: 'O Banco Beta está indisponível no momento.' },
};

export const betaInvalidResponse: BankResult = {
  bankId: 'beta',
  bankName: 'Banco Beta',
  status: 'invalid-response',
  error: {
    code: 'invalid-response',
    message: 'O Banco Beta devolveu uma resposta que não conseguimos ler.',
  },
};

export const referenceResponse: SimulationResponse = {
  requestId,
  partial: true,
  margin: { consignableCents: 175000, availableCents: 125000 },
  request,
  results: [success('alpha', alphaOffer), betaTimeout],
};

export const bothSuccessResponse: SimulationResponse = {
  requestId,
  partial: false,
  margin: { consignableCents: 175000, availableCents: 125000 },
  request,
  results: [success('alpha', alphaOffer), success('beta', betaOffer)],
};

export const overMarginResponse: SimulationResponse = {
  requestId,
  partial: false,
  margin: { consignableCents: 105000, availableCents: 45000 },
  request,
  results: [
    success('alpha', {
      ...alphaOffer,
      withinMargin: false,
      maxInstallmentCents: 45000,
      maxFinanceableCents: 869852,
    }),
    success('beta', {
      ...betaOffer,
      withinMargin: false,
      maxInstallmentCents: 45000,
      maxFinanceableCents: 887280,
    }),
  ],
};

export const oneApprovedResponse: SimulationResponse = {
  requestId,
  partial: false,
  margin: { consignableCents: 175000, availableCents: 51000 },
  request,
  results: [
    success('alpha', {
      ...alphaOffer,
      withinMargin: false,
      maxInstallmentCents: 51000,
      maxFinanceableCents: 985833,
    }),
    success('beta', { ...betaOffer, maxInstallmentCents: 51000 }),
  ],
};

export const zeroMarginResponse: SimulationResponse = {
  requestId,
  partial: false,
  margin: { consignableCents: 105000, availableCents: 0 },
  request,
  results: [
    success('alpha', {
      ...alphaOffer,
      withinMargin: false,
      maxInstallmentCents: 0,
      maxFinanceableCents: 0,
    }),
    success('beta', {
      ...betaOffer,
      withinMargin: false,
      maxInstallmentCents: 0,
      maxFinanceableCents: 0,
    }),
  ],
};

export const allFailedResponse: SimulationResponse = {
  requestId,
  partial: true,
  margin: { consignableCents: 175000, availableCents: 125000 },
  request,
  results: [
    {
      bankId: 'alpha',
      bankName: 'Banco Alpha',
      status: 'unavailable',
      error: { code: 'unavailable', message: 'O Banco Alpha está indisponível no momento.' },
    },
    betaTimeout,
  ],
};
