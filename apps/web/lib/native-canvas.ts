import type { NativeProduct } from '@kablet/domain';

export type CanvasComposition = 'entry' | 'discovery' | 'comparison' | 'spotlight';
export type CanvasIntent = 'find' | 'specific' | 'compare' | 'best';
export type EntryStrategy = 'editorial' | 'product-led' | 'typography-led';

export type EntryStrategyInput = {
  approvedEditorialImageUrl: string | null;
  publishedProductImageId: string | null;
  visitorIntent: CanvasIntent | null;
  acquisitionContext: 'exploratory' | 'product' | null;
  presentationConstraint?: 'no-photography' | null;
};

export type EntryCompositionPlan = {
  contractVersion: 'entry.v1';
  strategy: EntryStrategy;
  approvedEditorialImageUrl: string | null;
  publishedProductImageId: string | null;
};

/**
 * Stable presentation fallback for discovery. The governed decision still
 * chooses the composition; this rule only chooses its visual lead product.
 */
export function selectEditorialPrimaryProduct(products: NativeProduct[]): NativeProduct | null {
  const published = products.filter(product => product.status === 'published');
  return published.find(product => product.availability === 'available' && product.inventoryQuantity !== null && product.inventoryQuantity > 0) ?? published[0] ?? null;
}

function isProductOriented(input: EntryStrategyInput): boolean {
  return input.acquisitionContext === 'product' || input.visitorIntent === 'specific' || input.visitorIntent === 'compare';
}

function isExploratory(input: EntryStrategyInput): boolean {
  return input.acquisitionContext === 'exploratory' || input.visitorIntent === 'find' || input.visitorIntent === 'best';
}

export function selectEntryStrategy(input: EntryStrategyInput): EntryCompositionPlan {
  if (input.presentationConstraint === 'no-photography') {
    return { contractVersion: 'entry.v1', strategy: 'typography-led', approvedEditorialImageUrl: null, publishedProductImageId: null };
  }

  if (input.publishedProductImageId && isProductOriented(input)) {
    return { contractVersion: 'entry.v1', strategy: 'product-led', approvedEditorialImageUrl: null, publishedProductImageId: input.publishedProductImageId };
  }

  if (input.approvedEditorialImageUrl && (isExploratory(input) || !input.publishedProductImageId)) {
    return { contractVersion: 'entry.v1', strategy: 'editorial', approvedEditorialImageUrl: input.approvedEditorialImageUrl, publishedProductImageId: null };
  }

  if (input.publishedProductImageId) {
    return { contractVersion: 'entry.v1', strategy: 'product-led', approvedEditorialImageUrl: null, publishedProductImageId: input.publishedProductImageId };
  }

  return { contractVersion: 'entry.v1', strategy: 'typography-led', approvedEditorialImageUrl: null, publishedProductImageId: null };
}

export type NativeCanvasState = {
  composition: CanvasComposition;
  intent: CanvasIntent | null;
  selectedProductId: string | null;
  comparedProductIds: string[];
};

export const initialNativeCanvasState: NativeCanvasState = {
  composition: 'entry',
  intent: null,
  selectedProductId: null,
  comparedProductIds: [],
};

export function selectIntent(state: NativeCanvasState, intent: CanvasIntent, products: NativeProduct[]): NativeCanvasState {
  if (intent === 'compare') {
    return { ...state, composition: products.length >= 2 ? 'comparison' : 'discovery', intent, comparedProductIds: [] };
  }
  return { ...state, composition: products.length > 0 ? 'discovery' : 'entry', intent, selectedProductId: null };
}

export function selectProduct(state: NativeCanvasState, productId: string, products: NativeProduct[]): NativeCanvasState {
  if (!products.some(product => product.id === productId)) return state;
  return { ...state, composition: 'spotlight', selectedProductId: productId };
}

export function toggleComparedProduct(state: NativeCanvasState, productId: string, products: NativeProduct[]): NativeCanvasState {
  if (!products.some(product => product.id === productId)) return state;
  const comparedProductIds = state.comparedProductIds.includes(productId)
    ? state.comparedProductIds.filter(id => id !== productId)
    : state.comparedProductIds.length < 2 ? [...state.comparedProductIds, productId] : state.comparedProductIds;
  return { ...state, composition: 'comparison', comparedProductIds };
}

export function showDiscovery(state: NativeCanvasState): NativeCanvasState {
  return { ...state, composition: 'discovery', selectedProductId: null };
}

export function showEntry(state: NativeCanvasState): NativeCanvasState {
  return { ...state, composition: 'entry', selectedProductId: null, comparedProductIds: [] };
}
