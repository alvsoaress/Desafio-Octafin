import type { SimulationResponse } from '@consignado/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  allFailedResponse,
  bothSuccessResponse,
  overMarginResponse,
  referenceResponse,
  zeroMarginResponse,
} from '../test/responses';
import { SimulationResult } from './SimulationResult';

const partialNotice = 'Alguns bancos não responderam. Mostramos as ofertas disponíveis.';
const noBankNotice = 'Nenhum banco respondeu agora. Tente novamente em alguns instantes.';

function renderResult(response: SimulationResponse) {
  const onRetry = vi.fn();
  render(<SimulationResult response={response} onRetry={onRetry} />);

  return { onRetry };
}

function bankHeadings() {
  return screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
}

function cardOf(bankName: string) {
  const card = screen.getByRole('heading', { name: bankName }).closest('article');

  if (!card) {
    throw new Error(`Cartão do ${bankName} não encontrado.`);
  }

  return within(card);
}

describe('SimulationResult', () => {
  it('mostra as margens, o aviso parcial e os cartões na ordem da resposta', () => {
    renderResult(referenceResponse);

    expect(screen.getByRole('heading', { level: 2, name: 'Resultado' })).toBeInTheDocument();
    expect(screen.getByText('R$ 1.750,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.250,00')).toBeInTheDocument();
    expect(screen.getByText(partialNotice)).toBeInTheDocument();
    expect(bankHeadings()).toEqual(['Banco Alpha', 'Banco Beta']);
  });

  it('sem falhas, não mostra o aviso parcial e põe o selo só na menor parcela', () => {
    renderResult(bothSuccessResponse);

    expect(screen.queryByText(partialNotice)).not.toBeInTheDocument();
    expect(screen.getAllByText('Menor parcela')).toHaveLength(1);
    expect(cardOf('Banco Beta').getByText('Menor parcela')).toBeInTheDocument();
  });

  it.each([
    ['margem excedida', overMarginResponse],
    ['margem zero', zeroMarginResponse],
  ])('com %s, não mostra o selo', (_case, response) => {
    renderResult(response);

    expect(screen.queryByText('Menor parcela')).not.toBeInTheDocument();
  });

  it('sem nenhum banco, mostra o aviso, os cartões de falha e o botão de repetir', async () => {
    const { onRetry } = renderResult(allFailedResponse);

    expect(screen.getByText(noBankNotice)).toBeInTheDocument();
    expect(screen.queryByText(partialNotice)).not.toBeInTheDocument();
    expect(bankHeadings()).toEqual(['Banco Alpha', 'Banco Beta']);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Simular de novo' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('com algum banco respondendo, não mostra o botão de repetir', () => {
    renderResult(referenceResponse);

    expect(screen.queryByText(noBankNotice)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular de novo' })).not.toBeInTheDocument();
  });
});
