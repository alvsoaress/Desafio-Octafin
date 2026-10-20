import type { BankStatus } from '@consignado/shared';
import type { Decimal } from './money';

export type BankQuoteRequest = {
  cpf: string;
  amountCents: number;
  termMonths: number;
};

export type BankFailureStatus = Exclude<BankStatus, 'success'>;

export type BankQuoteResult =
  { status: Extract<BankStatus, 'success'>; annualRate: Decimal } | { status: BankFailureStatus };

export interface BankAdapter {
  readonly bankId: string;
  readonly bankName: string;
  quote(request: BankQuoteRequest, signal: AbortSignal): Promise<BankQuoteResult>;
}
