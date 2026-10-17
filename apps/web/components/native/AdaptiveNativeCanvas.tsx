'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatNativeMoney, type NativeProduct, type NativeStorefront } from '@kablet/domain';
import { initialNativeCanvasState, selectEditorialPrimaryProduct, selectEntryStrategy, selectIntent, selectProduct, showDiscovery, showEntry, toggleComparedProduct, type CanvasComposition, type CanvasIntent, type EntryCompositionPlan, type EntryStrategy, type NativeCanvasState } from '../../lib/native-canvas';
import { useNativeCart } from '../../lib/use-native-cart';
import { isNativeProductSellable, nativeCartItemCount } from '../../lib/native-cart-presenter';
import { NativeCartSurface } from './NativeCartSurface';
import { NativeCheckoutSurface } from './NativeCheckoutSurface';
import { NativeDiscoveryExperience } from './NativeDiscoveryExperience';
import { availabilityLabel, ProductSpotlight } from './NativeProductSpotlight';
import { NativeContextProof, NativeIntelligenceRail, NativeWorkspaceShell, type NativeContextualAction } from './NativeWorkspace';

type Props = { storefront: NativeStorefront; entryStrategyPreview?: EntryStrategy; approvedEditorialImageUrl?: string | null };

const intentLabels: Array<{ intent: CanvasIntent; label: string }> = [
  { intent: 'find', label: 'Help me find something' },
  { intent: 'specific', label: 'I know what I want' },
  { intent: 'compare', label: 'Compare products' },
];

function HeroVisual({ storefront, plan }: { storefront: NativeStorefront; plan: EntryCompositionPlan }) {
  const imageProduct = plan.publishedProductImageId ? storefront.products.find(product => product.id === plan.publishedProductImageId && product.imageUrl) : null;
  const imageUrl = plan.approvedEditorialImageUrl ?? imageProduct?.imageUrl ?? null;

  return <div className={`adaptive-hero-visual adaptive-hero-visual-${plan.strategy}${imageUrl ? '' : ' is-fallback'}`} aria-hidden="true">
    {imageUrl ? <>
      <img src={imageUrl} alt="" />
      <div className="adaptive-hero-visual-caption"><span>{plan.strategy === 'editorial' ? 'Editorial entry' : storefront.name}</span><strong>{imageProduct?.title ?? 'The collection'}</strong></div>
    </> : <>
      <span className="adaptive-hero-fallback-mark">{storefront.brandMark ?? storefront.name.slice(0, 1)}</span>
      <span className="adaptive-hero-fallback-line" />
      <span className="adaptive-hero-fallback-caption">{plan.strategy === 'editorial' ? 'Development preview · editorial asset required' : 'A considered collection'}</span>
    </>}
  </div>;
}

export function BrandHero({ storefront, plan, onStart, onSubmit, preview }: { storefront: NativeStorefront; plan: EntryCompositionPlan; onStart: (intent: CanvasIntent) => void; onSubmit: (value: string) => void; preview?: boolean }) {
  return <section className={`adaptive-brand-hero adaptive-brand-hero-${plan.strategy}`} aria-labelledby="store-title">
    <HeroVisual storefront={storefront} plan={plan} />
    <div className="adaptive-brand-hero-copy">
      <p className="eyebrow">A considered collection</p>
      <h1 id="store-title">{storefront.name}</h1>
      <p className="adaptive-entry-supporting-copy">Tell us what you are looking for. The collection will make room for the next useful choice.</p>
      {preview && <p className="adaptive-entry-preview" role="note">Development-only preview · {plan.strategy}</p>}
      <PersistentIntentInput variant="hero" onSubmit={onSubmit} />
      <IntentChips onSelect={onStart} />
    </div>
  </section>;
}

export function IntentChips({ onSelect }: { onSelect: (intent: CanvasIntent) => void }) {
  return <div className="adaptive-intent-chips" aria-label="Choose how to explore">
    {intentLabels.map(({ intent, label }) => <button key={intent} type="button" onClick={() => onSelect(intent)}>{label}</button>)}
  </div>;
}

