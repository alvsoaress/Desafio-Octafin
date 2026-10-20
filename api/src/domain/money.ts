import { Decimal as BaseDecimal } from 'decimal.js';

export const Decimal = BaseDecimal.clone({ precision: 40 });
export type Decimal = BaseDecimal;

const RATE_DECIMAL_PLACES = 6;

export function roundCentsHalfUp(value: Decimal): number {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function floorCents(value: Decimal): number {
  return value.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber();
}

export function roundRate(rate: Decimal): Decimal {
  return rate.toDecimalPlaces(RATE_DECIMAL_PLACES, Decimal.ROUND_HALF_UP);
}

export function formatRate(rate: Decimal): string {
  return rate.toFixed(RATE_DECIMAL_PLACES, Decimal.ROUND_HALF_UP);
}
