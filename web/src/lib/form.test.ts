import { validationMessages } from '@consignado/shared';
import { fictitiousCnpjs, fictitiousCpfs } from '@consignado/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { toFormErrors, validateForm, type FormValues } from './form';

const [cpf] = fictitiousCpfs;
const [cnpj] = fictitiousCnpjs;

const referenceValues: FormValues = {
  cpf: cpf.masked,
  employerCnpj: cnpj.masked,
  salary: '5.000,00',
  existingDeductions: '500,00',
  requestedAmount: '10.000,00',
  termMonths: '24',
};

function errorsFor(overrides: Partial<FormValues>) {
  const result = validateForm({ ...referenceValues, ...overrides });

  if (result.success) {
    throw new Error('Esperava erro de validação.');
  }

  return result.errors;
}

describe('validateForm', () => {
  it('converte o exemplo de referência na requisição em centavos', () => {
    expect(validateForm(referenceValues)).toEqual({
      success: true,
      data: {
        cpf: cpf.digits,
        employerCnpj: cnpj.digits,
        salaryCents: 500000,
        existingDeductionsCents: 50000,
        requestedAmountCents: 1000000,
        termMonths: 24,
      },
    });
  });

  it('converte "1.234,56" em 123456', () => {
    const result = validateForm({ ...referenceValues, existingDeductions: '1.234,56' });

    expect(result.success && result.data.existingDeductionsCents).toBe(123456);
  });

  it('converte "0,10" e "0,20" em centavos que somam 30', () => {
    const tenCents = validateForm({ ...referenceValues, existingDeductions: '0,10' });
    const twentyCents = validateForm({ ...referenceValues, existingDeductions: '0,20' });

    if (!tenCents.success || !twentyCents.success) {
      throw new Error('Esperava valores válidos.');
    }

    expect(tenCents.data.existingDeductionsCents).toBe(10);
    expect(twentyCents.data.existingDeductionsCents).toBe(20);
    expect(tenCents.data.existingDeductionsCents + twentyCents.data.existingDeductionsCents).toBe(
      30,
    );
  });

  it('aceita descontos zerados', () => {
    expect(validateForm({ ...referenceValues, existingDeductions: '0,00' }).success).toBe(true);
  });

  it.each([
    ['salary', '', validationMessages.required],
    ['salary', '0,00', validationMessages.salaryCents],
    ['existingDeductions', '', validationMessages.required],
    ['existingDeductions', '5.000,01', validationMessages.existingDeductionsCents],
    ['requestedAmount', '499,99', validationMessages.requestedAmountCents],
    ['requestedAmount', '500.000,01', validationMessages.requestedAmountCents],
    ['termMonths', '', validationMessages.required],
    ['termMonths', '5', validationMessages.termMonths],
    ['termMonths', '97', validationMessages.termMonths],
    ['cpf', '', validationMessages.required],
    ['cpf', '381.927.465-01', validationMessages.cpf],
    ['employerCnpj', '11.111.111/1111-11', validationMessages.employerCnpj],
    ['salary', 'abc', validationMessages.invalidValue],
  ] as const)('com %s "%s" dá "%s"', (field, value, message) => {
    expect(errorsFor({ [field]: value })).toEqual({ [field]: message });
  });
});

describe('toFormErrors', () => {
  it('traduz os campos da API para os do formulário e ignora os desconhecidos', () => {
    expect(
      toFormErrors({
        cpf: validationMessages.cpf,
        salaryCents: validationMessages.salaryCents,
        existingDeductionsCents: validationMessages.existingDeductionsCents,
        requestedAmountCents: validationMessages.requestedAmountCents,
        termMonths: validationMessages.termMonths,
        body: validationMessages.required,
      }),
    ).toEqual({
      cpf: validationMessages.cpf,
      salary: validationMessages.salaryCents,
      existingDeductions: validationMessages.existingDeductionsCents,
      requestedAmount: validationMessages.requestedAmountCents,
      termMonths: validationMessages.termMonths,
    });
  });
});
