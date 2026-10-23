import type { SimulationResponse } from '@consignado/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  allFailedResponse,
  allRejectedResponse,
  betaRejectedResponse,
  bothSuccessResponse,
  oneApprovedResponse,
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
    expect(screen.getAllByText('Aprovado')).toHaveLength(2);
    expect(cardOf('Banco Beta').getByText('Menor parcela')).toBeInTheDocument();
  });

  it.each([
    ['uma aprovada e um banco sem resposta', referenceResponse, ['Aprovado', 'Sem resposta']],
    [
      'uma aprovada e uma acima da margem',
      oneApprovedResponse,
      ['Aprovado até R$ 9.858,33 em 24 meses', 'Aprovado'],
    ],
    [
      'margem excedida',
      overMarginResponse,
      ['Aprovado até R$ 8.698,52 em 24 meses', 'Aprovado até R$ 8.872,80 em 24 meses'],
    ],
    ['margem zero', zeroMarginResponse, ['Sem margem', 'Sem margem']],
  ])('com %s, mostra a situação de cada banco e nenhum selo', (_case, response, labels) => {
    renderResult(response);

    expect(screen.queryByText('Menor parcela')).not.toBeInTheDocument();
    expect(cardOf('Banco Alpha').getByText(labels[0]!)).toBeInTheDocument();
    expect(cardOf('Banco Beta').getByText(labels[1]!)).toBeInTheDocument();
  });

  it('sem nenhum banco, mostra o aviso, os cartões de falha e o botão de repetir', async () => {
    const { onRetry } = renderResult(allFailedResponse);

    expect(screen.getByText(noBankNotice)).toBeInTheDocument();
    expect(screen.queryByText(partialNotice)).not.toBeInTheDocument();
    expect(bankHeadings()).toEqual(['Banco Alpha', 'Banco Beta']);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Simular de novo' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('com um banco recusando, não mostra o aviso parcial', () => {
    renderResult(betaRejectedResponse);

    expect(screen.queryByText(partialNotice)).not.toBeInTheDocument();
    expect(cardOf('Banco Beta').getByText('Reprovado')).toBeInTheDocument();
  });

  it('com todos os bancos recusando, não pede para tentar de novo', () => {
    renderResult(allRejectedResponse);

    expect(screen.queryByText(noBankNotice)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular de novo' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Reprovado')).toHaveLength(2);
  });

  it('com algum banco respondendo, não mostra o botão de repetir', () => {
    renderResult(referenceResponse);

    expect(screen.queryByText(noBankNotice)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular de novo' })).not.toBeInTheDocument();
  });
});
