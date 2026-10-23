import { randomUUID } from 'node:crypto';
import { isValidCnpj, isValidCpf } from '@consignado/shared';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { z } from 'zod';
import type { BetaScenario } from './config';
import { waitWhileOpen } from './delay';
import { requestLog, type LogLine } from './request-log';
import { scoreFromCpf } from './score';

export type BetaOptions = {
  scenario?: BetaScenario;
  delayMs?: number;
  slowDelayMs?: number;
  log?: LogLine;
};

export const BETA_SLOW_DELAY_MS = 10_000;
const BETA_DEFAULT_DELAY_MS = 150;
const BETA_ANNUAL_RATE_PERCENT = '21.50';
const CENTS_PER_REAL = 100;
const MONTHS_PER_YEAR = 12;
const MONTHLY_RATE_SCALE = 1_000_000;
const PERCENT = 100;
export const BETA_MIN_SCORE = 300;
const SIMULATION_ROUTE = '/api/simulacao';
export const BETA_PARTNER_EMPLOYERS: ReadonlySet<string> = new Set([
  '47182936000144',
  '92057318000127',
]);

const betaRequestSchema = z.strictObject({
  cpf: z
    .string()
    .regex(/^\d{11}$/)
    .refine(isValidCpf),
  cnpjEmpregador: z
    .string()
    .regex(/^\d{14}$/)
    .refine(isValidCnpj),
  valor: z
    .string()
    .regex(/^\d+\.\d{2}$/)
    .refine((value) => !/^0+\.00$/.test(value)),
  prazoMeses: z.number().int().min(6).max(96),
});

export function betaInstallment(valor: string, prazoMeses: number): string {
  const amountCents = Math.round(Number(valor) * CENTS_PER_REAL);
  const annualRate = Number(BETA_ANNUAL_RATE_PERCENT) / PERCENT;
  const monthlyRate =
    Math.round(((1 + annualRate) ** (1 / MONTHS_PER_YEAR) - 1) * MONTHLY_RATE_SCALE) /
    MONTHLY_RATE_SCALE;
  const installmentCents = Math.round(
    (amountCents * monthlyRate) / (1 - (1 + monthlyRate) ** -prazoMeses),
  );

  return (installmentCents / CENTS_PER_REAL).toFixed(2);
}

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
    const result = betaRequestSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json(invalidRequest);
      return;
    }

    const waitMs = scenario === 'slow' ? slowDelayMs : delayMs;

    if (!(await waitWhileOpen(response, waitMs))) {
      return;
    }

    if (!BETA_PARTNER_EMPLOYERS.has(result.data.cnpjEmpregador)) {
      response.status(422).json({ codigo: randomUUID(), erro: 'empregador_sem_convenio' });
      return;
    }

    if (scoreFromCpf(result.data.cpf) < BETA_MIN_SCORE) {
      response.status(422).json({ codigo: randomUUID(), erro: 'score_insuficiente' });
      return;
    }

    if (scenario === 'invalid') {
      response.json({ codigo: randomUUID() });
      return;
    }

    response.json({
      codigo: randomUUID(),
      taxaAnualPercentual: BETA_ANNUAL_RATE_PERCENT,
      valorParcela: betaInstallment(result.data.valor, result.data.prazoMeses),
    });
  });

  app.use(handleMalformedJson);

  return app;
}
