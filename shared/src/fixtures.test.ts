import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, normalizeCnpj, normalizeCpf } from './documents';
import { fictitiousCnpjs, fictitiousCpfs } from './fixtures';

describe('fixtures', () => {
  it.each(fictitiousCpfs)('o CPF $masked é válido e corresponde aos dígitos', (cpf) => {
    expect(isValidCpf(cpf.digits)).toBe(true);
    expect(normalizeCpf(cpf.masked)).toBe(cpf.digits);
  });

  it.each(fictitiousCnpjs)('o CNPJ $masked é válido e corresponde aos dígitos', (cnpj) => {
    expect(isValidCnpj(cnpj.digits)).toBe(true);
    expect(normalizeCnpj(cnpj.masked)).toBe(cnpj.digits);
  });
});
