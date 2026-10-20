import { z } from 'zod';

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
  });

export const bankStatusSchema = z.enum(['success', 'timeout', 'unavailable', 'invalid-response']);

const bankIdentity = {
  bankId: z.string().min(1),
  bankName: z.string().min(1),
};

const successResultSchema = z.strictObject({
  ...bankIdentity,
  status: z.literal('success'),
  offer: offerSchema,
});

const failureResultSchema = z
  .strictObject({
    ...bankIdentity,
    status: bankStatusSchema.exclude(['success']),
    error: z.strictObject({
      code: bankStatusSchema.exclude(['success']),
      message: z.string().min(1),
    }),
  })
  .refine((result) => result.error.code === result.status, {
    error: 'error.code deve ser igual ao status.',
    path: ['error', 'code'],
  });

export const bankResultSchema = z.discriminatedUnion('status', [
  successResultSchema,
  failureResultSchema,
]);

export const simulationResponseSchema = z
  .strictObject({
    requestId: z.uuid(),
    partial: z.boolean(),
    margin: z.strictObject({
      consignableCents: cents,
      availableCents: cents,
    }),
    request: z.strictObject({
      requestedAmountCents: cents,
      termMonths: z.number().int().positive(),
    }),
    results: z.array(bankResultSchema).min(1),
  })
  .refine(
    (response) =>
      response.partial === response.results.some((result) => result.status !== 'success'),
    { error: 'partial deve ser verdadeiro só quando algum banco falhou.', path: ['partial'] },
  );

export type Offer = z.infer<typeof offerSchema>;
export type BankStatus = z.infer<typeof bankStatusSchema>;
export type BankResult = z.infer<typeof bankResultSchema>;
export type SimulationResponse = z.infer<typeof simulationResponseSchema>;
