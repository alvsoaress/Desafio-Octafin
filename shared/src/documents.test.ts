import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, normalizeCnpj, normalizeCpf } from './documents';

describe('normalizeCpf', () => {
  it('remove a máscara', () => {
    expect(normalizeCpf('381.927.465-00')).toBe('38192746500');
  });

  it('mantém o valor sem máscara', () => {
    expect(normalizeCpf('38192746500')).toBe('38192746500');
  });

  it('remove espaços nas pontas', () => {
    expect(normalizeCpf('  381.927.465-00 ')).toBe('38192746500');
  });

  it('recusa letras e outros caracteres', () => {
    expect(normalizeCpf('381.927.465-0A')).toBeNull();
    expect(normalizeCpf('381 927 465 00')).toBeNull();
  });
});

describe('isValidCpf', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(isValidCpf('381.927.465-00')).toBe(true);
    expect(isValidCpf('38192746500')).toBe(true);
  });

  it('recusa erro no primeiro dígito verificador', () => {
    expect(isValidCpf('38192746510')).toBe(false);
  });

  it('recusa erro no segundo dígito verificador', () => {
    expect(isValidCpf('38192746501')).toBe(false);
  });

  it.each(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])(
    'recusa a sequência repetida de %s',
    (digit) => {
      expect(isValidCpf(digit.repeat(11))).toBe(false);
    },
  );

  it('recusa tamanho errado', () => {
    expect(isValidCpf('3819274650')).toBe(false);
    expect(isValidCpf('381927465000')).toBe(false);
  });

  it('recusa letras e string vazia', () => {
    expect(isValidCpf('381.927.465-0A')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });
});

describe('normalizeCnpj', () => {
  it('remove a máscara', () => {
    expect(normalizeCnpj('47.182.936/0001-44')).toBe('47182936000144');
  });

  it('mantém o valor sem máscara', () => {
    expect(normalizeCnpj('47182936000144')).toBe('47182936000144');
  });

  it('recusa letras', () => {
    expect(normalizeCnpj('12.ABC.345/01DE-35')).toBeNull();
  });
});

describe('isValidCnpj', () => {
  it('aceita CNPJ válido com e sem máscara', () => {
    expect(isValidCnpj('47.182.936/0001-44')).toBe(true);
    expect(isValidCnpj('47182936000144')).toBe(true);
  });

  it('recusa erro no primeiro dígito verificador', () => {
    expect(isValidCnpj('47182936000154')).toBe(false);
  });

  it('recusa erro no segundo dígito verificador', () => {
    expect(isValidCnpj('47182936000145')).toBe(false);
  });

  it.each(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])(
    'recusa a sequência repetida de %s',
    (digit) => {
      expect(isValidCnpj(digit.repeat(14))).toBe(false);
    },
  );

  it('recusa tamanho errado', () => {
    expect(isValidCnpj('4718293600014')).toBe(false);
    expect(isValidCnpj('471829360001440')).toBe(false);
  });

  it('recusa CNPJ alfanumérico e string vazia', () => {
    expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });
});
