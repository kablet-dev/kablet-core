import { z } from 'zod';
import { nativeFulfillmentTypeSchema } from './native-checkout';
import { nativeProductSkuSchema } from './native-store';

export const nativeOrderContractVersion = 'native-order.v1' as const;
export const nativeOrderLineContractVersion = 'native-order-line.v1' as const;
export const nativeOrderCommitResultContractVersion = 'native-order-commit-result.v1' as const;
const uuidSchema = z.string().uuid();
const amountMinorSchema = z.string().regex(/^\d+$/, 'amountMinor must be a non-negative integer string');

export const nativeOrderFulfillmentStatusSchema = z.enum(['pending', 'processing', 'fulfilled', 'cancelled']);
export type NativeOrderFulfillmentStatus = z.infer<typeof nativeOrderFulfillmentStatusSchema>;

export const nativeOrderLineSchema = z.object({
  contractVersion: z.literal(nativeOrderLineContractVersion), lineId: uuidSchema, orderId: uuidSchema,
  productId: uuidSchema, fulfillmentType: nativeFulfillmentTypeSchema, sku: nativeProductSkuSchema,
  quantity: z.number().int().positive(), unitAmountMinor: amountMinorSchema, lineAmountMinor: amountMinorSchema,
  currency: z.string().regex(/^[A-Z]{3}$/), priceRevision: z.number().int().positive(),
  productTitleSnapshot: z.string().trim().min(1).max(200), shippingAmountMinor: amountMinorSchema, taxAmountMinor: amountMinorSchema,
}).strict().superRefine((line, context) => {
  if (BigInt(line.unitAmountMinor) * BigInt(line.quantity) !== BigInt(line.lineAmountMinor)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['lineAmountMinor'], message: 'line amount must equal unit amount multiplied by quantity' });
  }
});
export type NativeOrderLine = z.infer<typeof nativeOrderLineSchema>;

export const nativeVerifiedOrderSchema = z.object({
  contractVersion: z.literal(nativeOrderContractVersion), orderId: uuidSchema, publicReference: z.string().regex(/^KBL-[A-Z0-9]+$/),
  organizationId: uuidSchema, businessId: uuidSchema, storeId: uuidSchema, checkoutId: uuidSchema, cartId: uuidSchema,
  paymentId: uuidSchema, merchantPaymentAccountId: uuidSchema, evidenceId: uuidSchema, fulfillmentType: z.enum(['physical', 'digital', 'mixed']),
  currency: z.string().regex(/^[A-Z]{3}$/), subtotalAmountMinor: amountMinorSchema, shippingAmountMinor: amountMinorSchema,
  taxAmountMinor: amountMinorSchema, totalAmountMinor: amountMinorSchema, paymentStatus: z.literal('verified_captured'),
  fulfillmentStatus: nativeOrderFulfillmentStatusSchema, verifiedAt: z.coerce.date(), createdAt: z.coerce.date(), updatedAt: z.coerce.date(),
  lines: z.array(nativeOrderLineSchema).min(1),
}).strict().superRefine((order, context) => {
  let subtotal = 0n, shipping = 0n, tax = 0n;
  for (const [index, line] of order.lines.entries()) {
    if (line.orderId !== order.orderId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, 'orderId'], message: 'order line does not belong to order' });
    if (line.currency !== order.currency) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, 'currency'], message: 'order line currency must match order' });
    subtotal += BigInt(line.lineAmountMinor); shipping += BigInt(line.shippingAmountMinor); tax += BigInt(line.taxAmountMinor);
  }
  if (subtotal !== BigInt(order.subtotalAmountMinor)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['subtotalAmountMinor'], message: 'subtotal does not match order lines' });
  if (shipping !== BigInt(order.shippingAmountMinor)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['shippingAmountMinor'], message: 'shipping total does not match order lines' });
  if (tax !== BigInt(order.taxAmountMinor)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['taxAmountMinor'], message: 'tax total does not match order lines' });
  if (subtotal + shipping + tax !== BigInt(order.totalAmountMinor)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['totalAmountMinor'], message: 'total does not match order components' });
});
export type NativeVerifiedOrder = z.infer<typeof nativeVerifiedOrderSchema>;

export const nativeOrderCommitResultSchema = z.object({
  contractVersion: z.literal(nativeOrderCommitResultContractVersion), order: nativeVerifiedOrderSchema.nullable(), idempotent: z.boolean(),
  recoveryRequired: z.boolean(), recoveryId: uuidSchema.nullable(),
  recoveryReason: z.enum(['reservation_expired', 'inventory_unavailable', 'quarantined_reservation', 'invalid_checkout', 'payment_state_uncertain']).nullable(),
}).strict().superRefine((result, context) => {
  if (result.recoveryRequired && (!result.recoveryId || !result.recoveryReason || result.order !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['recoveryRequired'], message: 'recovery result requires a recovery record and no order' });
  }
  if (!result.recoveryRequired && !result.order) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['order'], message: 'successful commitment requires an order' });
  }
});
export type NativeOrderCommitResult = z.infer<typeof nativeOrderCommitResultSchema>;
