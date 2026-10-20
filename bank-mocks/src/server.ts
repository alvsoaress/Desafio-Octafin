import { APP_NAME } from '@consignado/shared';
import { createAlphaApp } from './alpha';
import { createBetaApp } from './beta';

const alphaPort = Number(process.env.ALPHA_PORT ?? 4001);
const betaPort = Number(process.env.BETA_PORT ?? 4002);

createAlphaApp().listen(alphaPort, () => {
  console.log(`${APP_NAME}: Banco Alpha ouvindo na porta ${alphaPort}`);
});

createBetaApp().listen(betaPort, () => {
  console.log(`${APP_NAME}: Banco Beta ouvindo na porta ${betaPort}`);
});
