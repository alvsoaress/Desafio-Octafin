import { z } from 'zod';
import { isValidCnpj, isValidCpf, normalizeCnpj, normalizeCpf } from './documents';
import { validationMessages } from './messages';

const MIN_SALARY_CENTS = 1;
const MAX_SALARY_CENTS = 100_000_000;
export const MIN_REQUESTED_AMOUNT_CENTS = 50_000;
export const MAX_REQUESTED_AMOUNT_CENTS = 50_000_000;
export const MIN_TERM_MONTHS = 6;
export const MAX_TERM_MONTHS = 96;
export const MAX_NAME_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 254;

const fullNamePattern = /^\p{L}+(?:['’-]\p{L}+)*(?:\s+\p{L}+(?:['’-]\p{L}+)*)+$/u;
const emailSchema = z.email();

function typeError(issue: { input: unknown }): string {
  return issue.input === undefined ? validationMessages.required : validationMessages.invalidValue;
}

function requiredText() {
  return z
    .string({ error: typeError })
    .trim()
    .min(1, { error: validationMessages.required, abort: true });
}

function documentField(
  isValid: (value: string) => boolean,
  normalize: (value: string) => string | null,
  message: string,
) {
  return requiredText()
    .refine(isValid, { error: message })
    .transform((value) => normalize(value) ?? value);
}

const name = requiredText()
  .max(MAX_NAME_LENGTH, { error: validationMessages.name, abort: true })
  .regex(fullNamePattern, { error: validationMessages.name })
  .transform((value) => value.replace(/\s+/g, ' '));

const email = requiredText()
  .max(MAX_EMAIL_LENGTH, { error: validationMessages.email, abort: true })
  .toLowerCase()
  .refine((value) => emailSchema.safeParse(value).success, { error: validationMessages.email });

function integerField(min: number, max: number, message: string) {
  return z
    .number({ error: typeError })
    .int({ error: message })
    .min(min, { error: message })
    .max(max, { error: message });
}

const salaryCents = integerField(
  MIN_SALARY_CENTS,
  MAX_SALARY_CENTS,
  validationMessages.salaryCents,
);

const existingDeductionsCents = z
  .number({ error: typeError })
  .int({ error: validationMessages.invalidValue })
  .min(0, { error: validationMessages.invalidValue });

export const simulationRequestSchema = z
  .strictObject(
    {
      name,
      email,
      cpf: documentField(isValidCpf, normalizeCpf, validationMessages.cpf),
      employerCnpj: documentField(isValidCnpj, normalizeCnpj, validationMessages.employerCnpj),
      salaryCents,
      existingDeductionsCents,
      requestedAmountCents: integerField(
        MIN_REQUESTED_AMOUNT_CENTS,
        MAX_REQUESTED_AMOUNT_CENTS,
        validationMessages.requestedAmountCents,
      ),
      termMonths: integerField(MIN_TERM_MONTHS, MAX_TERM_MONTHS, validationMessages.termMonths),
    },
    { error: (issue) => (issue.code === 'invalid_type' ? typeError(issue) : undefined) },
  )
  .refine((request) => request.existingDeductionsCents <= request.salaryCents, {
    error: validationMessages.existingDeductionsCents,
    path: ['existingDeductionsCents'],
    when: ({ value }) => {
      if (typeof value !== 'object' || value === null) {
        return false;
      }

      const input = value as Record<string, unknown>;

      return (
        salaryCents.safeParse(input.salaryCents).success &&
        existingDeductionsCents.safeParse(input.existingDeductionsCents).success
      );
    },
  });

export type SimulationRequestInput = z.input<typeof simulationRequestSchema>;
export type SimulationRequest = z.output<typeof simulationRequestSchema>;

export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const entries =
      issue.code === 'unrecognized_keys'
        ? issue.keys.map((key) => [key, validationMessages.unknownField] as const)
        : [[String(issue.path[0] ?? 'body'), issue.message] as const];

    for (const [field, message] of entries) {
      fields[field] ??= message;
    }
  }

  return fields;
}
