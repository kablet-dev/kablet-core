import { describe, expect, it } from 'vitest';
import { commerceProductSchema, commerceVariantSchema, moneySchema, providerErrorSchema } from '@kablet/domain';

describe('provider-neutral commerce contracts', () => {
  it('uses integer minor units and rejects floating-point money', () => {
    expect(moneySchema.parse({ amountMinor: '1099', currency: 'USD' })).toEqual({ amountMinor: '1099', currency: 'USD' });
    expect(() => moneySchema.parse({ amountMinor: 10.99, currency: 'USD' })).toThrow();
  });

  it('represents stale and unknown availability explicitly', () => {
    expect(commerceProductSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', externalId: 'p1', title: 'Product', description: '', status: 'unknown', availability: 'stale', sourceUpdatedAt: null, observedAt: new Date(), revision: 1, imageUrls: [] }).availability).toBe('stale');
    expect(commerceVariantSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', externalId: 'v1', productExternalId: 'p1', title: 'Default', price: null, availableQuantity: null, availability: 'unknown', sourceUpdatedAt: null, observedAt: new Date(), revision: 1 }).availableQuantity).toBeNull();
  });

  it('classifies provider failures without exposing provider secrets', () => {
    expect(providerErrorSchema.parse({ kind: 'rate_limited', retryable: true, providerCode: '429', message: 'Shopify request failed' })).toEqual(expect.objectContaining({ retryable: true }));
    expect(() => providerErrorSchema.parse({ kind: 'unknown', retryable: false, providerCode: null, message: 'Shopify request failed' })).not.toThrow();
  });
});
