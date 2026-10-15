import { describe, expect, it } from 'vitest';
import { formatNativeMoney, nativeProductSchema, nativeStorefrontSchema, nativeStoreSchema, nativeStoreSlugSchema } from '@kablet/domain';

describe('native store contracts', () => {
  it('accepts safe public store identity and rejects unsafe slugs', () => {
    expect(nativeStoreSlugSchema.parse('northstar-native')).toBe('northstar-native');
    expect(() => nativeStoreSlugSchema.parse('../private')).toThrow();
    expect(nativeStoreSchema.parse({ id: '00000000-0000-4000-8000-000000000001', organizationId: '00000000-0000-4000-8000-000000000002', businessId: '00000000-0000-4000-8000-000000000003', publicSlug: 'northstar-native', name: 'Northstar', brandMark: null, primaryCurrency: 'JPY', status: 'published' })).toMatchObject({ primaryCurrency: 'JPY' });
  });

  it('formats minor-unit money without floating-point conversion', () => {
    expect(formatNativeMoney('1800', 'USD')).toBe('USD 18.00');
    expect(formatNativeMoney('1200', 'JPY')).toBe('JPY 1200');
    expect(formatNativeMoney('12345', 'BHD')).toBe('BHD 12.345');
    expect(() => formatNativeMoney('18.5', 'USD')).toThrow();
  });

  it('requires published products to carry explicit availability', () => {
    expect(nativeProductSchema.parse({ id: '00000000-0000-4000-8000-000000000004', storeId: '00000000-0000-4000-8000-000000000001', slug: 'field-notes', sku: 'FIELD-NOTES-001', title: 'Field Notes', description: '', imageUrl: null, amountMinor: '1800', currency: 'USD', inventoryQuantity: 4, priceRevision: 1, status: 'published', availability: 'stale' })).toMatchObject({ availability: 'stale', inventoryQuantity: 4, priceRevision: 1 });
  });

  it('does not allow a product currency to diverge from the store currency', () => {
    expect(() => nativeStorefrontSchema.parse({ id: '00000000-0000-4000-8000-000000000001', organizationId: '00000000-0000-4000-8000-000000000002', businessId: '00000000-0000-4000-8000-000000000003', publicSlug: 'northstar-native', name: 'Northstar', brandMark: null, primaryCurrency: 'USD', status: 'published', products: [{ id: '00000000-0000-4000-8000-000000000004', storeId: '00000000-0000-4000-8000-000000000001', slug: 'field-notes', sku: 'FIELD-NOTES-001', title: 'Field Notes', description: '', imageUrl: null, amountMinor: '1800', currency: 'EUR', inventoryQuantity: null, priceRevision: 1, status: 'published', availability: 'available' }] })).toThrow();
  });
});
