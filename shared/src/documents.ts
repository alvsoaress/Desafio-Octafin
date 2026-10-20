function normalizeDocument(value: string): string | null {
  const digits = value.trim().replace(/[.\-/]/g, '');

  return /^\d*$/.test(digits) ? digits : null;
}

export function normalizeCpf(value: string): string | null {
  return normalizeDocument(value);
}

export function normalizeCnpj(value: string): string | null {
  return normalizeDocument(value);
}
