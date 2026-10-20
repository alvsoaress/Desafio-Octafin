const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;
const BRL_MAX_DIGITS = 11;

export function maskDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function applyPattern(digits: string, separators: Record<number, string>): string {
  let masked = '';

  for (const [index, digit] of [...digits].entries()) {
    masked += (index > 0 ? (separators[index] ?? '') : '') + digit;
  }

  return masked;
}

export function maskCpf(value: string): string {
  return applyPattern(maskDigits(value, CPF_LENGTH), { 3: '.', 6: '.', 9: '-' });
}

export function maskCnpj(value: string): string {
  return applyPattern(maskDigits(value, CNPJ_LENGTH), { 2: '.', 5: '.', 8: '/', 12: '-' });
}

export function groupThousands(integerDigits: string): string {
  return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function maskBrl(value: string): string {
  const digits = maskDigits(value, BRL_MAX_DIGITS);

  if (digits === '') {
    return '';
  }

  const padded = digits.padStart(3, '0');
  const integerPart = padded.slice(0, -2).replace(/^0+(?=\d)/, '');

  return `${groupThousands(integerPart)},${padded.slice(-2)}`;
}
