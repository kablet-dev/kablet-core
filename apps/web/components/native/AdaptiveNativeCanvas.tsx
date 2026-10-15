'use client';

import { useMemo, useState } from 'react';
import { formatNativeMoney, type NativeProduct, type NativeStorefront } from '@kablet/domain';
import { initialNativeCanvasState, selectEntryStrategy, selectIntent, selectProduct, showDiscovery, showEntry, toggleComparedProduct, type CanvasIntent, type EntryCompositionPlan, type EntryStrategy, type NativeCanvasState } from '../../lib/native-canvas';

type Props = { storefront: NativeStorefront; entryStrategyPreview?: EntryStrategy; approvedEditorialImageUrl?: string | null };

const intentLabels: Array<{ intent: CanvasIntent; label: string }> = [
  { intent: 'find', label: 'Help me find something' },
  { intent: 'specific', label: 'I know what I want' },
  { intent: 'compare', label: 'Compare products' },
  { intent: 'best', label: "What's best for me?" },
];

const intentContext: Record<CanvasIntent, string> = {
  find: 'You are exploring the collection.',
  specific: 'You are looking for something specific.',
  compare: 'You are comparing published products.',
  best: 'You are looking for a considered choice.',
};

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
    <div className="adaptive-brand-hero-copy">
      <p className="eyebrow">A considered collection</p>
      <h1 id="store-title">{storefront.name}</h1>
      <p>Tell us what you are looking for. The collection will make room for the next useful choice.</p>
      {preview && <p className="adaptive-entry-preview" role="note">Development-only preview · {plan.strategy}</p>}
      <PersistentIntentInput variant="hero" onSubmit={onSubmit} />
      <IntentChips onSelect={onStart} />
    </div>
    <HeroVisual storefront={storefront} plan={plan} />
  </section>;
}

export function IntentChips({ onSelect }: { onSelect: (intent: CanvasIntent) => void }) {
  return <div className="adaptive-intent-chips" aria-label="Choose how to explore">
    {intentLabels.map(({ intent, label }) => <button key={intent} type="button" onClick={() => onSelect(intent)}>{label}</button>)}
  </div>;
}

export function ContextStrip({ intent, visible, onDismiss }: { intent: CanvasIntent | null; visible: boolean; onDismiss: () => void }) {
  if (!visible || !intent) return null;
  return <div className="adaptive-context-strip" role="status" aria-live="polite">
    <span>{intentContext[intent]}</span>
    <button type="button" aria-label="Dismiss context" onClick={onDismiss}>×</button>
  </div>;
}

function availabilityLabel(availability: NativeProduct['availability']): string {
  return availability === 'available' ? 'Available now' : availability === 'stale' ? 'Availability being refreshed' : availability === 'unavailable' ? 'Currently unavailable' : 'Availability to be confirmed';
}

export function ProductCard({ product, onSelect, onCompare, compared }: { product: NativeProduct; onSelect: () => void; onCompare?: () => void; compared?: boolean }) {
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
      </div>
    </div>
  </article>;
}

