'use client';

import { useMemo, useState } from 'react';
import { formatNativeMoney, type NativeProduct, type NativeStorefront } from '@kablet/domain';
import { initialNativeCanvasState, selectIntent, selectProduct, showDiscovery, showEntry, toggleComparedProduct, type CanvasIntent, type NativeCanvasState } from '../../lib/native-canvas';

type Props = { storefront: NativeStorefront };

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

export function BrandHero({ storefront, onStart }: { storefront: NativeStorefront; onStart: (intent: CanvasIntent) => void }) {
  return <section className="adaptive-brand-hero" aria-labelledby="store-title">
    <p className="eyebrow">A considered collection</p>
    <h1 id="store-title">{storefront.name}</h1>
    <p>Tell us what you are looking for. The collection will make room for the next useful choice.</p>
    <IntentChips onSelect={onStart} />
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
    <button type="button" className="adaptive-back-action" onClick={onBack}>← Back to collection</button>
    <div className="adaptive-spotlight-grid">
      <div className="adaptive-spotlight-visual">
        {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span aria-hidden="true">{product.title.slice(0, 1)}</span>}
      </div>
      <div className="adaptive-spotlight-copy">
        <p className="adaptive-product-availability">{availabilityLabel(product.availability)}</p>
        <h2 id="spotlight-title">{product.title}</h2>
        <p>{product.description || 'Description not provided by the store.'}</p>
        <strong className="adaptive-spotlight-price">{formatNativeMoney(product.amountMinor, product.currency)}</strong>
        <button type="button" className="adaptive-primary-action" onClick={onCompare}>Compare with another product</button>
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

export function PersistentIntentInput({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('');
  function submit() { const trimmed = value.trim(); if (!trimmed) return; onSubmit(trimmed); setValue(''); }
  return <form className="adaptive-persistent-input" onSubmit={event => { event.preventDefault(); submit(); }}>
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

export function AdaptiveNativeCanvas({ storefront }: Props) {
  const [state, setState] = useState<NativeCanvasState>(initialNativeCanvasState);
  const selectedProduct = useMemo(() => storefront.products.find(product => product.id === state.selectedProductId) ?? null, [state.selectedProductId, storefront.products]);
  const comparedProducts = useMemo(() => state.comparedProductIds.map(id => storefront.products.find(product => product.id === id)).filter((product): product is NativeProduct => Boolean(product)), [state.comparedProductIds, storefront.products]);

  function handleIntent(intent: CanvasIntent) { setState(current => selectIntent(current, intent, storefront.products)); }
  function handleText(text: string) { handleIntent(reduceTextIntent(text)); }
  function handleProduct(productId: string) { setState(current => selectProduct(current, productId, storefront.products)); }
  function handleCompare(productId: string) { setState(current => toggleComparedProduct(current, productId, storefront.products)); }
  function handleBack() { setState(current => showDiscovery(current)); }

  return <main className="adaptive-store-shell">
    <header className="adaptive-store-header"><button type="button" className="adaptive-brand" onClick={() => setState(current => showEntry(current))} aria-label="Return to storefront entry"><span className="adaptive-brand-mark" aria-hidden="true">{storefront.brandMark ?? storefront.name.slice(0, 1)}</span><span>{storefront.name}</span></button><span className="adaptive-store-currency">{storefront.primaryCurrency}</span></header>
    <ContextStrip intent={state.intent} visible={state.contextVisible} onDismiss={() => setState(current => ({ ...current, contextVisible: false }))} />
    {state.composition === 'entry' && <BrandHero storefront={storefront} onStart={handleIntent} />}
    {state.composition === 'discovery' && <section className="adaptive-discovery" aria-labelledby="discovery-title"><div className="adaptive-section-heading"><div><p className="eyebrow">The collection</p><h1 id="discovery-title">A useful place to begin.</h1></div><div className="adaptive-discovery-actions"><button type="button" className="adaptive-back-action" onClick={() => setState(current => showEntry(current))}>Change direction</button><button type="button" className="adaptive-secondary-action" onClick={() => handleIntent('compare')}>Compare products</button></div></div><p className="adaptive-guidance">Published products, clear prices, and availability from {storefront.name}.</p><div className="adaptive-product-grid">{storefront.products.map(product => <ProductCard key={product.id} product={product} onSelect={() => handleProduct(product.id)} onCompare={() => handleCompare(product.id)} compared={state.comparedProductIds.includes(product.id)} />)}</div></section>}
    {state.composition === 'comparison' && (comparedProducts.length === 2 ? <ComparisonTable products={comparedProducts} onBack={() => setState(current => ({ ...current, comparedProductIds: [], composition: 'comparison' }))} onSelect={handleProduct} /> : <ProductComparison products={storefront.products} onBack={handleBack} onSelect={handleCompare} />)}
    {state.composition === 'spotlight' && selectedProduct && <ProductSpotlight product={selectedProduct} onBack={handleBack} onCompare={() => setState(current => ({ ...current, composition: 'comparison', comparedProductIds: current.selectedProductId ? [current.selectedProductId] : [] }))} />}
    {storefront.products.length === 0 && <div className="adaptive-empty" role="status"><h2>Collection coming soon</h2><p>No published products are available yet. You can return when the store has an approved collection.</p></div>}
    <PersistentIntentInput onSubmit={handleText} />
    <footer className="adaptive-store-footer">{storefront.name} · Prices shown in {storefront.primaryCurrency}</footer>
  </main>;
}
