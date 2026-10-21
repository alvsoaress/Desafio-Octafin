import type { BankResult } from '@consignado/shared';

export type BankOutcome = 'approved' | 'rejected' | 'no-response';

export function bankOutcome(result: BankResult): BankOutcome {
  if (result.status !== 'success') {
    return 'no-response';
  }

  return result.offer.withinMargin ? 'approved' : 'rejected';
}

export function lowestInstallmentBankId(results: readonly BankResult[]): string | null {
  const approved = results.filter(
    (result): result is Extract<BankResult, { status: 'success' }> =>
      bankOutcome(result) === 'approved',
  );

  if (approved.length < 2) {
    return null;
  }

  let lowest = approved[0]!;

  for (const result of approved) {
    if (result.offer.installmentCents < lowest.offer.installmentCents) {
      lowest = result;
    }
  }

  return lowest.bankId;
}

export function allBanksFailed(results: readonly BankResult[]): boolean {
  return results.every((result) => result.status !== 'success');
}
