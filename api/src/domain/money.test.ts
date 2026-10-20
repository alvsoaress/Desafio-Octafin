import { describe, expect, it } from 'vitest';
import { Decimal, floorCents, formatRate, roundCentsHalfUp, roundRate } from './money';

describe('roundCentsHalfUp', () => {
  it.each([
    ['51732.5', 51733],
    ['51732.49', 51732],
    ['51732', 51732],
  ])('arredonda %s para %i', (value, expected) => {
    expect(roundCentsHalfUp(new Decimal(value))).toBe(expected);
  });

  it('devolve sempre um inteiro', () => {
    expect(Number.isInteger(roundCentsHalfUp(new Decimal('41666.666666')))).toBe(true);
  });
});

describe('floorCents', () => {
  it.each([
    ['51732.5', 51732],
    ['869852.99', 869852],
    ['35000.35', 35000],
    ['45000', 45000],
  ])('arredonda %s para baixo em %i', (value, expected) => {
    expect(floorCents(new Decimal(value))).toBe(expected);
  });

  it('devolve sempre um inteiro', () => {
    expect(Number.isInteger(floorCents(new Decimal('869852.999999')))).toBe(true);
  });
});

describe('roundRate', () => {
  it('arredonda a taxa para 6 casas com half-up', () => {
    expect(roundRate(new Decimal('0.0180875')).toString()).toBe('0.018088');
    expect(roundRate(new Decimal('0.0180874')).toString()).toBe('0.018087');
  });
});

describe('formatRate', () => {
  it.each([
    ['0.24', '0.240000'],
    ['0.215', '0.215000'],
    ['0.018088', '0.018088'],
    ['0', '0.000000'],
  ])('formata %s como %s', (rate, expected) => {
    expect(formatRate(new Decimal(rate))).toBe(expected);
  });
});
