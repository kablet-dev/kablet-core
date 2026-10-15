import { describe, expect, it } from 'vitest';
import { initialNativeCanvasState, selectEntryStrategy, selectIntent, selectProduct, showDiscovery, toggleComparedProduct } from '../../apps/web/lib/native-canvas';
import type { NativeProduct } from '@kablet/domain';

const products: NativeProduct[] = [
  { id: '85000000-0000-4000-8000-000000000002', storeId: '85000000-0000-4000-8000-000000000001', slug: 'first', title: 'First', description: 'First product', imageUrl: null, amountMinor: '1000', currency: 'USD', status: 'published', availability: 'available' },
  { id: '85000000-0000-4000-8000-000000000003', storeId: '85000000-0000-4000-8000-000000000001', slug: 'second', title: 'Second', description: 'Second product', imageUrl: null, amountMinor: '2000', currency: 'USD', status: 'published', availability: 'stale' },
];

describe('native adaptive canvas transitions', () => {
  it('starts in the entry composition and moves intent into discovery', () => {
    expect(initialNativeCanvasState.composition).toBe('entry');
    expect(selectIntent(initialNativeCanvasState, 'find', products)).toMatchObject({ composition: 'discovery', intent: 'find' });
  });

  it('opens a real published product in the same canvas', () => {
    const state = selectIntent(initialNativeCanvasState, 'specific', products);
    expect(selectProduct(state, products[0].id, products)).toMatchObject({ composition: 'spotlight', selectedProductId: products[0].id });
    expect(selectProduct(state, '85000000-0000-4000-8000-000000000099', products)).toBe(state);
  });

  it('requires two selected products before showing comparison results', () => {
    const first = toggleComparedProduct(selectIntent(initialNativeCanvasState, 'compare', products), products[0].id, products);
    const second = toggleComparedProduct(first, products[1].id, products);
    expect(first.comparedProductIds).toEqual([products[0].id]);
    expect(second.comparedProductIds).toEqual([products[0].id, products[1].id]);
  });

  it('returns to discovery without discarding the active intent', () => {
    const state = selectProduct(selectIntent(initialNativeCanvasState, 'best', products), products[0].id, products);
    expect(showDiscovery(state)).toMatchObject({ composition: 'discovery', intent: 'best', selectedProductId: null });
  });
});

describe('native entry strategy selection', () => {
  it('chooses editorial for an exploratory visitor when an approved editorial asset exists', () => {
    expect(selectEntryStrategy({ approvedEditorialImageUrl: 'https://merchant.example/editorial.jpg', publishedProductImageId: 'product-1', visitorIntent: 'find', acquisitionContext: 'exploratory' })).toMatchObject({ strategy: 'editorial', approvedEditorialImageUrl: 'https://merchant.example/editorial.jpg', publishedProductImageId: null });
  });

  it('gives explicit product-oriented context precedence over editorial imagery', () => {
    expect(selectEntryStrategy({ approvedEditorialImageUrl: 'https://merchant.example/editorial.jpg', publishedProductImageId: 'product-1', visitorIntent: 'specific', acquisitionContext: 'product' })).toMatchObject({ strategy: 'product-led', publishedProductImageId: 'product-1', approvedEditorialImageUrl: null });
  });

  it('uses product-led as the safe asset fallback when a published product image exists', () => {
    expect(selectEntryStrategy({ approvedEditorialImageUrl: null, publishedProductImageId: 'product-1', visitorIntent: null, acquisitionContext: null })).toMatchObject({ strategy: 'product-led' });
  });

  it('uses typography-led when approved imagery is unavailable or photography is disallowed', () => {
    expect(selectEntryStrategy({ approvedEditorialImageUrl: null, publishedProductImageId: null, visitorIntent: null, acquisitionContext: null }).strategy).toBe('typography-led');
    expect(selectEntryStrategy({ approvedEditorialImageUrl: 'https://merchant.example/editorial.jpg', publishedProductImageId: 'product-1', visitorIntent: 'find', acquisitionContext: 'exploratory', presentationConstraint: 'no-photography' }).strategy).toBe('typography-led');
  });
});
