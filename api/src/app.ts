import cors from 'cors';
import express, { type Express } from 'express';
import { errorHandler } from './http/middlewares/error-handler';
import { requestId } from './http/middlewares/request-id';
import { requestLog } from './http/middlewares/request-log';
import type { Logger } from './services/simulation.service';

export const BODY_LIMIT = '10kb';

export type AppOptions = {
  logger: Logger;
  webOrigin: string;
};

export function createApp({ logger, webOrigin }: AppOptions): Express {
  const app = express();
  app.use(requestId());
  app.use(requestLog(logger));
  app.use(cors({ origin: [webOrigin] }));
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(errorHandler(logger));
  return app;
}
