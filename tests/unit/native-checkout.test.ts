import { describe, expect, it } from 'vitest';
import {
  nativeCheckoutLineSchema,
  nativeCheckoutSessionSchema,
  nativeInventoryReservationSchema,
  nativePaymentBoundarySchema,
  transitionNativeCheckout,
  transitionNativePayment,
  transitionNativeReservation,
} from '@kablet/domain';

const ids = {
  storeId: '00000000-0000-4000-8000-000000000001',
  cartId: '00000000-0000-4000-8000-000000000002',
  checkoutId: '00000000-0000-4000-8000-000000000003',
  lineId: '00000000-0000-4000-8000-000000000004',
  productId: '00000000-0000-4000-8000-000000000005',
  reservationId: '00000000-0000-4000-8000-000000000006',
};

const line = {
  contractVersion: 'native-checkout-line.v1' as const,
  lineId: ids.lineId,
  checkoutId: ids.checkoutId,
  storeId: ids.storeId,
  productId: ids.productId,
  fulfillmentType: 'physical' as const,
  sku: 'VELORA-001',
  quantity: 2,
  unitAmountMinor: '2400',
  lineAmountMinor: '4800',
  currency: 'USD',
  priceRevision: 1,
  productTitleSnapshot: 'Botanical Veil Cleanser',
};

describe('native checkout and reservation contracts', () => {
  it('accepts a physical checkout with explicit not-calculated charges', () => {
    const checkout = nativeCheckoutSessionSchema.parse({
      contractVersion: 'native-checkout.v1', checkoutId: ids.checkoutId, storeId: ids.storeId, cartId: ids.cartId,
      cartVersion: 4, checkoutRevision: 1, fulfillmentType: 'physical', status: 'created', currency: 'USD',
      contact: null, shippingAddress: null, shippingEligibility: 'pending',
      shippingCharge: { state: 'not_calculated', amountMinor: null, currency: null },
      tax: { state: 'not_calculated', amountMinor: null, currency: null },
      serverTotal: { state: 'not_calculated', amountMinor: null, currency: null },
      customerConfirmationRevision: null, expiresAt: new Date('2026-11-01T00:00:00Z'),
      createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-01T00:00:00Z'), lines: [line],
    });
    expect(checkout.lines[0].lineAmountMinor).toBe('4800');
  });

  it('rejects malformed totals, zero quantities, unknown fields, and incomplete physical confirmation', () => {
    expect(() => nativeCheckoutLineSchema.parse({ ...line, quantity: 0 })).toThrow();
    expect(() => nativeCheckoutLineSchema.parse({ ...line, lineAmountMinor: '2400' })).toThrow();
    expect(() => nativeCheckoutLineSchema.parse({ ...line, tenantId: 'should-not-be-accepted' })).toThrow();
    expect(() => nativeCheckoutSessionSchema.parse({
      contractVersion: 'native-checkout.v1', checkoutId: ids.checkoutId, storeId: ids.storeId, cartId: ids.cartId,
      cartVersion: 1, checkoutRevision: 1, fulfillmentType: 'physical', status: 'awaiting_confirmation', currency: 'USD',
      contact: null, shippingAddress: null, shippingEligibility: 'eligible',
      shippingCharge: { state: 'calculated', amountMinor: '0', currency: 'USD' },
      tax: { state: 'calculated', amountMinor: '0', currency: 'USD' },
      serverTotal: { state: 'calculated', amountMinor: '0', currency: 'USD' },
      customerConfirmationRevision: 1, expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date(), lines: [line],
    })).toThrow();
  });

  it('enforces checkout, reservation, and payment state transitions', () => {
    expect(transitionNativeCheckout('created', 'awaiting_confirmation')).toBe('awaiting_confirmation');
    expect(transitionNativeCheckout('payment_unknown', 'completed')).toBe('completed');
    expect(() => transitionNativeCheckout('completed', 'payment_pending')).toThrow();
    expect(transitionNativeReservation('active', 'unknown')).toBe('unknown');
    expect(() => transitionNativeReservation('committed', 'active')).toThrow();
    expect(transitionNativePayment('unknown', 'paid')).toBe('paid');
    expect(() => transitionNativePayment('paid', 'pending')).toThrow();
  });

  it('requires physical reservation identity and authenticated evidence before paid status', () => {
    const reservation = nativeInventoryReservationSchema.parse({
      contractVersion: 'native-inventory-reservation.v1', reservationId: ids.reservationId, checkoutId: ids.checkoutId,
      checkoutLineId: ids.lineId, storeId: ids.storeId, productId: ids.productId, sku: 'VELORA-001', quantity: 1,
      status: 'active', expiresAt: new Date('2026-10-01T00:10:00Z'), createdAt: new Date(), updatedAt: new Date(),
      committedAt: null, releasedAt: null,
    });
    expect(reservation.status).toBe('active');
    expect(() => nativePaymentBoundarySchema.parse({
      contractVersion: 'native-payment-boundary.v1', paymentId: ids.reservationId, checkoutId: ids.checkoutId,
      providerKey: 'merchant.provider', merchantAccountReference: 'merchant-account', providerSessionReference: null,
      amountMinor: '4800', currency: 'USD', status: 'paid', idempotencyKey: 'payment-1', evidenceType: 'none', evidenceReference: null,
    })).toThrow();
    expect(nativePaymentBoundarySchema.parse({
      contractVersion: 'native-payment-boundary.v1', paymentId: ids.reservationId, checkoutId: ids.checkoutId,
      providerKey: 'merchant.provider', merchantAccountReference: 'merchant-account', providerSessionReference: 'session-1',
      amountMinor: '4800', currency: 'USD', status: 'paid', idempotencyKey: 'payment-1', evidenceType: 'authenticated_callback', evidenceReference: 'event-1',
    }).status).toBe('paid');
  });
});
