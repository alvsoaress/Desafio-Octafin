const BRL_PATTERN = /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/;

export function parseBrlToCents(input: string): number | null {
  const match = BRL_PATTERN.exec(input.trim().replace(/^R\$\s*/, ''));

  if (!match) {
    return null;
  }

  const [, integerPart = '', decimalPart = ''] = match;
  const cents = Number(integerPart.replaceAll('.', '') + decimalPart.padEnd(2, '0'));

  return Number.isSafeInteger(cents) ? cents : null;
}
