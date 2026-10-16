import { z } from 'zod';
import { nativeProductSkuSchema, nativeStoreCurrencySchema, nativePriceRevisionSchema } from './native-store';

export const nativeCheckoutContractVersion = 'native-checkout.v1' as const;
export const nativeCheckoutLineContractVersion = 'native-checkout-line.v1' as const;
export const nativeReservationContractVersion = 'native-inventory-reservation.v1' as const;
export const nativePaymentBoundaryContractVersion = 'native-payment-boundary.v1' as const;
export const nativeVerifiedOrderBoundaryContractVersion = 'native-verified-order-boundary.v1' as const;

const uuidSchema = z.string().uuid();
const amountMinorSchema = z.string().regex(/^\d+$/, 'amountMinor must be a non-negative integer string');
const positiveAmountMinorSchema = z.string().regex(/^[1-9]\d*$/, 'amountMinor must be a positive integer string');
const quantitySchema = z.number().int().positive();
const revisionSchema = z.number().int().positive();

export const nativeFulfillmentTypeSchema = z.enum(['physical', 'digital']);
export type NativeFulfillmentType = z.infer<typeof nativeFulfillmentTypeSchema>;

export const nativeCheckoutStatusSchema = z.enum([
  'created', 'awaiting_confirmation', 'reservation_pending', 'reserved', 'payment_pending',
  'payment_unknown', 'failed', 'expired', 'cancelled', 'completed',
]);
export type NativeCheckoutStatus = z.infer<typeof nativeCheckoutStatusSchema>;

export const nativeReservationStatusSchema = z.enum(['active', 'committed', 'released', 'expired', 'unknown']);
export type NativeReservationStatus = z.infer<typeof nativeReservationStatusSchema>;

export const nativePaymentStatusSchema = z.enum(['created', 'pending', 'authorized', 'paid', 'failed', 'unknown', 'cancelled', 'refunded']);
export type NativePaymentStatus = z.infer<typeof nativePaymentStatusSchema>;

export const nativeCheckoutErrorCodeSchema = z.enum([
  'checkout_not_found', 'checkout_expired', 'cart_empty', 'cart_version_conflict',
  'product_unpublished', 'product_unavailable', 'insufficient_inventory', 'price_changed',
  'currency_mismatch', 'policy_unavailable', 'shipping_unavailable', 'idempotency_conflict',
  'reservation_not_found', 'reservation_not_expired', 'reservation_quarantined', 'invalid_transition',
]);
export type NativeCheckoutErrorCode = z.infer<typeof nativeCheckoutErrorCodeSchema>;

export const nativeShippingEligibilitySchema = z.enum(['not_required', 'pending', 'eligible', 'ineligible', 'unavailable']);
export type NativeShippingEligibility = z.infer<typeof nativeShippingEligibilitySchema>;

const chargeSnapshotSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('not_calculated'), amountMinor: z.null(), currency: z.null() }).strict(),
  z.object({ state: z.literal('calculated'), amountMinor: amountMinorSchema, currency: nativeStoreCurrencySchema }).strict(),
  z.object({ state: z.literal('unavailable'), amountMinor: z.null(), currency: z.null() }).strict(),
]);
export type NativeChargeSnapshot = z.infer<typeof chargeSnapshotSchema>;

export const nativeCheckoutContactSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(64).nullable(),
}).strict();
export type NativeCheckoutContact = z.infer<typeof nativeCheckoutContactSchema>;

export const nativeShippingAddressSchema = z.object({
  recipientName: z.string().trim().min(1).max(200),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).nullable(),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(32),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
}).strict();
export type NativeShippingAddress = z.infer<typeof nativeShippingAddressSchema>;

