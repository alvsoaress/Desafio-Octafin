import {
  parseBrlToCents,
  simulationRequestSchema,
  toFieldErrors,
  type SimulationRequest,
} from '@consignado/shared';

export type FormValues = {
  name: string;
  email: string;
  cpf: string;
  employerCnpj: string;
  salary: string;
  existingDeductions: string;
  requestedAmount: string;
  termMonths: string;
};

export type FormField = keyof FormValues;

export type FormErrors = Partial<Record<FormField, string>>;

export const emptyFormValues: FormValues = {
  name: '',
  email: '',
  cpf: '',
  employerCnpj: '',
  salary: '',
  existingDeductions: '',
  requestedAmount: '',
  termMonths: '',
};

const requestFieldToFormField: Record<string, FormField> = {
  name: 'name',
  email: 'email',
  cpf: 'cpf',
  employerCnpj: 'employerCnpj',
  salaryCents: 'salary',
  existingDeductionsCents: 'existingDeductions',
  requestedAmountCents: 'requestedAmount',
  termMonths: 'termMonths',
};

export type FormValidation =
  { success: true; data: SimulationRequest } | { success: false; errors: FormErrors };

function toCents(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }

  return parseBrlToCents(value) ?? Number.NaN;
}

function toInteger(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

export function toFormErrors(fields: Record<string, string>): FormErrors {
  const errors: FormErrors = {};

  for (const [field, message] of Object.entries(fields)) {
    const formField = requestFieldToFormField[field];

    if (formField) {
      errors[formField] = message;
    }
  }

  return errors;
}

export function validateForm(values: FormValues): FormValidation {
  const result = simulationRequestSchema.safeParse({
    name: values.name,
    email: values.email,
    cpf: values.cpf,
    employerCnpj: values.employerCnpj,
    salaryCents: toCents(values.salary),
    existingDeductionsCents: toCents(values.existingDeductions),
    requestedAmountCents: toCents(values.requestedAmount),
    termMonths: toInteger(values.termMonths),
  });

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: toFormErrors(toFieldErrors(result.error)) };
}
