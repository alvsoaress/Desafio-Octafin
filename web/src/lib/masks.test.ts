import { parseBrlToCents } from '@consignado/shared';
import { describe, expect, it } from 'vitest';
import { maskBrl, maskCnpj, maskCpf, maskDigits } from './masks';

describe('maskDigits', () => {
  it('mantém só os dígitos, cortados no tamanho', () => {
    expect(maskDigits('9a7', 2)).toBe('97');
    expect(maskDigits('123', 2)).toBe('12');
    expect(maskDigits('abc', 2)).toBe('');
  });
});

describe('maskCpf', () => {
  it.each([
    ['38192746500', '381.927.465-00'],
    ['3819', '381.9'],
    ['381', '381'],
    ['3819274', '381.927.4'],
    ['3819274650', '381.927.465-0'],
    ['381927465001234', '381.927.465-00'],
    ['381.927.465-00', '381.927.465-00'],
    ['', ''],
  ])('mascara "%s" como "%s"', (input, expected) => {
    expect(maskCpf(input)).toBe(expected);
  });
});

describe('maskCnpj', () => {
  it.each([
    ['47182936000144', '47.182.936/0001-44'],
    ['4718', '47.18'],
    ['47', '47'],
    ['47182936', '47.182.936'],
    ['471829360001', '47.182.936/0001'],
    ['4718293600014499', '47.182.936/0001-44'],
    ['47.182.936/0001-44', '47.182.936/0001-44'],
  ])('mascara "%s" como "%s"', (input, expected) => {
    expect(maskCnpj(input)).toBe(expected);
  });
});

describe('maskBrl', () => {
  it.each([
    ['', ''],
    ['5', '0,05'],
    ['50', '0,50'],
    ['500', '5,00'],
    ['000', '0,00'],
    ['0001', '0,01'],
    ['123456', '1.234,56'],
    ['100000000', '1.000.000,00'],
    ['R$ 1.234,56', '1.234,56'],
    ['99999999999', '999.999.999,99'],
    ['123456789012', '123.456.789,01'],
  ])('mascara "%s" como "%s"', (input, expected) => {
    expect(maskBrl(input)).toBe(expected);
  });

  it.each(['5', '123456', '000', '100000000', '99999999999'])(
    'a saída de "%s" volta aos mesmos centavos pela parseBrlToCents',
    (digits) => {
      expect(parseBrlToCents(maskBrl(digits))).toBe(Number(digits));
    },
  );
});