export const nativeCheckoutLineSchema = z.object({
  contractVersion: z.literal(nativeCheckoutLineContractVersion),
  lineId: uuidSchema,
  checkoutId: uuidSchema,
  storeId: uuidSchema,
  productId: uuidSchema,
  fulfillmentType: nativeFulfillmentTypeSchema,
  sku: nativeProductSkuSchema,
  quantity: quantitySchema,
  unitAmountMinor: amountMinorSchema,
  lineAmountMinor: amountMinorSchema,
  currency: nativeStoreCurrencySchema,
  priceRevision: nativePriceRevisionSchema,
  productTitleSnapshot: z.string().trim().min(1).max(200),
}).strict().superRefine((line, context) => {
  try {
    if (BigInt(line.unitAmountMinor) * BigInt(line.quantity) !== BigInt(line.lineAmountMinor)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['lineAmountMinor'], message: 'line amount must equal unit amount multiplied by quantity' });
    }
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['lineAmountMinor'], message: 'line amount is invalid' });
  }
});
export type NativeCheckoutLine = z.infer<typeof nativeCheckoutLineSchema>;

export const nativeCheckoutSessionSchema = z.object({
  contractVersion: z.literal(nativeCheckoutContractVersion),
  checkoutId: uuidSchema,
  storeId: uuidSchema,
  cartId: uuidSchema,
  cartVersion: z.number().int().nonnegative(),
  checkoutRevision: revisionSchema,
  fulfillmentType: nativeFulfillmentTypeSchema,
  status: nativeCheckoutStatusSchema,
  currency: nativeStoreCurrencySchema,
  contact: nativeCheckoutContactSchema.nullable(),
  shippingAddress: nativeShippingAddressSchema.nullable(),
  shippingEligibility: nativeShippingEligibilitySchema,
  shippingCharge: chargeSnapshotSchema,
  tax: chargeSnapshotSchema,
  serverTotal: chargeSnapshotSchema,
  customerConfirmationRevision: revisionSchema.nullable(),
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lines: z.array(nativeCheckoutLineSchema),
}).strict().superRefine((checkout, context) => {
  checkout.lines.forEach((line, index) => {
    if (line.checkoutId !== checkout.checkoutId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, 'checkoutId'], message: 'checkout line does not belong to checkout' });
    if (line.storeId !== checkout.storeId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, 'storeId'], message: 'checkout line does not belong to store' });
    if (line.currency !== checkout.currency) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, 'currency'], message: 'checkout line currency must match checkout currency' });
  });
  if (checkout.fulfillmentType === 'physical' && checkout.shippingEligibility === 'eligible' && !checkout.shippingAddress) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['shippingAddress'], message: 'physical eligible checkout requires a shipping address' });
  }
});
export type NativeCheckoutSession = z.infer<typeof nativeCheckoutSessionSchema>;

export const nativeCheckoutConfirmationSchema = z.object({
  checkoutId: uuidSchema,
  checkoutRevision: revisionSchema,
  contact: nativeCheckoutContactSchema,
  shippingAddress: nativeShippingAddressSchema,
  shippingEligibility: z.literal('eligible'),
  serverTotal: z.object({ state: z.literal('calculated'), amountMinor: amountMinorSchema, currency: nativeStoreCurrencySchema }).strict(),
}).strict();
export type NativeCheckoutConfirmation = z.infer<typeof nativeCheckoutConfirmationSchema>;

export const nativeInventoryReservationSchema = z.object({
  contractVersion: z.literal(nativeReservationContractVersion),
  reservationId: uuidSchema,
  checkoutId: uuidSchema,
  checkoutLineId: uuidSchema,
  storeId: uuidSchema,
  productId: uuidSchema,
  sku: nativeProductSkuSchema,
  quantity: quantitySchema,
  status: nativeReservationStatusSchema,
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  committedAt: z.coerce.date().nullable(),
  releasedAt: z.coerce.date().nullable(),
}).strict();
export type NativeInventoryReservation = z.infer<typeof nativeInventoryReservationSchema>;

