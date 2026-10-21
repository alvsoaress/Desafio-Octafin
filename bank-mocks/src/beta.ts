import { randomUUID } from 'node:crypto';
import { isValidCpf } from '@consignado/shared';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { z } from 'zod';
import type { BetaScenario } from './config';
import { waitWhileOpen } from './delay';
import { requestLog, type LogLine } from './request-log';

export type BetaOptions = {
  scenario?: BetaScenario;
  delayMs?: number;
  slowDelayMs?: number;
  log?: LogLine;
};

export const BETA_SLOW_DELAY_MS = 10_000;
const BETA_DEFAULT_DELAY_MS = 150;
const BETA_ANNUAL_RATE_PERCENT = '21.50';
const SIMULATION_ROUTE = '/api/simulacao';

const betaRequestSchema = z.strictObject({
  cpf: z
    .string()
    .regex(/^\d{11}$/)
    .refine(isValidCpf),
  valor: z
    .string()
    .regex(/^\d+\.\d{2}$/)
    .refine((value) => !/^0+\.00$/.test(value)),
  prazoMeses: z.number().int().min(6).max(96),
});

const invalidRequest = { erro: 'requisicao_invalida' };

const handleMalformedJson: ErrorRequestHandler = (_error, _request, response, _next) => {
  response.status(400).json(invalidRequest);
};

export function createBetaApp({
  scenario = 'ok',
  delayMs = BETA_DEFAULT_DELAY_MS,
  slowDelayMs = BETA_SLOW_DELAY_MS,
  log,
}: BetaOptions = {}): Express {
  const app = express();
  app.use(requestLog('beta', log));

  if (scenario === 'unavailable') {
    app.post(SIMULATION_ROUTE, (_request, response) => {
      response.status(503).json({ erro: 'servico_indisponivel' });
    });

    return app;
  }

  app.use(express.json());

  app.post(SIMULATION_ROUTE, async (request, response) => {
    if (!betaRequestSchema.safeParse(request.body).success) {
      response.status(400).json(invalidRequest);
      return;
    }

    const waitMs = scenario === 'slow' ? slowDelayMs : delayMs;

    if (!(await waitWhileOpen(response, waitMs))) {
      return;
    }

    if (scenario === 'invalid') {
      response.json({ codigo: randomUUID() });
      return;
    }

    response.json({ codigo: randomUUID(), taxaAnualPercentual: BETA_ANNUAL_RATE_PERCENT });
  });

  app.use(handleMalformedJson);

  return app;
}
