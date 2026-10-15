import type { NativeProduct } from '@kablet/domain';

export type CanvasComposition = 'entry' | 'discovery' | 'comparison' | 'spotlight';
export type CanvasIntent = 'find' | 'specific' | 'compare' | 'best';

export type NativeCanvasState = {
  composition: CanvasComposition;
  intent: CanvasIntent | null;
  selectedProductId: string | null;
  comparedProductIds: string[];
  contextVisible: boolean;
};

export const initialNativeCanvasState: NativeCanvasState = {
  composition: 'entry',
  intent: null,
  selectedProductId: null,
  comparedProductIds: [],
  contextVisible: true,
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
