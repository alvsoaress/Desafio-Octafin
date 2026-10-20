import { groupThousands } from './masks';

const RATE_SCALE_DIGITS = 6;
const MONTHLY_PERCENT_DIGITS = 4;
const ANNUAL_PERCENT_DIGITS = 2;

function formatFixed(units: number, fractionDigits: number): string {
  const digits = String(units).padStart(fractionDigits + 1, '0');

  return `${groupThousands(digits.slice(0, -fractionDigits))},${digits.slice(-fractionDigits)}`;
}

function roundHalfUp(units: number, divisor: number): number {
  const shifted = units + divisor / 2;

  return (shifted - (shifted % divisor)) / divisor;
}

function rateToPercentUnits(rate: string, fractionDigits: number): number {
  const [integerPart = '0', fractionPart = ''] = rate.split('.');
  const millionths = Number(integerPart + fractionPart.padEnd(RATE_SCALE_DIGITS, '0'));
  const percentDigits = RATE_SCALE_DIGITS - 2;

  return roundHalfUp(millionths, 10 ** (percentDigits - fractionDigits));
}

export function formatCents(cents: number): string {
  return `R$ ${formatFixed(cents, 2)}`;
}

export function formatMonthlyRate(rate: string): string {
  return `${formatFixed(rateToPercentUnits(rate, MONTHLY_PERCENT_DIGITS), MONTHLY_PERCENT_DIGITS)}% a.m.`;
}

export function formatAnnualRate(rate: string): string {
  return `${formatFixed(rateToPercentUnits(rate, ANNUAL_PERCENT_DIGITS), ANNUAL_PERCENT_DIGITS)}% a.a.`;
}
