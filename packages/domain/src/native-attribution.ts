import { z } from 'zod';

export const nativeAttributionStatusSchema = z.enum(['linked', 'partial', 'unmatched']);
export type NativeAttributionStatus = z.infer<typeof nativeAttributionStatusSchema>;

export const nativeAttributionRule = 'last_native_exposure.v1' as const;
export const nativeAttributionSchema = z.object({
  contractVersion: z.literal('native-attribution.v1'),
  attributionId: z.string().uuid(),
  organizationId: z.string().uuid(), businessId: z.string().uuid(), storeId: z.string().uuid(),
  orderId: z.string().uuid(), checkoutId: z.string().uuid(),
  visitorIdentityId: z.string().uuid().nullable(), visitorSessionId: z.string().uuid().nullable(),
  interactionSessionId: z.string().uuid().nullable(), decisionId: z.string().uuid().nullable(), exposureId: z.string().uuid().nullable(),
  compositionId: z.string().min(1).max(80).nullable(), compositionVersion: z.string().min(1).max(40).nullable(),
  rule: z.literal(nativeAttributionRule), status: nativeAttributionStatusSchema,
  currency: z.string().regex(/^[A-Z]{3}$/), revenueAmountMinor: z.string().regex(/^\d+$/),
  purchaseAt: z.coerce.date(),
}).strict();
export type NativeAttribution = z.infer<typeof nativeAttributionSchema>;
