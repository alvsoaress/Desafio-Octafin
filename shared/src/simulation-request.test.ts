import { describe, expect, it } from 'vitest';
import { fictitiousCnpjs, fictitiousCpfs, fictitiousCustomer } from './fixtures';
import { validationMessages } from './messages';
import { simulationRequestSchema, toFieldErrors } from './simulation-request';

const validRequest = {
  name: fictitiousCustomer.name,
  email: fictitiousCustomer.email,
  cpf: fictitiousCpfs[0].digits,
  employerCnpj: fictitiousCnpjs[0].digits,
  salaryCents: 500000,
  existingDeductionsCents: 50000,
  requestedAmountCents: 1000000,
  termMonths: 24,
};

function fieldErrors(overrides: Record<string, unknown>): Record<string, string> {
  const result = simulationRequestSchema.safeParse({ ...validRequest, ...overrides });

  return result.success ? {} : toFieldErrors(result.error);
}

function without(field: keyof typeof validRequest): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...validRequest };
  delete rest[field];

  return rest;
}

describe('simulationRequestSchema', () => {
  it('aceita o exemplo de referência', () => {
    expect(simulationRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it('recusa campo desconhecido', () => {
    expect(fieldErrors({ interestRate: '0.01' })).toEqual({
      interestRate: validationMessages.unknownField,
    });
  });

  describe('name', () => {
    it.each(["Ana D'Ávila", 'João Pedro Albuquerque-Lins', 'Zoë Ng'])('aceita "%s"', (name) => {
      expect(fieldErrors({ name })).toEqual({});
    });

    it('apara as pontas e junta os espaços internos', () => {
      expect(
        simulationRequestSchema.parse({ ...validRequest, name: '  Maria   da  Silva ' }).name,
      ).toBe('Maria da Silva');
    });

    it.each([
      'Maria',
      'Maria 2 Silva',
      'Maria  ',
      'Maria @Silva',
      `${'a'.repeat(60)} ${'b'.repeat(60)}`,
    ])('recusa "%s" pedindo o nome completo', (name) => {
      expect(fieldErrors({ name })).toEqual({ name: validationMessages.name });
    });

    it('recusa ausente e vazio como obrigatórios', () => {
      expect(fieldErrors({ name: '   ' })).toEqual({ name: validationMessages.required });

      const result = simulationRequestSchema.safeParse(without('name'));

      expect(result.success ? {} : toFieldErrors(result.error)).toEqual({
        name: validationMessages.required,
      });
    });
  });

  describe('email', () => {
    it('apara e converte para minúsculas', () => {
      expect(
        simulationRequestSchema.parse({ ...validRequest, email: ' Maria.Silva@Example.COM ' })
          .email,
      ).toBe('maria.silva@example.com');
    });

    it.each([
      'maria',
      'maria@',
      '@example.com',
      'maria silva@example.com',
      `${'a'.repeat(250)}@x.com`,
    ])('recusa "%s"', (email) => {
      expect(fieldErrors({ email })).toEqual({ email: validationMessages.email });
    });

    it('recusa ausente e vazio como obrigatórios', () => {
      expect(fieldErrors({ email: '' })).toEqual({ email: validationMessages.required });

      const result = simulationRequestSchema.safeParse(without('email'));

      expect(result.success ? {} : toFieldErrors(result.error)).toEqual({
        email: validationMessages.required,
      });
    });
  });

  describe.each([
    ['cpf', fictitiousCpfs[0], validationMessages.cpf, '38192746501'],
    ['employerCnpj', fictitiousCnpjs[0], validationMessages.employerCnpj, '47182936000145'],
  ] as const)('%s', (field, document, message, wrongCheckDigit) => {
    it('normaliza o valor com máscara', () => {
      const parsed = simulationRequestSchema.parse({ ...validRequest, [field]: document.masked });

      expect(parsed[field]).toBe(document.digits);
    });

    it('recusa dígito verificador errado com a mensagem da RF-02', () => {
      expect(fieldErrors({ [field]: wrongCheckDigit })).toEqual({ [field]: message });
    });

    it('recusa campo ausente e texto vazio como obrigatórios', () => {
      const result = simulationRequestSchema.safeParse(without(field));

      expect(result.success ? {} : toFieldErrors(result.error)).toEqual({
        [field]: validationMessages.required,
      });
      expect(fieldErrors({ [field]: '   ' })).toEqual({ [field]: validationMessages.required });
    });

    it('recusa valor que não é texto', () => {
      expect(fieldErrors({ [field]: 123 })).toEqual({ [field]: validationMessages.invalidValue });
    });
  });

  describe('salaryCents', () => {
    it.each([1, 100000000])('aceita %i', (salaryCents) => {
      expect(fieldErrors({ salaryCents, existingDeductionsCents: 0 })).toEqual({});
    });

    it.each([0, 100000001, 5000.5])('recusa %d com a mensagem da RF-02', (salaryCents) => {
      expect(fieldErrors({ salaryCents })).toEqual({ salaryCents: validationMessages.salaryCents });
    });

    it.each(['5000', Number.NaN, Number.POSITIVE_INFINITY, null])(
      'recusa %s como valor inválido',
      (salaryCents) => {
        expect(fieldErrors({ salaryCents })).toEqual({
          salaryCents: validationMessages.invalidValue,
        });
      },
    );

    it('recusa campo ausente como obrigatório', () => {
      const result = simulationRequestSchema.safeParse(without('salaryCents'));

      expect(result.success ? {} : toFieldErrors(result.error)).toEqual({
        salaryCents: validationMessages.required,
      });
    });
  });

  describe('existingDeductionsCents', () => {
    it('aceita zero e o valor igual ao salário', () => {
      expect(fieldErrors({ existingDeductionsCents: 0 })).toEqual({});
      expect(fieldErrors({ existingDeductionsCents: 500000 })).toEqual({});
    });

    it('recusa descontos maiores que o salário', () => {
      expect(fieldErrors({ existingDeductionsCents: 500001 })).toEqual({
        existingDeductionsCents: validationMessages.existingDeductionsCents,
      });
    });

    it('recusa negativo como valor inválido', () => {
      expect(fieldErrors({ existingDeductionsCents: -1 })).toEqual({
        existingDeductionsCents: validationMessages.invalidValue,
      });
    });

    it('não compara com o salário quando o salário é inválido', () => {
      expect(fieldErrors({ salaryCents: 0, existingDeductionsCents: 50000 })).toEqual({
        salaryCents: validationMessages.salaryCents,
      });
    });

    it('compara com o salário mesmo com outro campo inválido', () => {
      expect(fieldErrors({ cpf: '38192746501', existingDeductionsCents: 500001 })).toEqual({
        cpf: validationMessages.cpf,
        existingDeductionsCents: validationMessages.existingDeductionsCents,
      });
    });
  });

  describe('requestedAmountCents', () => {
    it.each([50000, 50000000])('aceita o limite %i', (requestedAmountCents) => {
      expect(fieldErrors({ requestedAmountCents })).toEqual({});
    });

    it.each([49999, 50000001])('recusa %i', (requestedAmountCents) => {
      expect(fieldErrors({ requestedAmountCents })).toEqual({
        requestedAmountCents: validationMessages.requestedAmountCents,
      });
    });
  });

  describe('termMonths', () => {
    it.each([6, 96])('aceita %i', (termMonths) => {
      expect(fieldErrors({ termMonths })).toEqual({});
    });

    it.each([5, 97, 24.5])('recusa %d com a mensagem da RF-02', (termMonths) => {
      expect(fieldErrors({ termMonths })).toEqual({ termMonths: validationMessages.termMonths });
    });

    it('recusa texto como valor inválido', () => {
      expect(fieldErrors({ termMonths: '24' })).toEqual({
        termMonths: validationMessages.invalidValue,
      });
    });
  });
});

describe('toFieldErrors', () => {
  it('devolve uma mensagem por campo, inclusive para campo desconhecido', () => {
    expect(
      fieldErrors({ cpf: '', salaryCents: 0, termMonths: 120, extra: true, other: 1 }),
    ).toEqual({
      cpf: validationMessages.required,
      salaryCents: validationMessages.salaryCents,
      termMonths: validationMessages.termMonths,
      extra: validationMessages.unknownField,
      other: validationMessages.unknownField,
    });
  });

  it.each([[[]], [null], ['texto'], [42]])(
    'usa a chave body quando o corpo é %j, sem lançar erro',
    (body) => {
      const result = simulationRequestSchema.safeParse(body);

      expect(result.success ? {} : toFieldErrors(result.error)).toEqual({
        body: validationMessages.invalidValue,
      });
    },
  );

  it('usa a chave body com "Campo obrigatório." quando não há corpo', () => {
    const result = simulationRequestSchema.safeParse(undefined);

    expect(result.success ? {} : toFieldErrors(result.error)).toEqual({
      body: validationMessages.required,
    });
  });
});
