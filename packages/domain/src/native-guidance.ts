import { z } from 'zod';

export const nativeGuidanceModeSchema = z.enum(['discovery', 'comparison', 'product', 'reassurance', 'purchase_readiness']);
export const nativeGuidancePreferenceSchema = z.enum(['available', 'physical', 'digital', 'lower_price']);
export type NativeGuidancePreference = z.infer<typeof nativeGuidancePreferenceSchema>;

export const nativeGuidanceRequestSchema = z.object({
  mode: nativeGuidanceModeSchema,
  preference: nativeGuidancePreferenceSchema.nullable().default(null),
  productId: z.string().uuid().nullable().default(null),
}).strict();
export type NativeGuidanceRequest = z.infer<typeof nativeGuidanceRequestSchema>;

export const nativeGuidanceProductSchema = z.object({
  productId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  amountMinor: z.string().regex(/^\d+$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  availability: z.enum(['unknown', 'available', 'unavailable', 'stale']),
  fulfillmentType: z.enum(['physical', 'digital']),
}).strict();
export type NativeGuidanceProduct = z.infer<typeof nativeGuidanceProductSchema>;

export const nativeGuidanceOptionSchema = z.object({
  preference: nativeGuidancePreferenceSchema,
  label: z.string().trim().min(1).max(100),
}).strict();

export const nativeGuidanceResponseSchema = z.object({
  contractVersion: z.literal('native-guidance.v1'),
  mode: nativeGuidanceModeSchema,
  heading: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(500),
  facts: z.array(z.string().trim().min(1).max(240)).max(6),
  products: z.array(nativeGuidanceProductSchema).max(3),
  options: z.array(nativeGuidanceOptionSchema).max(4),
  fallback: z.boolean(),
}).strict();
export type NativeGuidanceResponse = z.infer<typeof nativeGuidanceResponseSchema>;
