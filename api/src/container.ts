import type { ApiConfig } from './config/env';
import { AlphaAdapter } from './infra/banks/alpha.adapter';
import { BetaAdapter } from './infra/banks/beta.adapter';
import { createLogger } from './infra/logger';
import { SimulationService } from './services/simulation.service';

export function createContainer(config: ApiConfig) {
  const logger = createLogger({ level: config.logLevel });
  const adapters = [
    new AlphaAdapter({ baseUrl: config.alphaBaseUrl }),
    new BetaAdapter({ baseUrl: config.betaBaseUrl }),
  ];
  const simulationService = new SimulationService({
    adapters,
    timeoutMs: config.bankTimeoutMs,
    logger,
  });

  return { logger, simulationService };
}
