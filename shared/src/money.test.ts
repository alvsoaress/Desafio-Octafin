import { describe, expect, it } from 'vitest';
import { parseBrlToCents } from './money';

describe('parseBrlToCents', () => {
  it('converte "1.234,56" em 123456', () => {
    expect(parseBrlToCents('1.234,56')).toBe(123456);
  });

  it('soma "0,10" e "0,20" em centavos sem erro de ponto flutuante', () => {
    const tenCents = parseBrlToCents('0,10') ?? 0;
    const twentyCents = parseBrlToCents('0,20') ?? 0;

    expect(tenCents + twentyCents).toBe(30);
  });

  it.each([
    ['1234,56', 123456],
    ['1234', 123400],
    ['0,1', 10],
    ['0,00', 0],
    ['5.000,00', 500000],
    ['1.000.000,00', 100000000],
    ['R$ 1.234,56', 123456],
    ['  10.000,00  ', 1000000],
  ])('converte "%s" em %i', (input, expected) => {
    expect(parseBrlToCents(input)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'abc',
    '12a,00',
    '1,234',
    '1,2,3',
    '1.23,45',
    '1234.56',
    '-10,00',
    '99999999999999999,99',
  ])('recusa "%s"', (input) => {
    expect(parseBrlToCents(input)).toBeNull();
  });
});