export const nativePaymentBoundarySchema = z.object({
  contractVersion: z.literal(nativePaymentBoundaryContractVersion),
  paymentId: uuidSchema,
  checkoutId: uuidSchema,
  providerKey: z.string().trim().regex(/^[a-z0-9._-]+$/).max(100),
  merchantAccountReference: z.string().trim().min(1).max(300),
  providerSessionReference: z.string().trim().max(300).nullable(),
  amountMinor: positiveAmountMinorSchema,
  currency: nativeStoreCurrencySchema,
  status: nativePaymentStatusSchema,
  idempotencyKey: z.string().trim().min(1).max(200),
  evidenceType: z.enum(['none', 'authenticated_callback', 'server_reconciliation']).nullable(),
  evidenceReference: z.string().trim().max(500).nullable(),
}).strict().superRefine((payment, context) => {
  if (payment.status === 'paid' && (!payment.evidenceType || payment.evidenceType === 'none' || !payment.evidenceReference)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['evidenceType'], message: 'paid payment requires authenticated evidence' });
  }
});
export type NativePaymentBoundary = z.infer<typeof nativePaymentBoundarySchema>;

export const nativeVerifiedOrderBoundarySchema = z.object({
  contractVersion: z.literal(nativeVerifiedOrderBoundaryContractVersion),
  orderId: uuidSchema,
  checkoutId: uuidSchema,
  paymentId: uuidSchema,
  paymentStatus: z.literal('paid'),
  evidenceType: z.enum(['authenticated_callback', 'server_reconciliation']),
  evidenceReference: z.string().trim().min(1).max(500),
  verifiedAt: z.coerce.date(),
}).strict();
export type NativeVerifiedOrderBoundary = z.infer<typeof nativeVerifiedOrderBoundarySchema>;

const checkoutTransitions: Record<NativeCheckoutStatus, readonly NativeCheckoutStatus[]> = {
  created: ['awaiting_confirmation', 'expired', 'cancelled'],
  awaiting_confirmation: ['reservation_pending', 'expired', 'cancelled'],
  reservation_pending: ['reserved', 'failed', 'expired', 'cancelled'],
  reserved: ['payment_pending', 'payment_unknown', 'expired', 'cancelled'],
  payment_pending: ['payment_unknown', 'failed', 'expired', 'cancelled'],
  payment_unknown: ['payment_pending', 'failed', 'expired', 'cancelled', 'completed'],
  failed: [], expired: [], cancelled: [], completed: [],
};

export function transitionNativeCheckout(current: NativeCheckoutStatus, next: NativeCheckoutStatus): NativeCheckoutStatus {
  if (!checkoutTransitions[current].includes(next)) throw new Error(`invalid checkout transition: ${current} -> ${next}`);
  return next;
}

const reservationTransitions: Record<NativeReservationStatus, readonly NativeReservationStatus[]> = {
  active: ['committed', 'released', 'expired', 'unknown'],
  unknown: ['committed', 'released', 'expired'],
  committed: [], released: [], expired: [],
};

export function transitionNativeReservation(current: NativeReservationStatus, next: NativeReservationStatus): NativeReservationStatus {
  if (!reservationTransitions[current].includes(next)) throw new Error(`invalid reservation transition: ${current} -> ${next}`);
  return next;
}

const paymentTransitions: Record<NativePaymentStatus, readonly NativePaymentStatus[]> = {
  created: ['pending', 'failed', 'cancelled', 'unknown'],
  pending: ['authorized', 'paid', 'failed', 'cancelled', 'unknown'],
  authorized: ['paid', 'failed', 'unknown'],
  unknown: ['pending', 'paid', 'failed', 'cancelled'],
  paid: ['refunded'], failed: [], cancelled: [], refunded: [],
};

export function transitionNativePayment(current: NativePaymentStatus, next: NativePaymentStatus): NativePaymentStatus {
  if (!paymentTransitions[current].includes(next)) throw new Error(`invalid payment transition: ${current} -> ${next}`);
  return next;
}
