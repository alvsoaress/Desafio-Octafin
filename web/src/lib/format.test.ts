import { describe, expect, it } from 'vitest';
import { formatAnnualRate, formatCents, formatMonthlyRate } from './format';

describe('formatCents', () => {
  it.each([
    [51733, 'R$ 517,33'],
    [869852, 'R$ 8.698,52'],
    [1241592, 'R$ 12.415,92'],
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [100, 'R$ 1,00'],
    [100000000, 'R$ 1.000.000,00'],
  ])('formata %i como "%s"', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it('usa espaço comum depois de R$', () => {
    expect(formatCents(51733)).not.toContain(' ');
  });
});

describe('formatMonthlyRate', () => {
  it.each([
    ['0.018088', '1,8088% a.m.'],
    ['0.016349', '1,6349% a.m.'],
    ['0.000000', '0,0000% a.m.'],
    ['0.200000', '20,0000% a.m.'],
  ])('formata "%s" como "%s"', (rate, expected) => {
    expect(formatMonthlyRate(rate)).toBe(expected);
  });
});

describe('formatAnnualRate', () => {
  it.each([
    ['0.240000', '24,00% a.a.'],
    ['0.215000', '21,50% a.a.'],
    ['0.123455', '12,35% a.a.'],
    ['0.123449', '12,34% a.a.'],
    ['0.000000', '0,00% a.a.'],
    ['10.000000', '1.000,00% a.a.'],
  ])('formata "%s" como "%s"', (rate, expected) => {
    expect(formatAnnualRate(rate)).toBe(expected);
  });
});
