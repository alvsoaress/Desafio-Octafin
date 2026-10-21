import type { BankResult, SimulationResponse } from '@consignado/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  betaInvalidResponse,
  betaTimeout,
  betaUnavailable,
  overMarginResponse,
  referenceResponse,
  zeroMarginResponse,
} from '../test/responses';
import { BankCard } from './BankCard';

function renderCard(result: BankResult, response: SimulationResponse, lowest = false) {
  return render(
    <BankCard
      result={result}
      lowest={lowest}
      availableMarginCents={response.margin.availableCents}
      termMonths={response.request.termMonths}
    />,
  );
}

const [referenceAlpha] = referenceResponse.results;
const [overMarginAlpha] = overMarginResponse.results;
const [zeroMarginAlpha] = zeroMarginResponse.results;

describe('BankCard', () => {
  it('mostra a oferta com taxas, parcela, total e juros formatados', () => {
    renderCard(referenceAlpha!, referenceResponse);

    expect(screen.getByRole('heading', { name: 'Banco Alpha' })).toBeInTheDocument();
    expect(screen.getByText('1,8088% a.m.')).toBeInTheDocument();
    expect(screen.getByText('24,00% a.a.')).toBeInTheDocument();
    expect(screen.getByText('R$ 517,33')).toBeInTheDocument();
    expect(screen.getByText('R$ 12.415,92')).toBeInTheDocument();
    expect(screen.getByText('R$ 2.415,92')).toBeInTheDocument();
  });

  it('mostra o selo só quando é a menor parcela', () => {
    const { rerender } = renderCard(referenceAlpha!, referenceResponse, true);

    expect(screen.getByText('Menor parcela')).toBeInTheDocument();

    rerender(
      <BankCard
        result={referenceAlpha!}
        lowest={false}
        availableMarginCents={125000}
        termMonths={24}
      />,
    );

    expect(screen.queryByText('Menor parcela')).not.toBeInTheDocument();
  });

  it.each([
    [betaTimeout, 'O Banco Beta não respondeu a tempo.'],
    [betaUnavailable, 'O Banco Beta está indisponível no momento.'],
    [betaInvalidResponse, 'O Banco Beta devolveu uma resposta que não conseguimos ler.'],
  ])('em $status, mostra o nome do banco e a mensagem', (result, message) => {
    renderCard(result, referenceResponse);

    expect(screen.getByRole('heading', { name: 'Banco Beta' })).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText('Parcela')).not.toBeInTheDocument();
  });

  it('fora da margem, mostra a parcela máxima e o valor financiável', () => {
    renderCard(overMarginAlpha!, overMarginResponse);

    expect(
      screen.getByText('A parcela de R$ 517,33 passa da sua margem disponível de R$ 450,00.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Com essa margem, você consegue até R$ 8.698,52 em 24 meses.'),
    ).toBeInTheDocument();
  });

  it('com margem zero, mostra só o aviso de margem zero', () => {
    renderCard(zeroMarginAlpha!, zeroMarginResponse);

    expect(
      screen.getByText('Você não tem margem disponível para uma nova parcela.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/passa da sua margem/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Com essa margem/)).not.toBeInTheDocument();
  });

  it.each([
    ['dentro da margem', 'Aprovado', referenceAlpha!, referenceResponse],
    ['fora da margem', 'Reprovado', overMarginAlpha!, overMarginResponse],
    ['com margem zero', 'Reprovado', zeroMarginAlpha!, zeroMarginResponse],
    ['em timeout', 'Sem resposta', betaTimeout, referenceResponse],
    ['em unavailable', 'Sem resposta', betaUnavailable, referenceResponse],
    ['em invalid-response', 'Sem resposta', betaInvalidResponse, referenceResponse],
  ])('%s, mostra só o rótulo "%s"', (_case, label, result, response) => {
    renderCard(result, response);

    expect(screen.getByText(label)).toBeInTheDocument();
    for (const other of ['Aprovado', 'Reprovado', 'Sem resposta']) {
      if (other !== label) {
        expect(screen.queryByText(other)).not.toBeInTheDocument();
      }
    }
  });

  it('dentro da margem, não mostra aviso', () => {
    renderCard(referenceAlpha!, referenceResponse);

    expect(screen.queryByText(/margem/)).not.toBeInTheDocument();
  });
});
