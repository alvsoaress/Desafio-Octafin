import { describe, expect, it } from 'vitest';
import { isValidCpf, normalizeCnpj, normalizeCpf } from './documents';

describe('normalizeCpf', () => {
  it('remove a máscara', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
  });

  it('mantém o valor sem máscara', () => {
    expect(normalizeCpf('52998224725')).toBe('52998224725');
  });

  it('remove espaços nas pontas', () => {
    expect(normalizeCpf('  529.982.247-25 ')).toBe('52998224725');
  });

  it('recusa letras e outros caracteres', () => {
    expect(normalizeCpf('529.982.247-2A')).toBeNull();
    expect(normalizeCpf('529 982 247 25')).toBeNull();
  });
});

describe('isValidCpf', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('recusa erro no primeiro dígito verificador', () => {
    expect(isValidCpf('52998224735')).toBe(false);
  });

  it('recusa erro no segundo dígito verificador', () => {
    expect(isValidCpf('52998224726')).toBe(false);
  });

  it.each(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])(
    'recusa a sequência repetida de %s',
    (digit) => {
      expect(isValidCpf(digit.repeat(11))).toBe(false);
    },
  );

  it('recusa tamanho errado', () => {
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCpf('529982247250')).toBe(false);
  });

  it('recusa letras e string vazia', () => {
    expect(isValidCpf('529.982.247-2A')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });
});

describe('normalizeCnpj', () => {
  it('remove a máscara', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('mantém o valor sem máscara', () => {
    expect(normalizeCnpj('11222333000181')).toBe('11222333000181');
  });

  it('recusa letras', () => {
    expect(normalizeCnpj('12.ABC.345/01DE-35')).toBeNull();
  });
});
