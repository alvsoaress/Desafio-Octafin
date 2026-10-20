import { APP_NAME } from '@consignado/shared';
import { createApp } from './app';
import { loadEnv, type ApiConfig } from './config/env';
import { createLogger } from './infra/logger';

let config: ApiConfig;

try {
  config = loadEnv(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const logger = createLogger({ level: config.logLevel });

createApp({ logger, webOrigin: config.webOrigin }).listen(config.port, () => {
  logger.info({ port: config.port }, `${APP_NAME}: API ouvindo na porta ${config.port}`);
});
