'use client';

import { useEffect, useRef } from 'react';
import { formatNativeMoney, type NativeCart, type NativeCartLine } from '@kablet/domain';
import type { NativeCartClientError } from '../../lib/native-cart-client';
import { nativeCartItemCount, nativeCartLineStatusLabel, nativeCartSubtotalMinor } from '../../lib/native-cart-presenter';

type Props = {
  cart: NativeCart | null;
  loading: boolean;
  pending: boolean;
  error: NativeCartClientError | null;
  onClose: () => void;
  onUpdateQuantity: (lineId: string, quantity: number) => Promise<unknown>;
  onRemove: (lineId: string) => Promise<unknown>;
  onAcceptPrice: (lineId: string) => Promise<unknown>;
  onCheckout?: () => void;
};

function lineTotal(line: NativeCartLine): string {
  return (BigInt(line.originalPrice.amountMinor) * BigInt(line.quantity)).toString();
}

function CartLine({ line, pending, onUpdateQuantity, onRemove, onAcceptPrice }: { line: NativeCartLine; pending: boolean; onUpdateQuantity: Props['onUpdateQuantity']; onRemove: Props['onRemove']; onAcceptPrice: Props['onAcceptPrice'] }) {
  const canAdjust = line.status === 'active' || line.status === 'stale_price';
  const hasChangedPrice = line.status === 'stale_price' && line.currentPrice !== null;
  return <article className={`adaptive-cart-line adaptive-cart-line-${line.status}`}>
    <div className="adaptive-cart-line-image">
      {line.currentImageUrl ? <img src={line.currentImageUrl} alt="" /> : <span aria-hidden="true">{(line.currentTitle ?? 'P').slice(0, 1)}</span>}
    </div>
    <div className="adaptive-cart-line-copy">
      <div className="adaptive-cart-line-heading"><div><h3>{line.currentTitle ?? 'Product no longer published'}</h3><p>SKU · {line.originalPrice.sku}</p></div><strong>{formatNativeMoney(lineTotal(line), line.originalPrice.currency)}</strong></div>
      <p className="adaptive-cart-line-status">{nativeCartLineStatusLabel(line)}</p>
      <p className="adaptive-cart-line-price">Saved unit price: {formatNativeMoney(line.originalPrice.amountMinor, line.originalPrice.currency)}{hasChangedPrice && <> · Current: {formatNativeMoney(line.currentPrice!.amountMinor, line.currentPrice!.currency)}</>}</p>
      <div className="adaptive-cart-line-actions">
        {canAdjust && <div className="adaptive-cart-quantity" aria-label={`Quantity for ${line.currentTitle ?? 'product'}`}>
          <button type="button" aria-label={`Decrease quantity for ${line.currentTitle ?? 'product'}`} disabled={pending || line.quantity <= 1} onClick={() => void onUpdateQuantity(line.lineId, line.quantity - 1)}>−</button>
          <span aria-live="polite">{line.quantity}</span>
          <button type="button" aria-label={`Increase quantity for ${line.currentTitle ?? 'product'}`} disabled={pending} onClick={() => void onUpdateQuantity(line.lineId, line.quantity + 1)}>+</button>
        </div>}
        {canAdjust && <button type="button" className="adaptive-text-action" disabled={pending} onClick={() => void onRemove(line.lineId)}>Remove</button>}
        {hasChangedPrice && !line.priceAcceptance && <button type="button" className="adaptive-secondary-action" disabled={pending} onClick={() => void onAcceptPrice(line.lineId)}>Accept current price</button>}
      </div>
    </div>
  </article>;
}

export function NativeCartSurface({ cart, loading, pending, error, onClose, onUpdateQuantity, onRemove, onAcceptPrice, onCheckout }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const itemCount = nativeCartItemCount(cart);
  const subtotalMinor = nativeCartSubtotalMinor(cart);

  return <aside id="adaptive-cart-panel" ref={panelRef} className="adaptive-cart-surface" role="dialog" aria-modal="false" aria-labelledby="adaptive-cart-title" tabIndex={-1}>
    <div className="adaptive-cart-surface-header"><div><p className="eyebrow">Your selections</p><h2 id="adaptive-cart-title">Cart <span>· {itemCount} {itemCount === 1 ? 'item' : 'items'}</span></h2></div><button type="button" className="adaptive-cart-close" aria-label="Close cart" onClick={onClose}>×</button></div>
    {loading && <p className="adaptive-cart-status" role="status">Checking your saved cart…</p>}
    {!loading && !cart && <div className="adaptive-cart-empty" role="status"><h3>Your cart is empty</h3><p>Selections you make in the canvas will stay here in this browser.</p></div>}
    {!loading && cart && cart.lines.length === 0 && <div className="adaptive-cart-empty" role="status"><h3>Your cart is empty</h3><p>Choose an available product when you are ready.</p></div>}
    {cart && cart.lines.length > 0 && <div className="adaptive-cart-lines">{cart.lines.map(line => <CartLine key={line.lineId} line={line} pending={pending} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} onAcceptPrice={onAcceptPrice} />)}</div>}
    {error && <p className="adaptive-cart-error" role="alert">{error.message}</p>}
    {cart && cart.lines.length > 0 && <div className="adaptive-cart-summary"><div><span>Saved subtotal</span><strong>{formatNativeMoney(subtotalMinor, cart.currency)}</strong></div><p>Shown from the saved cart prices. Final checkout totals are not calculated here.</p></div>}
    {cart && cart.lines.length > 0 && onCheckout && <button type="button" disabled={pending} onClick={onCheckout}>Continue to checkout</button>}
  </aside>;
}
