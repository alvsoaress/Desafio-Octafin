import type { BankRejectionReason } from '@consignado/shared';
import { z } from 'zod';
import type { BankAdapter, BankQuoteRequest, BankQuoteResult } from '../../domain/bank-adapter';
import { Decimal } from '../../domain/money';
import { postJson } from '../http-client';
import { toQuoteResult, type BankReply } from './to-quote-result';

export type BetaAdapterOptions = {
  baseUrl: string;
};

const CENTS_PER_REAL = 100;
const PERCENT = 100;

const HTTP_OK = 200;
const HTTP_UNPROCESSABLE = 422;

const betaQuoteSchema = z.object({
  taxaAnualPercentual: z.string().regex(/^-?\d+(\.\d+)?$/),
  valorParcela: z.string().regex(/^\d+\.\d{2}$/),
});

const betaRefusalSchema = z.object({
  erro: z.string(),
});

const betaReasons = new Map<string, BankRejectionReason>([
  ['empregador_sem_convenio', 'employer-not-covered'],
  ['score_insuficiente', 'low-score'],
]);

function centsToReais(cents: number): string {
  return new Decimal(cents).div(CENTS_PER_REAL).toFixed(2);
}

function reaisToCents(reais: string): number {
  return new Decimal(reais).times(CENTS_PER_REAL).toNumber();
}

function readReply({ status, body }: BankReply): BankQuoteResult | null {
  if (status === HTTP_UNPROCESSABLE) {
    const refusal = betaRefusalSchema.safeParse(body);

    return refusal.success
      ? { status: 'rejected', reason: betaReasons.get(refusal.data.erro) ?? 'other' }
      : null;
  }

  const quote = betaQuoteSchema.safeParse(body);

  if (status !== HTTP_OK || !quote.success) {
    return null;
  }

  return {
    status: 'success',
    annualRate: new Decimal(quote.data.taxaAnualPercentual).div(PERCENT),
    installmentCents: reaisToCents(quote.data.valorParcela),
  };
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
        cnpjEmpregador: request.employerCnpj,
        valor: centsToReais(request.amountCents),
        prazoMeses: request.termMonths,
      },
      signal,
    );

    return toQuoteResult(result, readReply);
  }
}
