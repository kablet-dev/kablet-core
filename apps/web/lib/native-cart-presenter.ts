import type { NativeCart, NativeCartLine, NativeProduct } from '@kablet/domain';

export function isNativeProductSellable(product: NativeProduct): boolean {
  return product.availability === 'available' && product.inventoryQuantity !== null && product.inventoryQuantity > 0;
}

export function nativeCartItemCount(cart: NativeCart | null): number {
  return cart?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0;
}

export function nativeCartSubtotalMinor(cart: NativeCart | null): string {
  return cart?.lines.reduce((total, line) => total + BigInt(line.originalPrice.amountMinor) * BigInt(line.quantity), 0n).toString() ?? '0';
}

export function nativeCartLineStatusLabel(line: NativeCartLine): string {
  if (line.status === 'unpublished') return 'No longer published';
  if (line.status === 'unavailable') return 'Currently unavailable';
  if (line.status === 'expired') return 'Cart expired';
  if (line.status === 'stale_price') return line.priceAcceptance ? 'Current price accepted' : 'Price changed';
  return 'Available';
}
