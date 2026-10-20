import { z } from 'zod';
import type { BankAdapter, BankQuoteRequest, BankQuoteResult } from '../../domain/bank-adapter';
import { Decimal } from '../../domain/money';
import { postJson } from '../http-client';
import { toQuoteResult } from './to-quote-result';

export type AlphaAdapterOptions = {
  baseUrl: string;
};

const alphaResponseSchema = z.object({
  annualInterestRate: z.string().regex(/^-?\d+(\.\d+)?$/),
});

function readAnnualRate(body: unknown): Decimal | null {
  const result = alphaResponseSchema.safeParse(body);

  return result.success ? new Decimal(result.data.annualInterestRate) : null;
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
        amountCents: request.amountCents,
        termMonths: request.termMonths,
      },
      signal,
    );

    return toQuoteResult(result, readAnnualRate);
  }
}
