import { APP_NAME, type SimulationRequest, type SimulationResponse } from '@consignado/shared';
import { useState } from 'react';
import { SimulationForm } from './components/SimulationForm';
import { SimulationResult } from './components/SimulationResult';
import { simulate as defaultSimulate, type Simulate } from './lib/api';
import { toFormErrors, type FormErrors } from './lib/form';

type ScreenState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; response: SimulationResponse }
  | { status: 'error'; requestId?: string | undefined };

export type AppProps = {
  simulate?: Simulate;
};

export function App({ simulate = defaultSimulate }: AppProps) {
  const [screen, setScreen] = useState<ScreenState>({ status: 'idle' });
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const [lastRequest, setLastRequest] = useState<SimulationRequest | null>(null);
  const loading = screen.status === 'loading';

  async function run(request: SimulationRequest) {
    setLastRequest(request);
    setScreen({ status: 'loading' });

    const outcome = await simulate(request);

    if (outcome.kind === 'success') {
      setScreen({ status: 'success', response: outcome.response });
      return;
    }

    if (outcome.kind === 'validation') {
      const errors = toFormErrors(outcome.fields);

      if (Object.keys(errors).length > 0) {
        setServerErrors(errors);
        setScreen({ status: 'idle' });
        return;
      }
    }

    setScreen({ status: 'error', requestId: outcome.requestId });
  }

  function handleRetry() {
    if (lastRequest) {
      void run(lastRequest);
    }
  }

  return (
    <main className="app">
      <h1>{APP_NAME}</h1>
      <SimulationForm
        onSubmit={(request) => void run(request)}
        disabled={loading}
        serverErrors={serverErrors}
      />
      {screen.status === 'error' && (
        <div role="alert" className="notice notice-error">
          <p>Não foi possível simular agora. Tente novamente.</p>
          {screen.requestId && <p>Código para suporte: {screen.requestId}</p>}
        </div>
      )}
      <div role="status" aria-live="polite" aria-busy={loading} className="status-region">
        {loading && <p className="loading">Consultando bancos…</p>}
        {screen.status === 'success' && (
          <SimulationResult response={screen.response} onRetry={handleRetry} />
        )}
      </div>
    </main>
  );
}
