import { randomUUID } from 'node:crypto';
import { isValidCpf } from '@consignado/shared';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { z } from 'zod';
import { waitWhileOpen } from './delay';

export type AlphaOptions = {
  delayMs?: number;
};

const ALPHA_DEFAULT_DELAY_MS = 100;

const alphaRequestSchema = z.strictObject({
  document: z
    .string()
    .regex(/^\d{11}$/)
    .refine(isValidCpf),
  amountCents: z.number().int().positive(),
  termMonths: z.number().int().min(6).max(96),
});

export function alphaRateForTerm(termMonths: number): string {
  if (termMonths <= 24) {
    return '0.24';
  }

  if (termMonths <= 60) {
    return '0.26';
  }

  return '0.28';
}

const invalidRequest = { error: 'invalid_request' };

const handleMalformedJson: ErrorRequestHandler = (_error, _request, response, _next) => {
  response.status(400).json(invalidRequest);
};

export function createAlphaApp({ delayMs = ALPHA_DEFAULT_DELAY_MS }: AlphaOptions = {}): Express {
  const app = express();
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

    response.json({
      quoteId: randomUUID(),
      annualInterestRate: alphaRateForTerm(result.data.termMonths),
    });
  });

  app.use(handleMalformedJson);

  return app;
}