export function ProductCard({ product, onSelect, onCompare, compared, onAdd, adding }: { product: NativeProduct; onSelect: () => void; onCompare?: () => void; compared?: boolean; onAdd?: () => void; adding?: boolean }) {
  const sellable = isNativeProductSellable(product);
  return <article className={`adaptive-product-card${compared ? ' is-compared' : ''}`}>
    <button className="adaptive-product-visual" type="button" onClick={onSelect} aria-label={`View ${product.title}`}>
      {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span aria-hidden="true">{product.title.slice(0, 1)}</span>}
    </button>
    <div className="adaptive-product-copy">
      <p className="adaptive-product-availability">{availabilityLabel(product.availability)}</p>
      <h3>{product.title}</h3>
      <p>{product.description || 'Description not provided by the store.'}</p>
      <div className="adaptive-product-actions">
        <strong>{formatNativeMoney(product.amountMinor, product.currency)}</strong>
        {onCompare && <button type="button" className="adaptive-secondary-action" aria-pressed={compared} onClick={onCompare}>{compared ? 'Selected' : 'Compare'}</button>}
        <button type="button" className="adaptive-text-action" onClick={onSelect}>View product</button>
        {onAdd && <button type="button" className="adaptive-primary-action adaptive-product-add" disabled={!sellable || adding} onClick={onAdd}>{adding ? 'Adding…' : sellable ? 'Add to cart' : 'Unavailable'}</button>}
      </div>
    </div>
  </article>;
}

export function ProductComparison({ products, onBack, onSelect }: { products: NativeProduct[]; onBack: () => void; onSelect: (productId: string) => void }) {
  return <section className="adaptive-comparison" aria-labelledby="comparison-title">
    <div className="adaptive-section-heading"><div><p className="eyebrow">Side by side</p><h2 id="comparison-title">Compare the collection</h2></div><button type="button" className="adaptive-back-action" onClick={onBack}>Back to collection</button></div>
    <p className="adaptive-guidance">Select up to two published products. Only information supplied by the store is shown.</p>
    <div className="adaptive-comparison-grid">
      {products.map(product => <ProductCard key={product.id} product={product} compared={false} onSelect={() => onSelect(product.id)} />)}
    </div>
  </section>;
}

function ComparisonTable({ products, onBack, onSelect }: { products: NativeProduct[]; onBack: () => void; onSelect: (id: string) => void }) {
  return <section className="adaptive-comparison" aria-labelledby="comparison-result-title">
    <div className="adaptive-section-heading"><div><p className="eyebrow">Your shortlist</p><h2 id="comparison-result-title">A clear comparison</h2></div><button type="button" className="adaptive-back-action" onClick={onBack}>Change products</button></div>
    <div className="adaptive-comparison-table" role="table" aria-label="Selected product comparison">
      {products.map(product => <article key={product.id} role="row" className="adaptive-comparison-column">
        <button type="button" className="adaptive-text-action" onClick={() => onSelect(product.id)}>{product.title}</button>
        <dl><div><dt>Price</dt><dd>{formatNativeMoney(product.amountMinor, product.currency)}</dd></div><div><dt>Availability</dt><dd>{availabilityLabel(product.availability)}</dd></div><div><dt>Store description</dt><dd>{product.description || 'Description not provided by the store.'}</dd></div></dl>
      </article>)}
    </div>
  </section>;
}

export function PersistentIntentInput({ onSubmit, variant = 'persistent' }: { onSubmit: (value: string) => void; variant?: 'hero' | 'persistent' }) {
  const [value, setValue] = useState('');
  function submit() { const trimmed = value.trim(); if (!trimmed) return; onSubmit(trimmed); setValue(''); }
  return <form className={`adaptive-persistent-input${variant === 'hero' ? ' is-hero' : ''}`} onSubmit={event => { event.preventDefault(); submit(); }}>
    <label htmlFor="adaptive-intent">What would be useful next?</label>
    <div><input id="adaptive-intent" value={value} onChange={event => setValue(event.target.value)} placeholder="Try “compare these” or “help me choose”" /><button type="submit" disabled={!value.trim()}>Explore</button></div>
  </form>;
}