export function ProductSpotlight({ product, onBack, onCompare }: { product: NativeProduct; onBack: () => void; onCompare: () => void }) {
  return <section className="adaptive-spotlight" aria-labelledby="spotlight-title">
    <div className="adaptive-spotlight-topline"><button type="button" className="adaptive-back-action" onClick={onBack}>← Back to collection</button><span>Product spotlight</span></div>
    <div className="adaptive-spotlight-grid">
      <div className="adaptive-spotlight-visual">
        {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span aria-hidden="true">{product.title.slice(0, 1)}</span>}
      </div>
      <div className="adaptive-spotlight-copy">
        <p className="adaptive-product-availability">{availabilityLabel(product.availability)}</p>
        <h2 id="spotlight-title">{product.title}</h2>
        <p>{product.description || 'Description not provided by the store.'}</p>
        <dl className="adaptive-spotlight-facts">
          <div><dt>Price</dt><dd>{formatNativeMoney(product.amountMinor, product.currency)}</dd></div>
          <div><dt>Availability</dt><dd>{availabilityLabel(product.availability)}</dd></div>
        </dl>
        <div className="adaptive-spotlight-actions"><button type="button" className="adaptive-primary-action" onClick={onCompare}>Compare with another product</button><button type="button" className="adaptive-secondary-action" onClick={onBack}>Keep exploring</button></div>
      </div>
    </div>
  </section>;
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
  const selectedProduct = useMemo(() => storefront.products.find(product => product.id === state.selectedProductId) ?? null, [state.selectedProductId, storefront.products]);
  const comparedProducts = useMemo(() => state.comparedProductIds.map(id => storefront.products.find(product => product.id === id)).filter((product): product is NativeProduct => Boolean(product)), [state.comparedProductIds, storefront.products]);
  const entryPlan = useMemo(() => selectEntryStrategy({
    approvedEditorialImageUrl,
    publishedProductImageId: storefront.products.find(product => product.imageUrl)?.id ?? null,
    visitorIntent: state.intent,
    acquisitionContext: null,
  }), [state.intent, storefront.products]);

  function handleIntent(intent: CanvasIntent) { setState(current => selectIntent(current, intent, storefront.products)); }
  function handleText(text: string) { handleIntent(reduceTextIntent(text)); }
  function handleProduct(productId: string) { setState(current => selectProduct(current, productId, storefront.products)); }
  function handleCompare(productId: string) { setState(current => toggleComparedProduct(current, productId, storefront.products)); }
  function handleBack() { setState(current => showDiscovery(current)); }

  return <main className="adaptive-store-shell">
    <header className="adaptive-store-header"><button type="button" className="adaptive-brand" onClick={() => setState(current => showEntry(current))} aria-label="Return to storefront entry"><span className="adaptive-brand-mark" aria-hidden="true">{storefront.brandMark ?? storefront.name.slice(0, 1)}</span><span>{storefront.name}</span></button><span className="adaptive-store-currency">{storefront.primaryCurrency}</span></header>
    <ContextStrip intent={state.intent} visible={state.contextVisible} onDismiss={() => setState(current => ({ ...current, contextVisible: false }))} />
    {state.composition === 'entry' && <BrandHero storefront={storefront} plan={entryStrategyPreview ? { contractVersion: 'entry.v1', strategy: entryStrategyPreview, approvedEditorialImageUrl: entryStrategyPreview === 'editorial' ? approvedEditorialImageUrl : null, publishedProductImageId: entryStrategyPreview === 'product-led' ? storefront.products.find(product => product.imageUrl)?.id ?? null : null } : entryPlan} preview={Boolean(entryStrategyPreview)} onStart={handleIntent} onSubmit={handleText} />}
    {state.composition === 'discovery' && <section className="adaptive-discovery" aria-labelledby="discovery-title"><div className="adaptive-discovery-intro"><div><p className="eyebrow">The collection</p><h1 id="discovery-title">A useful place to begin.</h1><p className="adaptive-guidance">A balanced view of published products, clear prices, and current availability from {storefront.name}.</p></div><div className="adaptive-discovery-actions"><button type="button" className="adaptive-back-action" onClick={() => setState(current => showEntry(current))}>Change direction</button><button type="button" className="adaptive-secondary-action" onClick={() => handleIntent('compare')}>Compare products</button></div></div><div className="adaptive-discovery-summary" aria-label="Collection summary"><span>{storefront.products.length} published {storefront.products.length === 1 ? 'product' : 'products'}</span><span>Prices in {storefront.primaryCurrency}</span></div><div className="adaptive-product-grid">{storefront.products.map(product => <ProductCard key={product.id} product={product} onSelect={() => handleProduct(product.id)} onCompare={() => handleCompare(product.id)} compared={state.comparedProductIds.includes(product.id)} />)}</div></section>}
    {state.composition === 'comparison' && (comparedProducts.length === 2 ? <ComparisonTable products={comparedProducts} onBack={() => setState(current => ({ ...current, comparedProductIds: [], composition: 'comparison' }))} onSelect={handleProduct} /> : <ProductComparison products={storefront.products} onBack={handleBack} onSelect={handleCompare} />)}
    {state.composition === 'spotlight' && selectedProduct && <ProductSpotlight product={selectedProduct} onBack={handleBack} onCompare={() => setState(current => ({ ...current, composition: 'comparison', comparedProductIds: current.selectedProductId ? [current.selectedProductId] : [] }))} />}
    {storefront.products.length === 0 && <div className="adaptive-empty" role="status"><h2>Collection coming soon</h2><p>No published products are available yet. You can return when the store has an approved collection.</p></div>}
    {state.composition !== 'entry' && <PersistentIntentInput onSubmit={handleText} />}
    <footer className="adaptive-store-footer">{storefront.name} · Prices shown in {storefront.primaryCurrency}</footer>
  </main>;
}
