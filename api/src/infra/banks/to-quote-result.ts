import type { BankQuoteResult } from '../../domain/bank-adapter';
import { isPlausibleAnnualRate } from '../../domain/loan';
import type { PostJsonResult } from '../http-client';

export type BankReply = {
  status: number;
  body: unknown;
};

export type ReadReply = (reply: BankReply) => BankQuoteResult | null;

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function unreadable(status: number): BankQuoteResult {
  return isSuccessStatus(status) ? { status: 'invalid-response' } : { status: 'unavailable' };
}

export function toQuoteResult(result: PostJsonResult, readReply: ReadReply): BankQuoteResult {
  if (result.kind === 'timeout') {
    return { status: 'timeout' };
  }

  if (result.kind === 'network-error') {
    return { status: 'unavailable' };
  }

  if (result.kind === 'not-json') {
    return unreadable(result.status);
  }

  const quote = readReply({ status: result.status, body: result.body });

  if (quote === null) {
    return unreadable(result.status);
  }

  if (quote.status === 'success' && !isPlausibleAnnualRate(quote.annualRate)) {
    return { status: 'invalid-response' };
  }

  return quote;
}
