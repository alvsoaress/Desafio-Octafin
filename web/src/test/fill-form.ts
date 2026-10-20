import { fictitiousCnpjs, fictitiousCpfs } from '@consignado/shared/fixtures';
import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

const [cpf] = fictitiousCpfs;
const [cnpj] = fictitiousCnpjs;

export const referenceFormInput = {
  CPF: cpf.digits,
  'CNPJ do empregador': cnpj.digits,
  'Salário bruto mensal': '500000',
  'Descontos consignados existentes': '50000',
  'Valor desejado': '1000000',
  'Prazo (meses)': '24',
};

export const referenceRequest = {
  cpf: cpf.digits,
  employerCnpj: cnpj.digits,
  salaryCents: 500000,
  existingDeductionsCents: 50000,
  requestedAmountCents: 1000000,
  termMonths: 24,
};

export async function fillForm(
  user: UserEvent,
  overrides: Partial<Record<keyof typeof referenceFormInput, string>> = {},
) {
  for (const [label, digits] of Object.entries({ ...referenceFormInput, ...overrides })) {
    await user.type(screen.getByLabelText(label), digits);
  }
}
