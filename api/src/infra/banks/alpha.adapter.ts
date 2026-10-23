import type { BankRejectionReason } from '@consignado/shared';
import { z } from 'zod';
import type { BankAdapter, BankQuoteRequest, BankQuoteResult } from '../../domain/bank-adapter';
import { Decimal } from '../../domain/money';
import { postJson } from '../http-client';
import { toQuoteResult, type BankReply } from './to-quote-result';

export type AlphaAdapterOptions = {
  baseUrl: string;
};

const rateText = z.string().regex(/^-?\d+(\.\d+)?$/);

const alphaResponseSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approved'), annualInterestRate: rateText }),
  z.object({ decision: z.literal('declined'), reasonCode: z.string() }),
]);

const alphaReasons = new Map<string, BankRejectionReason>([
  ['AMOUNT_ABOVE_LIMIT', 'amount-above-limit'],
  ['EMPLOYER_NOT_COVERED', 'employer-not-covered'],
]);

function readReply({ status, body }: BankReply): BankQuoteResult | null {
  const result = alphaResponseSchema.safeParse(body);

  if (status !== 200 || !result.success) {
    return null;
  }

  if (result.data.decision === 'declined') {
    return { status: 'rejected', reason: alphaReasons.get(result.data.reasonCode) ?? 'other' };
  }

  return { status: 'success', annualRate: new Decimal(result.data.annualInterestRate) };
}

export class AlphaAdapter implements BankAdapter {
  readonly bankId = 'alpha';
  readonly bankName = 'Banco Alpha';
  readonly #url: string;

  constructor({ baseUrl }: AlphaAdapterOptions) {
    this.#url = new URL('/v1/loan-quotes', baseUrl).toString();
  }

  async quote(request: BankQuoteRequest, signal: AbortSignal): Promise<BankQuoteResult> {
    const result = await postJson(
      this.#url,
      {
        document: request.cpf,
        employerDocument: request.employerCnpj,
        amountCents: request.amountCents,
        termMonths: request.termMonths,
      },
      signal,
    );

    return toQuoteResult(result, readReply);
  }
}
