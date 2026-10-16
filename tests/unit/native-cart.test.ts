import { describe, expect, it } from 'vitest';
import { nativeCartErrorSchema, nativeCartLineSchema, nativeCartMutationSchema, nativeCartSchema } from '@kablet/domain';

const ids = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  businessId: '00000000-0000-4000-8000-000000000002',
  storeId: '00000000-0000-4000-8000-000000000003',
  cartId: '00000000-0000-4000-8000-000000000004',
  lineId: '00000000-0000-4000-8000-000000000005',
  productId: '00000000-0000-4000-8000-000000000006',
};

const snapshot = { sku: 'VELORA-001', amountMinor: '2400', currency: 'USD', priceRevision: 1 };
const dates = { expiresAt: new Date('2026-11-01T00:00:00.000Z'), lastActivityAt: new Date('2026-10-01T00:00:00.000Z') };

describe('native cart contracts', () => {
  it('accepts a versioned cart with a price-bound acceptance record', () => {
    const cart = nativeCartSchema.parse({
      contractVersion: 'native-cart.v1', organizationId: ids.organizationId, businessId: ids.businessId, storeId: ids.storeId, cartId: ids.cartId, currency: 'USD', status: 'active', version: 2, ...dates,
      lines: [{ contractVersion: 'native-cart-line.v1', lineId: ids.lineId, cartId: ids.cartId, storeId: ids.storeId, productId: ids.productId, quantity: 1, originalPrice: snapshot, currentPrice: { ...snapshot, amountMinor: '2600', priceRevision: 2 }, priceAcceptance: { acceptedAmountMinor: '2600', acceptedCurrency: 'USD', acceptedPriceRevision: 2, acceptedAt: new Date('2026-10-02T00:00:00.000Z') }, status: 'stale_price', currentTitle: 'Botanical Veil Cleanser', currentImageUrl: null }],
    });
    expect(cart.lines[0].priceAcceptance?.acceptedPriceRevision).toBe(2);
  });

  it('rejects invalid quantity, price revision, currency consistency, and fingerprints', () => {
    expect(() => nativeCartLineSchema.parse({ contractVersion: 'native-cart-line.v1', lineId: ids.lineId, cartId: ids.cartId, storeId: ids.storeId, productId: ids.productId, quantity: 0, originalPrice: snapshot, currentPrice: null, priceAcceptance: null, status: 'active', currentTitle: 'Product', currentImageUrl: null })).toThrow();
    expect(() => nativeCartLineSchema.parse({ contractVersion: 'native-cart-line.v1', lineId: ids.lineId, cartId: ids.cartId, storeId: ids.storeId, productId: ids.productId, quantity: 1, originalPrice: { ...snapshot, priceRevision: 0 }, currentPrice: null, priceAcceptance: null, status: 'active', currentTitle: 'Product', currentImageUrl: null })).toThrow();
    expect(() => nativeCartSchema.parse({ contractVersion: 'native-cart.v1', organizationId: ids.organizationId, businessId: ids.businessId, storeId: ids.storeId, cartId: ids.cartId, currency: 'EUR', status: 'active', version: 0, ...dates, lines: [{ contractVersion: 'native-cart-line.v1', lineId: ids.lineId, cartId: ids.cartId, storeId: ids.storeId, productId: ids.productId, quantity: 1, originalPrice: snapshot, currentPrice: null, priceAcceptance: null, status: 'active', currentTitle: 'Product', currentImageUrl: null }] })).toThrow();
    expect(() => nativeCartMutationSchema.parse({ contractVersion: 'native-cart-mutation.v1', operation: 'add_line', cartId: ids.cartId, idempotencyKey: 'retry-1', requestFingerprint: 'not-a-sha', expectedCartVersion: 0, lineId: null, productId: ids.productId, quantity: 1 })).toThrow();
  });

  it('requires acceptance to carry the exact current revision and amount fields', () => {
    const acceptance = { acceptedAmountMinor: '2600', acceptedCurrency: 'USD', acceptedPriceRevision: 2, acceptedAt: new Date() };
    const line = nativeCartLineSchema.parse({ contractVersion: 'native-cart-line.v1', lineId: ids.lineId, cartId: ids.cartId, storeId: ids.storeId, productId: ids.productId, quantity: 1, originalPrice: snapshot, currentPrice: { ...snapshot, amountMinor: '2600', priceRevision: 2 }, priceAcceptance: acceptance, status: 'active', currentTitle: 'Product', currentImageUrl: null });
    expect(line.priceAcceptance).toEqual(acceptance);
    expect(nativeCartErrorSchema.parse({ contractVersion: 'native-cart-mutation.v1', code: 'price_changed', message: 'Price changed.', cartVersion: 3 }).code).toBe('price_changed');
  });
});
