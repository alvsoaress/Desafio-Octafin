import { APP_NAME } from '@consignado/shared';
import { createAlphaApp } from './alpha';
import { createBetaApp } from './beta';
import { loadConfig, type MocksConfig } from './config';

let config: MocksConfig;

try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const { alphaPort, betaPort, betaScenario } = config;

createAlphaApp().listen(alphaPort, () => {
  console.log(`${APP_NAME}: Banco Alpha ouvindo na porta ${alphaPort}`);
});

createBetaApp({ scenario: betaScenario }).listen(betaPort, () => {
  console.log(`${APP_NAME}: Banco Beta ouvindo na porta ${betaPort} no cenário ${betaScenario}`);
});
