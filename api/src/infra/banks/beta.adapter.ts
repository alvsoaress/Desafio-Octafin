import { z } from 'zod';
import type { BankAdapter, BankQuoteRequest, BankQuoteResult } from '../../domain/bank-adapter';
import { Decimal } from '../../domain/money';
import { postJson } from '../http-client';
import { toQuoteResult } from './to-quote-result';

export type BetaAdapterOptions = {
  baseUrl: string;
};

const CENTS_PER_REAL = 100;
const PERCENT = 100;

const betaResponseSchema = z.object({
  taxaAnualPercentual: z.string().regex(/^-?\d+(\.\d+)?$/),
});

function centsToReais(cents: number): string {
  return new Decimal(cents).div(CENTS_PER_REAL).toFixed(2);
}

function readAnnualRate(body: unknown): Decimal | null {
  const result = betaResponseSchema.safeParse(body);

  return result.success ? new Decimal(result.data.taxaAnualPercentual).div(PERCENT) : null;
}

export class BetaAdapter implements BankAdapter {
  readonly bankId = 'beta';
  readonly bankName = 'Banco Beta';
  readonly #url: string;

  constructor({ baseUrl }: BetaAdapterOptions) {
    this.#url = new URL('/api/simulacao', baseUrl).toString();
  }

  async quote(request: BankQuoteRequest, signal: AbortSignal): Promise<BankQuoteResult> {
    const result = await postJson(
      this.#url,
      {
        cpf: request.cpf,
        valor: centsToReais(request.amountCents),
        prazoMeses: request.termMonths,
      },
      signal,
    );

    return toQuoteResult(result, readAnnualRate);
  }
}
