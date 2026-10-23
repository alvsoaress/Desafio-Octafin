import {
  bankResponded,
  type BankRejectionReason,
  type BankResult,
  type SimulationRequest,
  type SimulationResponse,
} from '@consignado/shared';
import type {
  BankAdapter,
  BankFailureStatus,
  BankQuoteRequest,
  BankQuoteResult,
} from '../domain/bank-adapter';
import { calculateMargin, calculateOffer, isConsistentInstallment } from '../domain/loan';

export type Logger = {
  info(data: Record<string, unknown>, message: string): void;
  error(data: Record<string, unknown>, message: string): void;
};

export type SimulationServiceOptions = {
  adapters: readonly BankAdapter[];
  timeoutMs: number;
  logger: Logger;
};

const bankErrorMessages: Record<BankFailureStatus, (bankName: string) => string> = {
  timeout: (bankName) => `O ${bankName} não respondeu a tempo.`,
  unavailable: (bankName) => `O ${bankName} está indisponível no momento.`,
  'invalid-response': (bankName) => `O ${bankName} devolveu uma resposta que não conseguimos ler.`,
};

export function bankErrorMessage(bankName: string, status: BankFailureStatus): string {
  return bankErrorMessages[status](bankName);
}

const bankRejectionMessages: Record<BankRejectionReason, (bankName: string) => string> = {
  'amount-above-limit': (bankName) => `O ${bankName} não aprova esse valor. Tente um valor menor.`,
  'employer-not-covered': (bankName) => `O ${bankName} não tem convênio com o seu empregador.`,
  'low-score': (bankName) => `O ${bankName} não aprovou o crédito na análise do seu CPF.`,
  other: (bankName) => `O ${bankName} recusou a proposta.`,
};

export function bankRejectionMessage(bankName: string, reason: BankRejectionReason): string {
  return bankRejectionMessages[reason](bankName);
}

export class SimulationService {
  readonly #adapters: readonly BankAdapter[];
  readonly #timeoutMs: number;
  readonly #logger: Logger;

  constructor({ adapters, timeoutMs, logger }: SimulationServiceOptions) {
    this.#adapters = adapters;
    this.#timeoutMs = timeoutMs;
    this.#logger = logger;
  }

  async simulate(request: SimulationRequest, requestId: string): Promise<SimulationResponse> {
    const margin = calculateMargin(request);
    const quoteRequest: BankQuoteRequest = {
      cpf: request.cpf,
      employerCnpj: request.employerCnpj,
      amountCents: request.requestedAmountCents,
      termMonths: request.termMonths,
    };

    const results = await Promise.all(
      this.#adapters.map(async (adapter) => {
        const quote = await this.#quoteBank(adapter, quoteRequest, requestId);

        return toBankResult(adapter, quote, quoteRequest, margin.availableCents);
      }),
    );

    return {
      requestId,
      partial: !results.every(bankResponded),
      margin,
      request: {
        requestedAmountCents: request.requestedAmountCents,
        termMonths: request.termMonths,
      },
      results,
    };
  }

  async #quoteBank(
    adapter: BankAdapter,
    request: BankQuoteRequest,
    requestId: string,
  ): Promise<BankQuoteResult> {
    const startedAt = performance.now();
    let quote: BankQuoteResult;

    try {
      quote = await this.#quoteWithTimeout(adapter, request);
    } catch (error) {
      this.#logger.error(
        {
          requestId,
          bankId: adapter.bankId,
          errorName: error instanceof Error ? error.name : typeof error,
        },
        'Falha inesperada no adaptador do banco',
      );
      quote = { status: 'unavailable' };
    }

    quote = checkBankInstallment(quote, request);

    this.#logger.info(
      {
        requestId,
        bankId: adapter.bankId,
        status: quote.status,
        durationMs: Math.round(performance.now() - startedAt),
      },
      'Consulta ao banco concluída',
    );

    return quote;
  }

  async #quoteWithTimeout(
    adapter: BankAdapter,
    request: BankQuoteRequest,
  ): Promise<BankQuoteResult> {
    const signal = AbortSignal.timeout(this.#timeoutMs);
    const timedOut = new Promise<BankQuoteResult>((resolve) => {
      signal.addEventListener('abort', () => resolve({ status: 'timeout' }), { once: true });
    });

    return await Promise.race([adapter.quote(request, signal), timedOut]);
  }
}

function checkBankInstallment(quote: BankQuoteResult, request: BankQuoteRequest): BankQuoteResult {
  if (quote.status !== 'success' || quote.installmentCents === undefined) {
    return quote;
  }

  const terms = {
    amountCents: request.amountCents,
    termMonths: request.termMonths,
    annualRate: quote.annualRate,
  };

  return isConsistentInstallment(terms, quote.installmentCents)
    ? quote
    : { status: 'invalid-response' };
}

function toBankResult(
  adapter: BankAdapter,
  quote: BankQuoteResult,
  request: BankQuoteRequest,
  availableMarginCents: number,
): BankResult {
  const identity = { bankId: adapter.bankId, bankName: adapter.bankName };

  if (quote.status === 'success') {
    return {
      ...identity,
      status: 'success',
      offer: calculateOffer({
        amountCents: request.amountCents,
        termMonths: request.termMonths,
        annualRate: quote.annualRate,
        availableMarginCents,
        bankInstallmentCents: quote.installmentCents,
      }),
    };
  }

  if (quote.status === 'rejected') {
    return {
      ...identity,
      status: 'rejected',
      rejection: {
        reason: quote.reason,
        message: bankRejectionMessage(adapter.bankName, quote.reason),
      },
    };
  }

  return {
    ...identity,
    status: quote.status,
    error: { code: quote.status, message: bankErrorMessage(adapter.bankName, quote.status) },
  };
}