function reduceTextIntent(text: string): CanvasIntent {
  const normalized = text.toLowerCase();
  if (normalized.includes('compar')) return 'compare';
  if (normalized.includes('best') || normalized.includes('choose') || normalized.includes('recommend')) return 'best';
  if (normalized.includes('want') || normalized.includes('specific')) return 'specific';
  return 'find';
}

export function AdaptiveNativeCanvas({ storefront, entryStrategyPreview, approvedEditorialImageUrl = null }: Props) {
  const [state, setState] = useState<NativeCanvasState>(initialNativeCanvasState);
  const cart = useNativeCart(storefront.publicSlug);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [cartFeedback, setCartFeedback] = useState<string | null>(null);
  const cartTriggerRef = useRef<HTMLButtonElement>(null);
  const intelligenceRequestRef = useRef(0);
  const selectedProduct = useMemo(() => storefront.products.find(product => product.id === state.selectedProductId) ?? null, [state.selectedProductId, storefront.products]);
  const editorialPrimaryProduct = useMemo(() => selectEditorialPrimaryProduct(storefront.products), [storefront.products]);
  const comparedProducts = useMemo(() => state.comparedProductIds.map(id => storefront.products.find(product => product.id === id)).filter((product): product is NativeProduct => Boolean(product)), [state.comparedProductIds, storefront.products]);
  const entryPlan = useMemo(() => selectEntryStrategy({
    approvedEditorialImageUrl,
    publishedProductImageId: storefront.products.find(product => product.imageUrl)?.id ?? null,
    visitorIntent: state.intent,
    acquisitionContext: null,
  }), [state.intent, storefront.products]);

  function intelligenceKey(): string { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
  useEffect(() => {
    // Bootstrap establishes/resumes the server visitor session, but a persisted
    // composition is not permission to skip the cinematic entry. Only an
    // explicit visitor action may advance this client canvas.
    const requestId = ++intelligenceRequestRef.current;
    void fetch(`/api/store/${storefront.publicSlug}/intelligence`, { credentials: 'include', cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<{ composition?: CanvasComposition }> : null)
      .then(() => { if (requestId !== intelligenceRequestRef.current) return; })
      .catch(() => undefined);
  }, [storefront.publicSlug]);
  async function selectServerIntent(intent: CanvasIntent) {
    const signal = intent === 'compare' ? 'comparison' : intent === 'find' ? 'discovery' : null;
    if (!signal) { handleIntent(intent); return; }
    ++intelligenceRequestRef.current;
    try { const response = await fetch(`/api/store/${storefront.publicSlug}/intelligence`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signal, idempotencyKey: intelligenceKey() }) }); const value = await response.json() as { composition?: CanvasComposition }; if (!response.ok || !value.composition) throw new Error('experience unavailable'); setState(current => ({ ...selectIntent(current, intent, storefront.products), composition: value.composition as CanvasComposition })); } catch { setCartFeedback('This experience could not be updated.'); }
  }

  function handleIntent(intent: CanvasIntent) { setState(current => selectIntent(current, intent, storefront.products)); }
  function handleText(text: string) { void selectServerIntent(reduceTextIntent(text)); }
  function handleProduct(productId: string) { setState(current => selectProduct(current, productId, storefront.products)); }
  function handleCompare(productId: string) { setState(current => toggleComparedProduct(current, productId, storefront.products)); }
  function handleBack() { setState(current => showDiscovery(current)); }
  function closeCart() { setCartOpen(false); requestAnimationFrame(() => cartTriggerRef.current?.focus()); }
  async function handleAdd(product: NativeProduct) {
    const sellable = product.availability === 'available' && product.inventoryQuantity !== null && product.inventoryQuantity > 0;
    if (!sellable || cart.pending) return;
    setPendingProductId(product.id); setCartFeedback(null);
    try { await cart.addLine(product.id, 1); setCartFeedback(`${product.title} added to your cart.`); }
    catch (error) { setCartFeedback(error instanceof Error ? error.message : 'The cart could not be updated.'); }
    finally { setPendingProductId(null); }
  }
  async function handleCartMutation(operation: () => Promise<unknown>, successMessage: string) {
    setCartFeedback(null);
    try { await operation(); setCartFeedback(successMessage); }
    catch (error) { setCartFeedback(error instanceof Error ? error.message : 'The cart could not be updated.'); }
  }
  function focusWorkspaceElement(id: string) { requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: false })); }
  function contextualActions(): NativeContextualAction[] {
    if (state.composition === 'discovery') return [
      { id: 'discovery-explore', label: 'Explore products', available: storefront.products.length > 0, onSelect: () => void selectServerIntent('find') },
      { id: 'discovery-compare', label: 'Compare products', available: storefront.products.length >= 2, onSelect: () => void selectServerIntent('compare') },
      { id: 'discovery-refine', label: 'Refine direction', available: storefront.products.length > 0, onSelect: () => void selectServerIntent('find') },
      { id: 'discovery-entry', label: 'Return to entry', available: true, onSelect: () => setState(current => showEntry(current)) },
    ];
    if (state.composition === 'spotlight' && selectedProduct) return [
      { id: 'spotlight-view-product', label: 'View product information', available: true, onSelect: () => focusWorkspaceElement('spotlight-title') },
      { id: 'spotlight-compare', label: 'Compare with alternatives', available: storefront.products.length >= 2, onSelect: () => setState(current => ({ ...current, composition: 'comparison', comparedProductIds: current.selectedProductId ? [current.selectedProductId] : [] })) },
      { id: 'spotlight-return', label: 'Return to discovery', available: true, onSelect: handleBack },
    ];
    if (state.composition === 'comparison') return [
      { id: 'comparison-review', label: 'Review selected products', available: comparedProducts.length > 0, onSelect: () => focusWorkspaceElement(comparedProducts.length === 2 ? 'comparison-result-title' : 'comparison-title') },
      { id: `comparison-inspect-${comparedProducts[0]?.id ?? 'none'}`, label: 'Inspect a selected product', available: comparedProducts.length > 0, onSelect: () => { if (comparedProducts[0]) handleProduct(comparedProducts[0].id); } },
      { id: 'comparison-return', label: 'Return to discovery', available: true, onSelect: handleBack },
    ];
    return [];
  }
  const itemCount = nativeCartItemCount(cart.cart);
  const explorationRail = <NativeIntelligenceRail intent={state.intent} actions={contextualActions()} intentInput={<PersistentIntentInput onSubmit={handleText} />} feedback={cartFeedback} error={cart.error?.message} />;

  const exploration = <>
    {state.composition === 'discovery' && <NativeDiscoveryExperience products={storefront.products} primaryProduct={editorialPrimaryProduct} comparedProductIds={state.comparedProductIds} onSelect={handleProduct} onCompare={handleCompare} onAdd={product => void handleAdd(product)} addingProductId={pendingProductId} />}
    {state.composition === 'comparison' && (comparedProducts.length === 2 ? <ComparisonTable products={comparedProducts} onBack={() => setState(current => ({ ...current, comparedProductIds: [], composition: 'comparison' }))} onSelect={handleProduct} /> : <ProductComparison products={storefront.products} onBack={handleBack} onSelect={handleCompare} />)}
    {state.composition === 'spotlight' && selectedProduct && <ProductSpotlight product={selectedProduct} intent={state.intent} onBack={handleBack} onAdd={() => void handleAdd(selectedProduct)} adding={pendingProductId === selectedProduct.id} onCompare={() => setState(current => ({ ...current, composition: 'comparison', comparedProductIds: current.selectedProductId ? [current.selectedProductId] : [] }))} />}
    {storefront.products.length === 0 && <div className="adaptive-empty" role="status"><h2>Collection coming soon</h2><p>No published products are available yet. You can return when the store has an approved collection.</p></div>}
  </>;

  return <main className={`adaptive-store-shell${state.composition === 'entry' ? ' is-entry' : ''}`}>
    <header className="adaptive-store-header"><button type="button" className="adaptive-brand" onClick={() => setState(current => showEntry(current))} aria-label="Return to storefront entry"><span className="adaptive-brand-mark" aria-hidden="true">{storefront.brandMark ?? storefront.name.slice(0, 1)}</span><span>{storefront.name}</span></button><div className="adaptive-header-actions"><span className="adaptive-store-currency">{storefront.primaryCurrency}</span><button ref={cartTriggerRef} type="button" className="adaptive-cart-trigger" aria-expanded={cartOpen} aria-controls="adaptive-cart-panel" onClick={() => { setCheckoutOpen(false); setCartOpen(current => !current); }}>Cart{cart.loading ? ' · …' : ` · ${itemCount}`}</button></div></header>
    {state.composition === 'entry' ? <BrandHero storefront={storefront} plan={entryStrategyPreview ? { contractVersion: 'entry.v1', strategy: entryStrategyPreview, approvedEditorialImageUrl: entryStrategyPreview === 'editorial' ? approvedEditorialImageUrl : null, publishedProductImageId: entryStrategyPreview === 'product-led' ? storefront.products.find(product => product.imageUrl)?.id ?? null : null } : entryPlan} preview={Boolean(entryStrategyPreview)} onStart={selectServerIntent} onSubmit={handleText} /> : checkoutOpen && cart.cart ? <NativeWorkspaceShell mode="checkout" rail={<NativeIntelligenceRail intent={state.intent} actions={[]} compact feedback={cartFeedback} error={cart.error?.message} onClose={() => setCheckoutOpen(false)} />} proof={<NativeContextProof eyebrow="Order review" title="A focused finish." facts={['Server totals are recalculated before reservation.', 'Payment remains pending until authenticated provider evidence.']} />}><NativeCheckoutSurface storeSlug={storefront.publicSlug} cart={cart.cart} products={storefront.products} onClose={() => setCheckoutOpen(false)} /></NativeWorkspaceShell> : cartOpen ? <NativeWorkspaceShell mode="cart" rail={<NativeIntelligenceRail intent={state.intent} actions={[]} compact feedback={cartFeedback} error={cart.error?.message} onClose={closeCart} />} proof={<NativeContextProof eyebrow="Your selections" title="Keep the useful choices." facts={[`${itemCount} ${itemCount === 1 ? 'item' : 'items'} saved in this browser.`, `Prices shown in ${storefront.primaryCurrency}.`]} />}><NativeCartSurface cart={cart.cart} loading={cart.loading} pending={cart.pending} error={cart.error} onClose={closeCart} onUpdateQuantity={(lineId, quantity) => handleCartMutation(() => cart.updateLine(lineId, quantity), 'Cart quantity updated.')} onRemove={lineId => handleCartMutation(() => cart.removeLine(lineId), 'Item removed from your cart.')} onAcceptPrice={lineId => handleCartMutation(() => cart.acceptPrice(lineId), 'Current price accepted for this cart line.')} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} /></NativeWorkspaceShell> : <NativeWorkspaceShell mode="exploration" rail={explorationRail} proof={<NativeContextProof eyebrow={selectedProduct ? 'Selected product' : 'Featured product'} title={state.composition === 'comparison' ? 'Compare the selected products.' : selectedProduct ? 'Selected product facts.' : editorialPrimaryProduct ? 'Ready to choose.' : 'Collection status.'} facts={state.composition === 'comparison' ? [`${comparedProducts.length} products selected.`, ...Array.from(new Set(comparedProducts.map(product => product.currency))).map(currency => `Prices in ${currency}.`)] : (selectedProduct ?? editorialPrimaryProduct) ? [availabilityLabel((selectedProduct ?? editorialPrimaryProduct)!.availability), (selectedProduct ?? editorialPrimaryProduct)!.fulfillmentType === 'digital' ? 'Digital fulfillment.' : 'Physical fulfillment.'] : ['No published product is available.']} />}>{exploration}</NativeWorkspaceShell>}
    <footer className="adaptive-store-footer">{storefront.name} · Prices shown in {storefront.primaryCurrency}</footer>
  </main>;
}
