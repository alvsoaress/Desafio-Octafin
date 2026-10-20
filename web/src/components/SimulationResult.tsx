import type { SimulationResponse } from '@consignado/shared';
import { formatCents } from '../lib/format';
import { allBanksFailed, lowestInstallmentBankId } from '../lib/result';
import { BankCard } from './BankCard';

export type SimulationResultProps = {
  response: SimulationResponse;
  onRetry: () => void;
};

export function SimulationResult({ response, onRetry }: SimulationResultProps) {
  const { margin, request, results } = response;
  const noBankResponded = allBanksFailed(results);
  const lowestBankId = lowestInstallmentBankId(results);

  return (
    <section className="simulation-result" aria-labelledby="result-title">
      <h2 id="result-title">Resultado</h2>
      <dl className="margins">
        <div>
          <dt>Margem consignável</dt>
          <dd>{formatCents(margin.consignableCents)}</dd>
        </div>
        <div>
          <dt>Margem disponível</dt>
          <dd>{formatCents(margin.availableCents)}</dd>
        </div>
      </dl>
      {noBankResponded ? (
        <div className="notice notice-error">
          <p>Nenhum banco respondeu agora. Tente novamente em alguns instantes.</p>
          <button type="button" onClick={onRetry}>
            Simular de novo
          </button>
        </div>
      ) : (
        response.partial && (
          <p className="notice notice-warning">
            Alguns bancos não responderam. Mostramos as ofertas disponíveis.
          </p>
        )
      )}
      <ul className="bank-cards">
        {results.map((result) => (
          <li key={result.bankId}>
            <BankCard
              result={result}
              lowest={result.bankId === lowestBankId}
              availableMarginCents={margin.availableCents}
              termMonths={request.termMonths}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
