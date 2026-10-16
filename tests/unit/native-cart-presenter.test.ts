import { describe, expect, it } from 'vitest';
import { nativeCartItemCount, nativeCartLineStatusLabel, nativeCartSubtotalMinor, isNativeProductSellable } from '../../apps/web/lib/native-cart-presenter';
import type { NativeCart, NativeCartLine, NativeProduct } from '@kablet/domain';

const product: NativeProduct = {
  id: '85000000-0000-4000-8000-000000000002', storeId: '85000000-0000-4000-8000-000000000001', slug: 'first', sku: 'FIRST-001', title: 'First Product', description: 'A published product.', imageUrl: null, amountMinor: '1200', currency: 'USD', inventoryQuantity: 4, priceRevision: 1, status: 'published', availability: 'available',
};

const line: NativeCartLine = {
  contractVersion: 'native-cart-line.v1', lineId: '85000000-0000-4000-8000-000000000006', cartId: '85000000-0000-4000-8000-000000000003', storeId: product.storeId, productId: product.id, quantity: 2, originalPrice: { sku: product.sku, amountMinor: '1000', currency: 'USD', priceRevision: 1 }, currentPrice: { sku: product.sku, amountMinor: '1200', currency: 'USD', priceRevision: 2 }, priceAcceptance: null, status: 'stale_price', currentTitle: product.title, currentImageUrl: null,
};

const cart: NativeCart = {
  contractVersion: 'native-cart.v1', cartId: line.cartId, storeId: product.storeId, organizationId: '85000000-0000-4000-8000-000000000004', businessId: '85000000-0000-4000-8000-000000000005', currency: 'USD', status: 'active', version: 2, expiresAt: new Date('2026-11-16T00:00:00.000Z'), lastActivityAt: new Date('2026-10-17T00:00:00.000Z'), lines: [line],
};

describe('native cart presentation rules', () => {
  it('only treats confirmed available stock as sellable', () => {
    expect(isNativeProductSellable(product)).toBe(true);
    expect(isNativeProductSellable({ ...product, availability: 'unavailable', inventoryQuantity: 0 })).toBe(false);
    expect(isNativeProductSellable({ ...product, availability: 'unknown', inventoryQuantity: null })).toBe(false);
  });

  it('derives item count and saved subtotal from cart lines', () => {
    expect(nativeCartItemCount(cart)).toBe(2);
    expect(nativeCartSubtotalMinor(cart)).toBe('2000');
    expect(nativeCartItemCount(null)).toBe(0);
  });

  it('keeps stale-price presentation explicit until acceptance', () => {
    expect(nativeCartLineStatusLabel(line)).toBe('Price changed');
    expect(nativeCartLineStatusLabel({ ...line, priceAcceptance: { acceptedAmountMinor: '1200', acceptedCurrency: 'USD', acceptedPriceRevision: 2, acceptedAt: new Date() } })).toBe('Current price accepted');
  });
});
