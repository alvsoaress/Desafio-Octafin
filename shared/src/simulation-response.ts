import { z } from 'zod';
import {
  MAX_REQUESTED_AMOUNT_CENTS,
  MAX_TERM_MONTHS,
  MIN_REQUESTED_AMOUNT_CENTS,
  MIN_TERM_MONTHS,
} from './simulation-request';

const cents = z.number().int().nonnegative();

export const rateSchema = z.string().regex(/^\d+\.\d{6}$/);

export const offerSchema = z
  .strictObject({
    annualRate: rateSchema,
    monthlyRate: rateSchema,
    installmentCents: cents,
    totalCents: cents,
    totalInterestCents: cents,
    withinMargin: z.boolean(),
    maxInstallmentCents: cents,
    maxFinanceableCents: cents.nullable(),
  })
  .refine((offer) => offer.withinMargin === (offer.maxFinanceableCents === null), {
    error: 'maxFinanceableCents deve ser nulo só quando a oferta cabe na margem.',
    path: ['maxFinanceableCents'],
  })
  .refine((offer) => offer.withinMargin === offer.installmentCents <= offer.maxInstallmentCents, {
    error: 'withinMargin deve ser verdadeiro só quando a parcela cabe na margem.',
    path: ['withinMargin'],
  });

export const bankStatusSchema = z.enum([
  'success',
  'rejected',
  'timeout',
  'unavailable',
  'invalid-response',
]);

export const rejectionReasonSchema = z.enum([
  'amount-above-limit',
  'employer-not-covered',
  'other',
]);

const failureStatusSchema = bankStatusSchema.exclude(['success', 'rejected']);

const bankIdentity = {
  bankId: z.string().min(1),
  bankName: z.string().min(1),
};

const successResultSchema = z.strictObject({
  ...bankIdentity,
  status: z.literal('success'),
  offer: offerSchema,
});

const rejectedResultSchema = z.strictObject({
  ...bankIdentity,
  status: z.literal('rejected'),
  rejection: z.strictObject({
    reason: rejectionReasonSchema,
    message: z.string().min(1),
  }),
});

const failureResultSchema = z
  .strictObject({
    ...bankIdentity,
    status: failureStatusSchema,
    error: z.strictObject({
      code: failureStatusSchema,
      message: z.string().min(1),
    }),
  })
  .refine((result) => result.error.code === result.status, {
    error: 'error.code deve ser igual ao status.',
    path: ['error', 'code'],
  });

export const bankResultSchema = z.discriminatedUnion('status', [
  successResultSchema,
  rejectedResultSchema,
  failureResultSchema,
]);

export function bankResponded(result: { status: BankStatus }): boolean {
  return result.status === 'success' || result.status === 'rejected';
}

export const simulationResponseSchema = z
  .strictObject({
    requestId: z.uuid(),
    partial: z.boolean(),
    margin: z
      .strictObject({
        consignableCents: cents,
        availableCents: cents,
      })
      .refine((margin) => margin.availableCents <= margin.consignableCents, {
        error: 'A margem disponível não pode passar da margem consignável.',
        path: ['availableCents'],
      }),
    request: z.strictObject({
      requestedAmountCents: cents
        .min(MIN_REQUESTED_AMOUNT_CENTS, { error: 'Valor pedido fora dos limites da simulação.' })
        .max(MAX_REQUESTED_AMOUNT_CENTS, { error: 'Valor pedido fora dos limites da simulação.' }),
      termMonths: z
        .number()
        .int()
        .min(MIN_TERM_MONTHS, { error: 'Prazo fora dos limites da simulação.' })
        .max(MAX_TERM_MONTHS, { error: 'Prazo fora dos limites da simulação.' }),
    }),
    results: z
      .array(bankResultSchema)
      .min(1)
      .superRefine((results, context) => {
        const seen = new Set<string>();

        results.forEach((result, index) => {
          if (seen.has(result.bankId)) {
            context.addIssue({
              code: 'custom',
              message: 'Cada banco deve aparecer uma vez só.',
              path: [index, 'bankId'],
            });
          }

          seen.add(result.bankId);
        });
      }),
  })
  .refine((response) => response.partial === !response.results.every(bankResponded), {
    error: 'partial deve ser verdadeiro só quando algum banco não respondeu.',
    path: ['partial'],
  })
  .superRefine(({ margin, request, results }, context) => {
    results.forEach((result, index) => {
      if (result.status !== 'success') {
        return;
      }

      const { offer } = result;
      const totalCents = offer.installmentCents * request.termMonths;
      const issues: [keyof Offer, boolean, string][] = [
        [
          'maxInstallmentCents',
          offer.maxInstallmentCents === margin.availableCents,
          'maxInstallmentCents deve ser igual à margem disponível.',
        ],
        [
          'totalCents',
          offer.totalCents === totalCents,
          'totalCents deve ser a parcela vezes o prazo.',
        ],
        [
          'totalInterestCents',
          offer.totalInterestCents === Math.max(0, offer.totalCents - request.requestedAmountCents),
          'totalInterestCents deve ser o total menos o valor pedido, sem ficar negativo.',
        ],
        [
          'maxFinanceableCents',
          offer.maxFinanceableCents === null ||
            offer.maxFinanceableCents <= request.requestedAmountCents,
          'maxFinanceableCents não pode passar do valor pedido.',
        ],
      ];

      for (const [field, valid, message] of issues) {
        if (!valid) {
          context.addIssue({ code: 'custom', message, path: ['results', index, 'offer', field] });
        }
      }
    });
  });

export type Offer = z.infer<typeof offerSchema>;
export type BankStatus = z.infer<typeof bankStatusSchema>;
export type BankRejectionReason = z.infer<typeof rejectionReasonSchema>;
export type BankResult = z.infer<typeof bankResultSchema>;
export type SimulationResponse = z.infer<typeof simulationResponseSchema>;
