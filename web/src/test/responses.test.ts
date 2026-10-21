import { bankResultSchema, simulationResponseSchema } from '@consignado/shared';
import { describe, expect, it } from 'vitest';
import {
  allFailedResponse,
  allRejectedResponse,
  alphaTimeout,
  betaRejected,
  betaRejectedResponse,
  betaInvalidResponse,
  betaTimeout,
  betaUnavailable,
  bothSuccessResponse,
  oneApprovedResponse,
  overMarginResponse,
  referenceResponse,
  zeroMarginResponse,
} from './responses';

describe('respostas fictícias', () => {
  it.each([
    ['referenceResponse', referenceResponse],
    ['bothSuccessResponse', bothSuccessResponse],
    ['overMarginResponse', overMarginResponse],
    ['oneApprovedResponse', oneApprovedResponse],
    ['zeroMarginResponse', zeroMarginResponse],
    ['allFailedResponse', allFailedResponse],
    ['betaRejectedResponse', betaRejectedResponse],
    ['allRejectedResponse', allRejectedResponse],
  ])('%s passa no contrato da resposta', (_name, response) => {
    expect(simulationResponseSchema.safeParse(response).success).toBe(true);
  });

  it.each([alphaTimeout, betaTimeout, betaUnavailable, betaInvalidResponse, betaRejected])(
    'o resultado $status de $bankId passa no contrato',
    (result) => {
      expect(bankResultSchema.safeParse(result).success).toBe(true);
    },
  );
});
