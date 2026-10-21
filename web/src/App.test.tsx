import { validationMessages } from '@consignado/shared';
import { fictitiousCpfs } from '@consignado/shared/fixtures';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { Simulate, SimulateOutcome } from './lib/api';
import { fillForm, referenceRequest } from './test/fill-form';
import { allFailedResponse, referenceResponse } from './test/responses';

const [cpf] = fictitiousCpfs;
const loadingText = 'Consultando bancos…';
const genericError = 'Não foi possível simular agora. Tente novamente.';

function deferredSimulate() {
  const pending: ((outcome: SimulateOutcome) => void)[] = [];
  const simulate = vi.fn<Simulate>(
    () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  );

  return {
    simulate,
    resolve: (outcome: SimulateOutcome) => pending.shift()?.(outcome),
  };
}

function renderApp(simulate: Simulate) {
  const user = userEvent.setup();
  render(<App simulate={simulate} />);

  return { user };
}

const submitButton = () => screen.getByRole('button', { name: 'Simular' });

describe('App', () => {
  it('mostra o título do simulador', () => {
    renderApp(vi.fn<Simulate>());

    expect(
      screen.getByRole('heading', { level: 1, name: 'Simulador de Consignado' }),
    ).toBeInTheDocument();
  });

  it('mostra o carregamento global e depois o resultado', async () => {
    const { simulate, resolve } = deferredSimulate();
    const { user } = renderApp(simulate);

    await fillForm(user);
    await user.click(submitButton());

    expect(simulate).toHaveBeenCalledExactlyOnceWith(referenceRequest);
    expect(screen.getByRole('status')).toHaveTextContent(loadingText);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(submitButton()).toBeDisabled();

    resolve({ kind: 'success', response: referenceResponse });

    expect(await screen.findByText('O Banco Beta não respondeu a tempo.')).toBeInTheDocument();
    expect(screen.queryByText(loadingText)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Alguns bancos não responderam. Mostramos as ofertas disponíveis.',
    );
    expect(screen.getByText('R$ 517,33')).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
    expect(screen.getByLabelText('CPF')).toHaveValue(cpf.masked);
    expect(screen.getByLabelText('Valor desejado')).toHaveValue('10.000,00');
  });

  it('mostra no campo os erros de um 400 de validação', async () => {
    const simulate = vi.fn<Simulate>().mockResolvedValue({
      kind: 'validation',
      fields: { cpf: validationMessages.cpf },
      requestId: referenceResponse.requestId,
    });
    const { user } = renderApp(simulate);

    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByText(validationMessages.cpf)).toBeInTheDocument();
    expect(screen.getByLabelText('CPF')).toHaveAccessibleDescription(validationMessages.cpf);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('trata como erro um 400 sem campo do formulário', async () => {
    const simulate = vi.fn<Simulate>().mockResolvedValue({
      kind: 'validation',
      fields: { body: validationMessages.required },
    });
    const { user } = renderApp(simulate);

    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(genericError);
  });

  it('mostra o erro da API com o código para suporte', async () => {
    const simulate = vi
      .fn<Simulate>()
      .mockResolvedValue({ kind: 'error', requestId: referenceResponse.requestId });
    const { user } = renderApp(simulate);

    await fillForm(user);
    await user.click(submitButton());

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(genericError);
    expect(alert).toHaveTextContent(`Código para suporte: ${referenceResponse.requestId}`);
  });

  it('na falha de rede, mostra só a mensagem', async () => {
    const simulate = vi.fn<Simulate>().mockResolvedValue({ kind: 'error' });
    const { user } = renderApp(simulate);

    await fillForm(user);
    await user.click(submitButton());

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(genericError);
    expect(alert).not.toHaveTextContent('Código para suporte');
  });

  it('um envio novo apaga o erro anterior', async () => {
    const { simulate, resolve } = deferredSimulate();
    const { user } = renderApp(simulate);

    await fillForm(user);
    await user.click(submitButton());
    resolve({ kind: 'error' });
    await screen.findByRole('alert');

    await user.click(submitButton());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(loadingText);
  });

  it('"Simular de novo" repete a última requisição', async () => {
    const { simulate, resolve } = deferredSimulate();
    const { user } = renderApp(simulate);

    await fillForm(user);
    await user.click(submitButton());
    resolve({ kind: 'success', response: allFailedResponse });

    await user.click(await screen.findByRole('button', { name: 'Simular de novo' }));

    expect(simulate).toHaveBeenCalledTimes(2);
    expect(simulate).toHaveBeenLastCalledWith(referenceRequest);
    expect(screen.getByRole('status')).toHaveTextContent(loadingText);
  });

  it('é preenchível e enviável só com teclado', async () => {
    const simulate = vi
      .fn<Simulate>()
      .mockResolvedValue({ kind: 'success', response: referenceResponse });
    const { user } = renderApp(simulate);
    const order = [
      'Nome completo',
      'E-mail',
      'CPF',
      'CNPJ do empregador',
      'Salário bruto mensal',
      'Descontos consignados existentes',
      'Valor desejado',
      'Prazo (meses)',
    ];

    for (const label of order) {
      await user.tab();
      expect(screen.getByLabelText(label)).toHaveFocus();
    }

    await user.tab();
    expect(submitButton()).toHaveFocus();

    await user.click(screen.getByLabelText('Nome completo'));
    await fillForm(user);
    await user.keyboard('{Enter}');

    expect(simulate).toHaveBeenCalledExactlyOnceWith(referenceRequest);
    expect(await screen.findByRole('heading', { level: 2, name: 'Resultado' })).toBeInTheDocument();
  });
});
