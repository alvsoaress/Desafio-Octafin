import type { BankRejectionReason, BankStatus } from '@consignado/shared';
import type { Decimal } from './money';

export type BankQuoteRequest = {
  cpf: string;
  employerCnpj: string;
  amountCents: number;
  termMonths: number;
};

export type BankFailureStatus = Exclude<BankStatus, 'success' | 'rejected'>;

export type BankQuoteResult =
  | { status: Extract<BankStatus, 'success'>; annualRate: Decimal; installmentCents?: number }
  | { status: Extract<BankStatus, 'rejected'>; reason: BankRejectionReason }
  | { status: BankFailureStatus };

export interface BankAdapter {
  readonly bankId: string;
  readonly bankName: string;
  quote(request: BankQuoteRequest, signal: AbortSignal): Promise<BankQuoteResult>;
}
