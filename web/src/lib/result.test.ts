import type { BankResult } from '@consignado/shared';
import { describe, expect, it } from 'vitest';
import {
  allFailedResponse,
  allRejectedResponse,
  betaRejected,
  betaRejectedResponse,
  betaInvalidResponse,
  betaTimeout,
  betaUnavailable,
  bothSuccessResponse,
  oneApprovedResponse,
  overMarginResponse,
  referenceResponse,
  zeroMarginResponse,
} from '../test/responses';
import { allBanksFailed, bankOutcome, lowestInstallmentBankId } from './result';

describe('bankOutcome', () => {
  it('aprova a oferta dentro da margem', () => {
    expect(bankOutcome(referenceResponse.results[0]!)).toBe('approved');
  });

  it.each([
    ['margem excedida', overMarginResponse],
    ['margem zero', zeroMarginResponse],
  ])('separa da recusa a oferta fora da margem (%s)', (_case, response) => {
    expect(bankOutcome(response.results[0]!)).toBe('above-margin');
  });

  it('reprova quando o próprio banco recusa', () => {
    expect(bankOutcome(betaRejected)).toBe('rejected');
  });

  it.each([
    ['timeout', betaTimeout],
    ['unavailable', betaUnavailable],
    ['invalid-response', betaInvalidResponse],
  ])('trata a falha %s como sem resposta', (_status, result) => {
    expect(bankOutcome(result)).toBe('no-response');
  });
});

describe('lowestInstallmentBankId', () => {
  it('escolhe a menor parcela entre as ofertas aprovadas', () => {
    expect(lowestInstallmentBankId(bothSuccessResponse.results)).toBe('beta');
  });

  it.each([
    ['uma aprovada e um banco sem resposta', referenceResponse],
    ['uma aprovada e uma acima da margem', oneApprovedResponse],
    ['margem excedida', overMarginResponse],
    ['margem zero', zeroMarginResponse],
    ['todos falhando', allFailedResponse],
    ['uma aprovada e uma recusada pelo banco', betaRejectedResponse],
  ])('com menos de duas aprovadas (%s), não escolhe nenhum', (_case, response) => {
    expect(lowestInstallmentBankId(response.results)).toBeNull();
  });

  it('no empate, escolhe o primeiro', () => {
    const [alpha] = bothSuccessResponse.results;
    const tied: BankResult[] = [
      { ...alpha!, bankId: 'first' },
      { ...alpha!, bankId: 'second' },
    ];

    expect(lowestInstallmentBankId(tied)).toBe('first');
  });
});

describe('allBanksFailed', () => {
  it.each([
    ['allFailedResponse', allFailedResponse, true],
    ['referenceResponse', referenceResponse, false],
    ['bothSuccessResponse', bothSuccessResponse, false],
    ['overMarginResponse', overMarginResponse, false],
    ['allRejectedResponse', allRejectedResponse, false],
  ])('%s → %s', (_name, response, expected) => {
    expect(allBanksFailed(response.results)).toBe(expected);
  });
});
