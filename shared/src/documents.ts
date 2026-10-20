function normalizeDocument(value: string): string | null {
  const digits = value.trim().replace(/[.\-/]/g, '');

  return /^\d*$/.test(digits) ? digits : null;
}

export function normalizeCpf(value: string): string | null {
  return normalizeDocument(value);
}

function checkDigit(digits: string, weights: readonly number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const rest = sum % 11;

  return rest < 2 ? 0 : 11 - rest;
}

function isRepeatedDigit(digits: string): boolean {
  return /^(\d)\1*$/.test(digits);
}

const CPF_FIRST_WEIGHTS = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const CPF_SECOND_WEIGHTS = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

export function isValidCpf(value: string): boolean {
  const digits = normalizeCpf(value);

  if (digits?.length !== 11 || isRepeatedDigit(digits)) {
    return false;
  }

  return (
    checkDigit(digits, CPF_FIRST_WEIGHTS) === Number(digits[9]) &&
    checkDigit(digits, CPF_SECOND_WEIGHTS) === Number(digits[10])
  );
}

export function normalizeCnpj(value: string): string | null {
  return normalizeDocument(value);
}

const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function isValidCnpj(value: string): boolean {
  const digits = normalizeCnpj(value);

  if (digits?.length !== 14 || isRepeatedDigit(digits)) {
    return false;
  }

  return (
    checkDigit(digits, CNPJ_FIRST_WEIGHTS) === Number(digits[12]) &&
    checkDigit(digits, CNPJ_SECOND_WEIGHTS) === Number(digits[13])
  );
}
