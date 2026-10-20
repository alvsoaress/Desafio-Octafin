import { Decimal, floorCents, roundCentsHalfUp, roundRate } from './money';

export const CONSIGNABLE_MARGIN_RATE = new Decimal('0.35');

const MONTHS_PER_YEAR = 12;

export type MarginInput = {
  salaryCents: number;
  existingDeductionsCents: number;
};

export type Margin = {
  consignableCents: number;
  availableCents: number;
};

export function calculateMargin({ salaryCents, existingDeductionsCents }: MarginInput): Margin {
  const consignableCents = floorCents(new Decimal(salaryCents).times(CONSIGNABLE_MARGIN_RATE));

  return {
    consignableCents,
    availableCents: Math.max(0, consignableCents - existingDeductionsCents),
  };
}

export function toMonthlyRate(annualRate: Decimal): Decimal {
  return roundRate(annualRate.plus(1).pow(new Decimal(1).div(MONTHS_PER_YEAR)).minus(1));
}

function presentValueFactor(monthlyRate: Decimal, termMonths: number): Decimal {
  return new Decimal(1).minus(monthlyRate.plus(1).pow(-termMonths));
}

export function calculateInstallmentCents(
  principalCents: number,
  monthlyRate: Decimal,
  termMonths: number,
): number {
  const principal = new Decimal(principalCents);

  if (monthlyRate.isZero()) {
    return roundCentsHalfUp(principal.div(termMonths));
  }

  return roundCentsHalfUp(
    principal.times(monthlyRate).div(presentValueFactor(monthlyRate, termMonths)),
  );
}

export function calculateMaxFinanceableCents(
  installmentCents: number,
  monthlyRate: Decimal,
  termMonths: number,
): number {
  const installment = new Decimal(installmentCents);

  if (monthlyRate.isZero()) {
    return floorCents(installment.times(termMonths));
  }

  return floorCents(
    installment.times(presentValueFactor(monthlyRate, termMonths)).div(monthlyRate),
  );
}
