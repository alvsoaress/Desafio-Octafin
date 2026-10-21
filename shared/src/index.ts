export const APP_NAME = 'Simulador de Consignado';

export { isValidCnpj, isValidCpf, normalizeCnpj, normalizeCpf } from './documents';
export { validationMessages } from './messages';
export { parseBrlToCents } from './money';
export {
  simulationRequestSchema,
  toFieldErrors,
  type SimulationRequest,
  type SimulationRequestInput,
} from './simulation-request';
export {
  bankResponded,
  bankResultSchema,
  bankStatusSchema,
  offerSchema,
  rateSchema,
  rejectionReasonSchema,
  simulationResponseSchema,
  type BankRejectionReason,
  type BankResult,
  type BankStatus,
  type Offer,
  type SimulationResponse,
} from './simulation-response';
