'use client';

import { useEffect, useState } from 'react';
import { formatNativeMoney, type NativeCart, type NativeCheckoutSession, type NativeProduct, type NativeVerifiedOrder } from '@kablet/domain';

function key(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function NativeCheckoutSurface({ storeSlug, cart, products, onClose }: { storeSlug: string; cart: NativeCart; products: NativeProduct[]; onClose: () => void }) {
  const [checkout, setCheckout] = useState<NativeCheckoutSession | null>(null);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState<string | null>(null);
  const [order, setOrder] = useState<NativeVerifiedOrder | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [pending, setPending] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requiresShipping = cart.lines.some(line => products.find(product => product.id === line.productId)?.fulfillmentType !== 'digital');

  useEffect(() => {
    if (!checkout || order) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/store/${storeSlug}/checkout/${checkout.checkoutId}`, { credentials: 'include', cache: 'no-store' }).then(response => response.ok ? response.json() as Promise<{ order?: NativeVerifiedOrder | null }> : null).then(value => { if (value?.order) setOrder(value.order); }).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [checkout, order, storeSlug]);

  async function prepare() {
    setPending(true); setError(null);
    try {
      const response = await fetch(`/api/store/${storeSlug}/checkout`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: key(), contact: { email, name, phone: null }, shippingAddress: requiresShipping ? { recipientName: name, line1, line2: null, city, region, postalCode, countryCode } : null }) });
      const body = await response.json() as { checkout?: NativeCheckoutSession; code?: string; message?: string };
      if (!response.ok || !body.checkout) throw new Error(body.message ?? 'Checkout could not be prepared.');
      setCheckout(body.checkout);
      setPaymentIdempotencyKey(key());
    } catch (value) { setError(value instanceof Error ? value.message : 'Checkout could not be prepared.'); }
    finally { setPending(false); }
  }

  async function pay() {
    if (!checkout || !paymentIdempotencyKey) {
      setError('Payment could not be started because the checkout operation is not ready.');
      return;
    }
    setPaymentPending(true); setError(null);
    try {
      const response = await fetch(`/api/store/${storeSlug}/checkout/${checkout.checkoutId}/payment`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: paymentIdempotencyKey }) });
      const body = await response.json() as { session?: { url?: string | null }; message?: string };
      if (!response.ok) throw new Error(body.message ?? 'Payment could not be started.');
      if (body.session?.url) window.location.assign(body.session.url);
    } catch (value) { setError(value instanceof Error ? value.message : 'Payment is temporarily unavailable.'); }
    finally { setPaymentPending(false); }
  }

  return <aside className="adaptive-checkout-surface" role="dialog" aria-modal="true" aria-labelledby="adaptive-checkout-title">
    <div className="adaptive-cart-surface-header"><div><p className="eyebrow">Secure checkout</p><h2 id="adaptive-checkout-title">Review your selections</h2></div><button type="button" aria-label="Close checkout" onClick={onClose}>×</button></div>
    {order ? <div role="status"><h3>Payment verified</h3><p>Order {order.publicReference} is confirmed by the merchant system.</p><p>{formatNativeMoney(order.totalAmountMinor, order.currency)}</p></div> : <>
      <div className="adaptive-checkout-summary"><p>{cart.lines.length} item{cart.lines.length === 1 ? '' : 's'}</p><p>Cart prices are revalidated by the server before reservation.</p></div>
      {!checkout ? <form onSubmit={event => { event.preventDefault(); void prepare(); }}>
        <label>Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label>Name<input required value={name} onChange={event => setName(event.target.value)} /></label>
        {requiresShipping && <><label>Country<input required maxLength={2} value={countryCode} onChange={event => setCountryCode(event.target.value.toUpperCase())} /></label>
        <label>Address<input required value={line1} onChange={event => setLine1(event.target.value)} /></label>
        <label>City<input required value={city} onChange={event => setCity(event.target.value)} /></label>
        <label>Region<input required value={region} onChange={event => setRegion(event.target.value)} /></label>
        <label>Postal code<input required value={postalCode} onChange={event => setPostalCode(event.target.value)} /></label></>}
        <button type="submit" disabled={pending}>{pending ? 'Checking availability…' : 'Review total'}</button>
      </form> : <div>
        <p>Reservation expires {new Date(checkout.expiresAt).toLocaleString()}.</p>
        <p>Server total: <strong>{formatNativeMoney(checkout.serverTotal.amountMinor!, checkout.currency)}</strong></p>
        <button type="button" disabled={paymentPending} onClick={() => void pay()}>{paymentPending ? 'Opening secure payment…' : 'Continue to secure payment'}</button>
        <p role="status">Payment remains pending until the merchant provider confirms it.</p>
      </div>}
    </>}
    {error && <p role="alert">{error}</p>}
  </aside>;
}
