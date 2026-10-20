import type { BankResult } from '@consignado/shared';

export function lowestInstallmentBankId(results: readonly BankResult[]): string | null {
  let lowest: { bankId: string; installmentCents: number } | null = null;

  for (const result of results) {
    if (result.status !== 'success' || !result.offer.withinMargin) {
      continue;
    }

    if (!lowest || result.offer.installmentCents < lowest.installmentCents) {
      lowest = { bankId: result.bankId, installmentCents: result.offer.installmentCents };
    }
  }

  return lowest?.bankId ?? null;
}

export function allBanksFailed(results: readonly BankResult[]): boolean {
  return results.every((result) => result.status !== 'success');
}
