import type { BankResult } from '@consignado/shared';
import { describe, expect, it } from 'vitest';
import {
  allFailedResponse,
  bothSuccessResponse,
  overMarginResponse,
  referenceResponse,
  zeroMarginResponse,
} from '../test/responses';
import { allBanksFailed, lowestInstallmentBankId } from './result';

describe('lowestInstallmentBankId', () => {
  it('escolhe a menor parcela entre as ofertas na margem', () => {
    expect(lowestInstallmentBankId(bothSuccessResponse.results)).toBe('beta');
  });

  it('ignora os bancos que falharam', () => {
    expect(lowestInstallmentBankId(referenceResponse.results)).toBe('alpha');
  });

  it.each([
    ['margem excedida', overMarginResponse],
    ['margem zero', zeroMarginResponse],
    ['todos falhando', allFailedResponse],
  ])('sem oferta na margem (%s), não escolhe nenhum', (_case, response) => {
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
  ])('%s → %s', (_name, response, expected) => {
    expect(allBanksFailed(response.results)).toBe(expected);
  });
});
