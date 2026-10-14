import { describe, expect, it } from 'vitest';
import { commerceCartSchema, commerceCancellationSchema, commerceCheckoutSchema, commerceOrderSchema, commerceProductSchema, commerceRefundSchema, commerceVariantSchema, moneySchema, providerErrorSchema, providerReceiptSchema } from '@kablet/domain';

describe('provider-neutral commerce contracts', () => {
  it('uses integer minor units and rejects floating-point money', () => {
    expect(moneySchema.parse({ amountMinor: '1099', currency: 'USD' })).toEqual({ amountMinor: '1099', currency: 'USD' });
    expect(() => moneySchema.parse({ amountMinor: 10.99, currency: 'USD' })).toThrow();
  });

  it('represents stale and unknown availability explicitly', () => {
    expect(commerceProductSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', externalId: 'p1', title: 'Product', description: '', status: 'unknown', availability: 'stale', sourceUpdatedAt: null, observedAt: new Date(), ingestionRevision: 1, sourceEvidence: { providerRevision: null, state: 'stale' }, imageUrls: [] }).availability).toBe('stale');
    expect(commerceVariantSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', externalId: 'v1', productExternalId: 'p1', title: 'Default', price: null, availableQuantity: null, availability: 'unknown', sourceUpdatedAt: null, observedAt: new Date(), ingestionRevision: 1, sourceEvidence: { providerRevision: null, state: 'unknown' } }).availableQuantity).toBeNull();
  });

  it('classifies provider failures without exposing provider secrets', () => {
    expect(providerErrorSchema.parse({ kind: 'rate_limited', retryable: true, providerCode: '429', message: 'Shopify request failed' })).toEqual(expect.objectContaining({ retryable: true }));
    expect(() => providerErrorSchema.parse({ kind: 'unknown', retryable: false, providerCode: null, message: 'Shopify request failed' })).not.toThrow();
  });

  it('models commerce execution and outcomes without claiming success', () => {
    expect(commerceCartSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', cartId: 'cart-1', lines: [{ productExternalId: 'p1', variantExternalId: 'v1', quantity: 1 }], state: 'unknown', sourceEvidence: 'unverified' }).state).toBe('unknown');
    expect(commerceCheckoutSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', checkoutId: null, handoffUrl: null, state: 'pending', receipt: null, sourceEvidence: 'unverified' }).state).toBe('pending');
    expect(commerceOrderSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', orderId: 'order-1', lifecycle: 'unknown', total: null, sourceEvidence: 'unverified' }).lifecycle).toBe('unknown');
    expect(commerceRefundSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', refundId: 'refund-1', orderId: 'order-1', amount: null, state: 'unknown', sourceEvidence: 'unverified' }).state).toBe('unknown');
    expect(commerceCancellationSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', orderId: 'order-1', state: 'requested', sourceEvidence: 'unverified' }).state).toBe('requested');
    expect(providerReceiptSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', receiptId: 'receipt-1', operation: 'checkout', state: 'unverified', observedAt: new Date(), evidenceReference: null }).state).toBe('unverified');
  });
});
