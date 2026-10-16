'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NativeCart } from '@kablet/domain';
import type { NativeCartMutationOptions } from './native-cart-client';
import { NativeCartController, type NativeCartAddOptions, type NativeCartViewState } from './native-cart-state';

export type UseNativeCart = NativeCartViewState & {
  refresh: () => Promise<NativeCart | null>;
  addLine: (productId: string, quantity: number, options?: NativeCartAddOptions) => Promise<NativeCart>;
  updateLine: (lineId: string, quantity: number, options?: NativeCartMutationOptions) => Promise<NativeCart>;
  removeLine: (lineId: string, options?: NativeCartMutationOptions) => Promise<NativeCart>;
  acceptPrice: (lineId: string, options?: NativeCartMutationOptions) => Promise<NativeCart>;
};

export function useNativeCart(storeSlug: string): UseNativeCart {
  const controller = useMemo(() => new NativeCartController(storeSlug), [storeSlug]);
  const [view, setView] = useState<NativeCartViewState>(controller.getState());

  useEffect(() => {
    setView(controller.getState());
    const unsubscribe = controller.subscribe(setView);
    void controller.load().catch(() => undefined);
    return unsubscribe;
  }, [controller]);

  const refresh = useCallback(() => controller.refresh(), [controller]);
  const addLine = useCallback((productId: string, quantity: number, options?: NativeCartAddOptions) => controller.addLine(productId, quantity, options), [controller]);
  const updateLine = useCallback((lineId: string, quantity: number, options?: NativeCartMutationOptions) => controller.updateLine(lineId, quantity, options), [controller]);
  const removeLine = useCallback((lineId: string, options?: NativeCartMutationOptions) => controller.removeLine(lineId, options), [controller]);
  const acceptPrice = useCallback((lineId: string, options?: NativeCartMutationOptions) => controller.acceptPrice(lineId, options), [controller]);

  return { ...view, refresh, addLine, updateLine, removeLine, acceptPrice };
}
