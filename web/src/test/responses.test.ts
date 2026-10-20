import { bankResultSchema, simulationResponseSchema } from '@consignado/shared';
import { describe, expect, it } from 'vitest';
import {
  allFailedResponse,
  alphaTimeout,
  betaInvalidResponse,
  betaTimeout,
  betaUnavailable,
  bothSuccessResponse,
  overMarginResponse,
  referenceResponse,
  zeroMarginResponse,
} from './responses';

describe('respostas fictícias', () => {
  it.each([
    ['referenceResponse', referenceResponse],
    ['bothSuccessResponse', bothSuccessResponse],
    ['overMarginResponse', overMarginResponse],
    ['zeroMarginResponse', zeroMarginResponse],
    ['allFailedResponse', allFailedResponse],
  ])('%s passa no contrato da resposta', (_name, response) => {
    expect(simulationResponseSchema.safeParse(response).success).toBe(true);
  });

  it.each([alphaTimeout, betaTimeout, betaUnavailable, betaInvalidResponse])(
    'o resultado $status de $bankId passa no contrato',
    (result) => {
      expect(bankResultSchema.safeParse(result).success).toBe(true);
    },
  );
});
