import type { BankResult, Offer } from '@consignado/shared';
import { formatAnnualRate, formatCents, formatMonthlyRate } from '../lib/format';

export type BankCardProps = {
  result: BankResult;
  lowest: boolean;
  availableMarginCents: number;
  termMonths: number;
};

function MarginWarning({
  offer,
  availableMarginCents,
  termMonths,
}: {
  offer: Offer;
  availableMarginCents: number;
  termMonths: number;
}) {
  if (offer.withinMargin) {
    return null;
  }

  if (availableMarginCents === 0) {
    return (
      <div className="margin-warning">
        <p>Você não tem margem disponível para uma nova parcela.</p>
      </div>
    );
  }

  return (
    <div className="margin-warning">
      <p>
        A parcela de {formatCents(offer.installmentCents)} passa da sua margem disponível de{' '}
        {formatCents(availableMarginCents)}.
      </p>
      <p>
        Com essa margem, você consegue até {formatCents(offer.maxFinanceableCents ?? 0)} em{' '}
        {termMonths} meses.
      </p>
    </div>
  );
}

export function BankCard({ result, lowest, availableMarginCents, termMonths }: BankCardProps) {
  if (result.status !== 'success') {
    return (
      <article className="bank-card bank-card-failed">
        <h3>{result.bankName}</h3>
        <p className="bank-error">{result.error.message}</p>
      </article>
    );
  }

  const { offer } = result;

  return (
    <article className="bank-card">
      <div className="bank-card-header">
        <h3>{result.bankName}</h3>
        {lowest && <span className="badge">Menor parcela</span>}
      </div>
      <dl className="offer">
        <div>
          <dt>Parcela</dt>
          <dd className="offer-installment">{formatCents(offer.installmentCents)}</dd>
        </div>
        <div>
          <dt>Taxa mensal</dt>
          <dd>{formatMonthlyRate(offer.monthlyRate)}</dd>
        </div>
        <div>
          <dt>Taxa anual</dt>
          <dd>{formatAnnualRate(offer.annualRate)}</dd>
        </div>
        <div>
          <dt>Total pago</dt>
          <dd>{formatCents(offer.totalCents)}</dd>
        </div>
        <div>
          <dt>Total de juros</dt>
          <dd>{formatCents(offer.totalInterestCents)}</dd>
        </div>
      </dl>
      <MarginWarning
        offer={offer}
        availableMarginCents={availableMarginCents}
        termMonths={termMonths}
      />
    </article>
  );
}
