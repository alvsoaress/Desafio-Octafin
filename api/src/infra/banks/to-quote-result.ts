import type { BankQuoteResult } from '../../domain/bank-adapter';
import { isPlausibleAnnualRate } from '../../domain/loan';
import type { Decimal } from '../../domain/money';
import type { PostJsonResult } from '../http-client';

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

export function toQuoteResult(
  result: PostJsonResult,
  readAnnualRate: (body: unknown) => Decimal | null,
): BankQuoteResult {
  if (result.kind === 'timeout') {
    return { status: 'timeout' };
  }

  if (result.kind === 'network-error' || !isSuccessStatus(result.status)) {
    return { status: 'unavailable' };
  }

  if (result.kind === 'not-json') {
    return { status: 'invalid-response' };
  }

  const annualRate = readAnnualRate(result.body);

  if (annualRate === null || !isPlausibleAnnualRate(annualRate)) {
    return { status: 'invalid-response' };
  }

  return { status: 'success', annualRate };
}
