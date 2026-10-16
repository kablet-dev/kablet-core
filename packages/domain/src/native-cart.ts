import { z } from 'zod';
import { nativeStoreCurrencySchema, nativeProductSkuSchema, nativePriceRevisionSchema } from './native-store';

export const nativeCartContractVersion = 'native-cart.v1' as const;
export const nativeCartLineContractVersion = 'native-cart-line.v1' as const;
export const nativeCartMutationContractVersion = 'native-cart-mutation.v1' as const;

const uuidSchema = z.string().uuid();
const amountMinorSchema = z.string().regex(/^\d+$/, 'amountMinor must be a non-negative integer string');

export const nativeCartLifecycleSchema = z.enum(['active', 'expired']);
export type NativeCartLifecycle = z.infer<typeof nativeCartLifecycleSchema>;

export const nativeCartLineStatusSchema = z.enum(['active', 'stale_price', 'unavailable', 'unpublished', 'expired']);
export type NativeCartLineStatus = z.infer<typeof nativeCartLineStatusSchema>;

export const nativeCartMutationOperationSchema = z.enum(['add_line', 'update_line', 'remove_line', 'accept_price']);
export type NativeCartMutationOperation = z.infer<typeof nativeCartMutationOperationSchema>;

export const nativeCartPriceSnapshotSchema = z.object({
  sku: nativeProductSkuSchema,
  amountMinor: amountMinorSchema,
  currency: nativeStoreCurrencySchema,
  priceRevision: nativePriceRevisionSchema,
}).strict();
export type NativeCartPriceSnapshot = z.infer<typeof nativeCartPriceSnapshotSchema>;

export const nativeCartPriceAcceptanceSchema = z.object({
  acceptedAmountMinor: amountMinorSchema,
  acceptedCurrency: nativeStoreCurrencySchema,
  acceptedPriceRevision: nativePriceRevisionSchema,
  acceptedAt: z.coerce.date(),
}).strict();
export type NativeCartPriceAcceptance = z.infer<typeof nativeCartPriceAcceptanceSchema>;

export const nativeCartIdentitySchema = z.object({
  contractVersion: z.literal(nativeCartContractVersion),
  cartId: uuidSchema,
  storeId: uuidSchema,
  organizationId: uuidSchema,
  businessId: uuidSchema,
  currency: nativeStoreCurrencySchema,
  status: nativeCartLifecycleSchema,
  version: z.number().int().nonnegative(),
  expiresAt: z.coerce.date(),
  lastActivityAt: z.coerce.date(),
}).strict();
export type NativeCartIdentity = z.infer<typeof nativeCartIdentitySchema>;

export const nativeCartLineSchema = z.object({
  contractVersion: z.literal(nativeCartLineContractVersion),
  lineId: uuidSchema,
  cartId: uuidSchema,
  storeId: uuidSchema,
  productId: uuidSchema,
  quantity: z.number().int().positive(),
  originalPrice: nativeCartPriceSnapshotSchema,
  currentPrice: nativeCartPriceSnapshotSchema.nullable(),
  priceAcceptance: nativeCartPriceAcceptanceSchema.nullable(),
  status: nativeCartLineStatusSchema,
  currentTitle: z.string().trim().min(1).max(200).nullable(),
  currentImageUrl: z.string().url().nullable(),
}).strict().superRefine((line, context) => {
  if (line.priceAcceptance) {
    if (!line.currentPrice) context.addIssue({ code: z.ZodIssueCode.custom, path: ['priceAcceptance'], message: 'price acceptance requires a current price' });
    else if (line.priceAcceptance.acceptedAmountMinor !== line.currentPrice.amountMinor
      || line.priceAcceptance.acceptedCurrency !== line.currentPrice.currency
      || line.priceAcceptance.acceptedPriceRevision !== line.currentPrice.priceRevision) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['priceAcceptance'], message: 'price acceptance must match the current price revision and amount' });
    }
  }
});
export type NativeCartLine = z.infer<typeof nativeCartLineSchema>;

export const nativeCartSchema = nativeCartIdentitySchema.extend({
  lines: z.array(nativeCartLineSchema),
}).superRefine((cart, context) => {
  cart.lines.forEach((line, index) => {
    if (line.cartId !== cart.cartId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, 'cartId'], message: 'cart line does not belong to cart' });
    if (line.storeId !== cart.storeId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, 'storeId'], message: 'cart line does not belong to store' });
    if (line.originalPrice.currency !== cart.currency) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, 'originalPrice', 'currency'], message: 'cart line currency must match cart currency' });
    if (line.currentPrice && line.currentPrice.currency !== cart.currency) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, 'currentPrice', 'currency'], message: 'current price currency must match cart currency' });
  });
});
export type NativeCart = z.infer<typeof nativeCartSchema>;

export const nativeCartMutationSchema = z.object({
  contractVersion: z.literal(nativeCartMutationContractVersion),
  operation: nativeCartMutationOperationSchema,
  cartId: uuidSchema,
  idempotencyKey: z.string().trim().min(1).max(200),
  requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/, 'requestFingerprint must be a SHA-256 hex digest'),
  expectedCartVersion: z.number().int().nonnegative().nullable(),
  lineId: uuidSchema.nullable(),
  productId: uuidSchema.nullable(),
  quantity: z.number().int().positive().nullable(),
}).strict();
export type NativeCartMutation = z.infer<typeof nativeCartMutationSchema>;

export const nativeCartErrorCodeSchema = z.enum([
  'cart_not_found', 'cart_expired', 'product_not_sellable', 'product_unpublished',
  'product_unavailable', 'insufficient_inventory', 'price_changed', 'currency_mismatch',
  'cart_version_conflict', 'idempotency_conflict', 'invalid_mutation',
]);
export type NativeCartErrorCode = z.infer<typeof nativeCartErrorCodeSchema>;

export const nativeCartErrorSchema = z.object({
  contractVersion: z.literal(nativeCartMutationContractVersion),
  code: nativeCartErrorCodeSchema,
  message: z.string().trim().min(1).max(500),
  cartVersion: z.number().int().nonnegative().nullable(),
}).strict();
export type NativeCartError = z.infer<typeof nativeCartErrorSchema>;
