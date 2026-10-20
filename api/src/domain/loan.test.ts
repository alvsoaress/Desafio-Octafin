import { describe, expect, it } from 'vitest';
import {
  CONSIGNABLE_MARGIN_RATE,
  calculateInstallmentCents,
  calculateMargin,
  calculateMaxFinanceableCents,
  toMonthlyRate,
} from './loan';
import { Decimal } from './money';

describe('calculateMargin', () => {
  it('usa 35% do salário como margem consignável', () => {
    expect(CONSIGNABLE_MARGIN_RATE.toString()).toBe('0.35');
  });

  it('dá margem disponível de 125000 para salário de 500000 e descontos de 50000', () => {
    expect(calculateMargin({ salaryCents: 500000, existingDeductionsCents: 50000 })).toEqual({
      consignableCents: 175000,
      availableCents: 125000,
    });
  });

  it('dá margem disponível zero quando os descontos passam de 35% do salário', () => {
    expect(
      calculateMargin({ salaryCents: 500000, existingDeductionsCents: 200000 }).availableCents,
    ).toBe(0);
  });

  it('dá margem disponível zero quando os descontos são iguais à margem consignável', () => {
    expect(
      calculateMargin({ salaryCents: 500000, existingDeductionsCents: 175000 }).availableCents,
    ).toBe(0);
  });

  it('arredonda a margem consignável para baixo no centavo', () => {
    expect(
      calculateMargin({ salaryCents: 100001, existingDeductionsCents: 0 }).consignableCents,
    ).toBe(35000);
  });
});

describe('toMonthlyRate', () => {
  it('converte 24% a.a. em 0.018088 a.m. pela taxa composta, e não em 0.02', () => {
    const monthlyRate = toMonthlyRate(new Decimal('0.24'));

    expect(monthlyRate.toString()).toBe('0.018088');
    expect(monthlyRate.equals(new Decimal('0.02'))).toBe(false);
  });

  it('converte 21,5% a.a. em 0.016361 a.m.', () => {
    expect(toMonthlyRate(new Decimal('0.215')).toString()).toBe('0.016361');
  });

  it('mantém a taxa zero', () => {
    expect(toMonthlyRate(new Decimal(0)).isZero()).toBe(true);
  });
});

describe('calculateInstallmentCents', () => {
  it('dá parcela de 51733 para 1000000 em 24 meses a 0.018088 a.m.', () => {
    expect(calculateInstallmentCents(1000000, new Decimal('0.018088'), 24)).toBe(51733);
  });

  it('não chega à parcela de 52871 que a taxa anual dividida por 12 daria', () => {
    const annualRate = new Decimal('0.24');

    expect(calculateInstallmentCents(1000000, annualRate.div(12), 24)).toBe(52871);
    expect(calculateInstallmentCents(1000000, toMonthlyRate(annualRate), 24)).not.toBe(52871);
  });

  it('divide o valor pelo prazo quando a taxa é zero', () => {
    const installmentCents = calculateInstallmentCents(1000000, new Decimal(0), 24);

    expect(installmentCents).toBe(41667);
    expect(Number.isFinite(installmentCents)).toBe(true);
  });
});

describe('calculateMaxFinanceableCents', () => {
  const monthlyRate = new Decimal('0.018088');

  it('dá 869852 para parcela de 45000 em 24 meses a 0.018088 a.m.', () => {
    expect(calculateMaxFinanceableCents(45000, monthlyRate, 24)).toBe(869852);
  });

  it('não deixa a parcela do valor financiável passar da parcela máxima', () => {
    const maxFinanceableCents = calculateMaxFinanceableCents(45000, monthlyRate, 24);

    expect(calculateInstallmentCents(maxFinanceableCents, monthlyRate, 24)).toBeLessThanOrEqual(
      45000,
    );
  });

  it('dá zero quando a parcela máxima é zero', () => {
    expect(calculateMaxFinanceableCents(0, monthlyRate, 24)).toBe(0);
  });

  it('multiplica a parcela pelo prazo quando a taxa é zero', () => {
    expect(calculateMaxFinanceableCents(45000, new Decimal(0), 24)).toBe(1080000);
  });
});
