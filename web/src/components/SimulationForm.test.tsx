import { validationMessages } from '@consignado/shared';
import { fictitiousCnpjs, fictitiousCpfs } from '@consignado/shared/fixtures';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormErrors } from '../lib/form';
import { SimulationForm } from './SimulationForm';

const [cpf] = fictitiousCpfs;
const [cnpj] = fictitiousCnpjs;

function renderForm(props: { disabled?: boolean; serverErrors?: FormErrors } = {}) {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  const view = render(<SimulationForm onSubmit={onSubmit} {...props} />);

  return { onSubmit, user, view };
}

const input = (label: string) => screen.getByLabelText(label);

async function fillReference(user: ReturnType<typeof userEvent.setup>, termMonths = '24') {
  await user.type(input('CPF'), cpf.digits);
  await user.type(input('CNPJ do empregador'), cnpj.digits);
  await user.type(input('Salário bruto mensal'), '500000');
  await user.type(input('Descontos consignados existentes'), '50000');
  await user.type(input('Valor desejado'), '1000000');
  await user.type(input('Prazo (meses)'), termMonths);
}

describe('SimulationForm', () => {
  it('aplica a máscara de cada campo durante a digitação', async () => {
    const { user } = renderForm();

    await fillReference(user);
    await user.type(input('Prazo (meses)'), 'ab');

    expect(input('CPF')).toHaveValue(cpf.masked);
    expect(input('CNPJ do empregador')).toHaveValue(cnpj.masked);
    expect(input('Salário bruto mensal')).toHaveValue('5.000,00');
    expect(input('Descontos consignados existentes')).toHaveValue('500,00');
    expect(input('Valor desejado')).toHaveValue('10.000,00');
    expect(input('Prazo (meses)')).toHaveValue('24');
  });

  it('não mostra erro antes de o campo perder o foco', async () => {
    const { user } = renderForm();

    await user.type(input('CPF'), '123');

    expect(input('CPF')).not.toHaveAccessibleDescription();
  });

  it('mostra o erro ao sair do campo e o atualiza durante a digitação', async () => {
    const { user } = renderForm();

    await user.click(input('CPF'));
    await user.tab();

    expect(input('CPF')).toHaveAccessibleDescription(validationMessages.required);

    await user.type(input('CPF'), '381');

    expect(input('CPF')).toHaveAccessibleDescription(validationMessages.cpf);

    await user.type(input('CPF'), cpf.digits.slice(3));

    expect(input('CPF')).not.toHaveAccessibleDescription();
  });

  it('no envio inválido, mostra o erro, foca o primeiro campo inválido e não envia', async () => {
    const { user, onSubmit } = renderForm();

    await fillReference(user, '97');
    await user.click(screen.getByRole('button', { name: 'Simular' }));

    expect(input('Prazo (meses)')).toHaveAccessibleDescription(validationMessages.termMonths);
    expect(input('Prazo (meses)')).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('no envio vazio, mostra todos os erros e foca o CPF', async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Simular' }));

    expect(input('CPF')).toHaveFocus();
    expect(screen.getAllByText(validationMessages.required)).toHaveLength(6);
  });

  it('envia o exemplo de referência em centavos e mantém os valores digitados', async () => {
    const { user, onSubmit } = renderForm();

    await fillReference(user);
    await user.click(screen.getByRole('button', { name: 'Simular' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      cpf: cpf.digits,
      employerCnpj: cnpj.digits,
      salaryCents: 500000,
      existingDeductionsCents: 50000,
      requestedAmountCents: 1000000,
      termMonths: 24,
    });
    expect(input('CPF')).toHaveValue(cpf.masked);
    expect(input('Valor desejado')).toHaveValue('10.000,00');
    expect(input('Prazo (meses)')).toHaveValue('24');
  });

  it('desabilitado, não envia', async () => {
    const { user, onSubmit } = renderForm({ disabled: true });

    await fillReference(user);
    await user.type(input('Prazo (meses)'), '{Enter}');

    expect(screen.getByRole('button', { name: 'Simular' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('mostra os erros da API no campo até ele ser editado', async () => {
    const { user } = renderForm({ serverErrors: { cpf: validationMessages.cpf } });

    expect(input('CPF')).toHaveAccessibleDescription(validationMessages.cpf);

    await user.type(input('CPF'), '3');

    expect(input('CPF')).not.toHaveAccessibleDescription();
  });

  it('mostra de novo os erros de uma nova resposta da API', async () => {
    const { user, view, onSubmit } = renderForm({ serverErrors: { cpf: validationMessages.cpf } });

    await user.type(input('CPF'), '3');
    view.rerender(
      <SimulationForm onSubmit={onSubmit} serverErrors={{ cpf: validationMessages.cpf }} />,
    );

    expect(input('CPF')).toHaveAccessibleDescription(validationMessages.cpf);
  });
});
