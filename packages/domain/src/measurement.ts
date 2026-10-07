import { z } from 'zod';

const uuid = z.string().uuid();
export const conversionMeasurementQuerySchema = z.object({ contractVersion: z.literal('conversion-measurement.v1'), organizationId: uuid, businessId: uuid, conversionDefinitionId: uuid, windowStart: z.coerce.date(), windowEnd: z.coerce.date() }).strict().superRefine((v, ctx) => { if (v.windowStart >= v.windowEnd) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'windowStart must be before windowEnd', path: ['windowEnd'] }); });
export type ConversionMeasurementQuery = z.infer<typeof conversionMeasurementQuerySchema>;

export const conversionMeasurementSchema = z.object({ contractVersion: z.literal('conversion-measurement.v1'), organizationId: uuid, businessId: uuid, conversionDefinitionId: uuid, windowStart: z.coerce.date(), windowEnd: z.coerce.date(), denominatorKind: z.literal('action_confirmation'), eligibleActionConfirmationCount: z.number().int().nonnegative(), conversionCount: z.number().int().nonnegative(), conversionRate: z.number().finite().nonnegative(), attributedConversionCount: z.number().int().nonnegative(), unattributedConversionCount: z.number().int().nonnegative() }).strict().superRefine((v, ctx) => {
  if (v.attributedConversionCount + v.unattributedConversionCount !== v.conversionCount) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'attribution counts must equal conversion count' });
  const expectedRate = v.eligibleActionConfirmationCount === 0 ? 0 : v.conversionCount / v.eligibleActionConfirmationCount;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(expectedRate), Math.abs(v.conversionRate)) * 4;
  if (Math.abs(v.conversionRate - expectedRate) > tolerance) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'conversion rate must match conversion count divided by eligible action confirmations', path: ['conversionRate'] });
});
export type ConversionMeasurement = z.infer<typeof conversionMeasurementSchema>;
