import type { BankResult, Offer } from '@consignado/shared';
import { formatAnnualRate, formatCents, formatMonthlyRate } from '../lib/format';
import { bankOutcome, type BankOutcome } from '../lib/result';

const OUTCOME_LABELS: Record<Exclude<BankOutcome, 'above-margin'>, string> = {
  approved: 'Aprovado',
  rejected: 'Reprovado',
  'no-response': 'Sem resposta',
};

export type BankCardProps = {
  result: BankResult;
  lowest: boolean;
  availableMarginCents: number;
  termMonths: number;
};

function MarginWarning({
  offer,
  availableMarginCents,
}: {
  offer: Offer;
  availableMarginCents: number;
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
    </div>
  );
}

function aboveMarginLabel(offer: Offer, availableMarginCents: number, termMonths: number): string {
  if (availableMarginCents === 0) {
    return 'Sem margem';
  }

  return `Aprovado até ${formatCents(offer.maxFinanceableCents ?? 0)} em ${termMonths} meses`;
}

function OutcomeLabel({ outcome, label }: { outcome: BankOutcome; label: string }) {
  return <span className={`outcome outcome-${outcome}`}>{label}</span>;
}

export function BankCard({ result, lowest, availableMarginCents, termMonths }: BankCardProps) {
  if (result.status === 'rejected') {
    return (
      <article className="bank-card">
        <div className="bank-card-header">
          <h3>{result.bankName}</h3>
          <OutcomeLabel outcome="rejected" label={OUTCOME_LABELS.rejected} />
        </div>
        <p>{result.rejection.message}</p>
      </article>
    );
  }

  if (result.status !== 'success') {
    return (
      <article className="bank-card bank-card-failed">
        <div className="bank-card-header">
          <h3>{result.bankName}</h3>
          <OutcomeLabel outcome="no-response" label={OUTCOME_LABELS['no-response']} />
        </div>
        <p className="bank-error">{result.error.message}</p>
      </article>
    );
  }

  const { offer } = result;
  const outcome = bankOutcome(result);
  const label =
    outcome === 'above-margin'
      ? aboveMarginLabel(offer, availableMarginCents, termMonths)
      : OUTCOME_LABELS.approved;

  return (
    <article className="bank-card">
      <div className="bank-card-header">
        <h3>{result.bankName}</h3>
        <OutcomeLabel outcome={outcome} label={label} />
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
      <MarginWarning offer={offer} availableMarginCents={availableMarginCents} />
    </article>
  );
}
