import { randomUUID } from 'node:crypto';
import { isValidCnpj, isValidCpf } from '@consignado/shared';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { z } from 'zod';
import { waitWhileOpen } from './delay';
import { requestLog, type LogLine } from './request-log';
import { scoreFromCpf } from './score';

export type AlphaOptions = {
  delayMs?: number;
  log?: LogLine;
};

const ALPHA_DEFAULT_DELAY_MS = 100;
export const ALPHA_MAX_AMOUNT_CENTS = 10_000_000;
export const ALPHA_MIN_SCORE = 500;
export const ALPHA_PRIME_SCORE = 750;
export const ALPHA_PARTNER_EMPLOYERS: ReadonlySet<string> = new Set([
  '47182936000144',
  '38501462000165',
]);

const alphaRequestSchema = z.strictObject({
  document: z
    .string()
    .regex(/^\d{11}$/)
    .refine(isValidCpf),
  employerDocument: z
    .string()
    .regex(/^\d{14}$/)
    .refine(isValidCnpj),
  amountCents: z.number().int().positive(),
  termMonths: z.number().int().min(6).max(96),
});

const ALPHA_PRIME_RATES = ['0.24', '0.26', '0.28'] as const;
const ALPHA_STANDARD_RATES = ['0.30', '0.32', '0.34'] as const;

export function alphaRate(termMonths: number, score: number): string {
  const [short, medium, long] =
    score >= ALPHA_PRIME_SCORE ? ALPHA_PRIME_RATES : ALPHA_STANDARD_RATES;

  if (termMonths <= 24) {
    return short;
  }

  if (termMonths <= 60) {
    return medium;
  }

  return long;
}

const invalidRequest = { error: 'invalid_request' };

const handleMalformedJson: ErrorRequestHandler = (_error, _request, response, _next) => {
  response.status(400).json(invalidRequest);
};

export function createAlphaApp({
  delayMs = ALPHA_DEFAULT_DELAY_MS,
  log,
}: AlphaOptions = {}): Express {
  const app = express();
  app.use(requestLog('alpha', log));
  app.use(express.json());

  app.post('/v1/loan-quotes', async (request, response) => {
    const result = alphaRequestSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json(invalidRequest);
      return;
    }

    if (!(await waitWhileOpen(response, delayMs))) {
      return;
    }

    if (!ALPHA_PARTNER_EMPLOYERS.has(result.data.employerDocument)) {
      response.json({
        quoteId: randomUUID(),
        decision: 'declined',
        reasonCode: 'EMPLOYER_NOT_COVERED',
      });
      return;
    }

    const score = scoreFromCpf(result.data.document);

    if (score < ALPHA_MIN_SCORE) {
      response.json({
        quoteId: randomUUID(),
        decision: 'declined',
        reasonCode: 'LOW_SCORE',
      });
      return;
    }

    if (result.data.amountCents > ALPHA_MAX_AMOUNT_CENTS) {
      response.json({
        quoteId: randomUUID(),
        decision: 'declined',
        reasonCode: 'AMOUNT_ABOVE_LIMIT',
      });
      return;
    }

    response.json({
      quoteId: randomUUID(),
      decision: 'approved',
      annualInterestRate: alphaRate(result.data.termMonths, score),
    });
  });

  app.use(handleMalformedJson);

  return app;
}
