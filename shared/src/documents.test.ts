import { describe, expect, it } from 'vitest';
import { normalizeCnpj, normalizeCpf } from './documents';

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
