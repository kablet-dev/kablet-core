import { describe, expect, it } from 'vitest';
import { nativeOrderCommitResultSchema, nativeVerifiedOrderSchema } from '@kablet/domain';

const ids = {
  order: '10000000-0000-4000-8000-000000000001',
  line: '10000000-0000-4000-8000-000000000002',
  org: '10000000-0000-4000-8000-000000000003',
  business: '10000000-0000-4000-8000-000000000004',
  store: '10000000-0000-4000-8000-000000000005',
  checkout: '10000000-0000-4000-8000-000000000006',
  cart: '10000000-0000-4000-8000-000000000007',
  payment: '10000000-0000-4000-8000-000000000008',
  account: '10000000-0000-4000-8000-000000000009',
  evidence: '10000000-0000-4000-8000-000000000010',
};

function order() {
  const now = new Date();
  return {
    contractVersion: 'native-order.v1' as const, orderId: ids.order, publicReference: 'KBL-10000000000040008000000000000001',
    organizationId: ids.org, businessId: ids.business, storeId: ids.store, checkoutId: ids.checkout, cartId: ids.cart,
    paymentId: ids.payment, merchantPaymentAccountId: ids.account, evidenceId: ids.evidence, fulfillmentType: 'physical' as const,
    currency: 'USD', subtotalAmountMinor: '2400', shippingAmountMinor: '0', taxAmountMinor: '0', totalAmountMinor: '2400',
    paymentStatus: 'verified_captured' as const, fulfillmentStatus: 'pending' as const, verifiedAt: now, createdAt: now, updatedAt: now,
    lines: [{ contractVersion: 'native-order-line.v1' as const, lineId: ids.line, orderId: ids.order, productId: ids.line,
      fulfillmentType: 'physical' as const, sku: 'ORD-001', quantity: 1, unitAmountMinor: '2400', lineAmountMinor: '2400',
      currency: 'USD', priceRevision: 1, productTitleSnapshot: 'Order product', shippingAmountMinor: '0', taxAmountMinor: '0' }],
  };
}

describe('native verified order contracts', () => {
  it('accepts an immutable captured order and commit result', () => {
    const parsed = nativeVerifiedOrderSchema.parse(order());
    expect(parsed.paymentStatus).toBe('verified_captured');
    expect(nativeOrderCommitResultSchema.parse({ contractVersion: 'native-order-commit-result.v1', order: parsed, idempotent: false, recoveryRequired: false, recoveryId: null, recoveryReason: null }).order?.orderId).toBe(ids.order);
  });

  it('rejects fabricated totals, unknown fields, and incomplete recovery results', () => {
    expect(() => nativeVerifiedOrderSchema.parse({ ...order(), totalAmountMinor: '2500' })).toThrow();
    expect(() => nativeVerifiedOrderSchema.parse({ ...order(), fabricatedPaid: true })).toThrow();
    expect(() => nativeOrderCommitResultSchema.parse({ contractVersion: 'native-order-commit-result.v1', order: null, idempotent: false, recoveryRequired: true, recoveryId: null, recoveryReason: null })).toThrow();
  });
});
