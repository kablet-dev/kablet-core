import { formatNativeMoney, type NativeProduct } from '@kablet/domain';
import { isNativeProductSellable } from '../../lib/native-cart-presenter';
import type { CanvasIntent } from '../../lib/native-canvas';

export function availabilityLabel(availability: NativeProduct['availability']): string {
  return availability === 'available' ? 'Available now' : availability === 'stale' ? 'Availability being refreshed' : availability === 'unavailable' ? 'Currently unavailable' : 'Availability to be confirmed';
}

export function ProductMediaStage({ product }: { product: NativeProduct }) {
  return <div className="adaptive-spotlight-media-stage">
    <div className="adaptive-spotlight-media-kicker">Selected from the collection</div>
    <div className="adaptive-spotlight-visual">
      {product.imageUrl ? <img src={product.imageUrl} alt={product.title} /> : <span aria-hidden="true">{product.title.slice(0, 1)}</span>}
    </div>
    <div className="adaptive-spotlight-media-caption"><span>{product.sku}</span><span>{product.currency}</span></div>
  </div>;
}

export function ProductFactRow({ label, value }: { label: string; value: string }) {
  return <div className="adaptive-spotlight-fact"><dt>{label}</dt><dd>{value}</dd></div>;
}

export function PurchaseActionGroup({ product, adding, onAdd, onCompare, onBack }: { product: NativeProduct; adding?: boolean; onAdd: () => void; onCompare: () => void; onBack: () => void }) {
  const sellable = isNativeProductSellable(product);
  return <div className="adaptive-spotlight-actions">
    <button type="button" className="adaptive-primary-action adaptive-spotlight-buy" disabled={!sellable || adding} onClick={onAdd}>{adding ? 'Adding…' : sellable ? 'Add to cart' : 'Unavailable'}</button>
    <button type="button" className="adaptive-secondary-action" onClick={onCompare}>Compare with another product</button>
    <button type="button" className="adaptive-text-action" onClick={onBack}>Keep exploring</button>
  </div>;
}

export function ProductSpotlight({ product, intent, onBack, onCompare, onAdd, adding }: { product: NativeProduct; intent?: CanvasIntent | null; onBack: () => void; onCompare: () => void; onAdd: () => void; adding?: boolean }) {
  const intentLabel = intent === 'compare' ? 'A clear view for comparison.' : intent === 'find' ? 'A closer look at this published product.' : 'Product details from the store.';
  return <section className="adaptive-spotlight" aria-labelledby="spotlight-title">
    <div className="adaptive-spotlight-topline"><button type="button" className="adaptive-back-action" onClick={onBack}>← Back to collection</button><span>Product spotlight</span></div>
    <div className="adaptive-spotlight-grid">
      <ProductMediaStage product={product} />
      <div className="adaptive-spotlight-copy">
        <p className="eyebrow">{intentLabel}</p>
        <p className="adaptive-product-availability">{availabilityLabel(product.availability)}</p>
        <h2 id="spotlight-title" tabIndex={-1}>{product.title}</h2>
        <p className="adaptive-spotlight-description">{product.description || 'Description not provided by the store.'}</p>
        <dl className="adaptive-spotlight-facts">
          <ProductFactRow label="Price" value={formatNativeMoney(product.amountMinor, product.currency)} />
          <ProductFactRow label="Availability" value={availabilityLabel(product.availability)} />
          <ProductFactRow label="Fulfillment" value={product.fulfillmentType === 'digital' ? 'Digital product' : 'Physical product'} />
        </dl>
        <PurchaseActionGroup product={product} adding={adding} onAdd={onAdd} onCompare={onCompare} onBack={onBack} />
      </div>
    </div>
  </section>;
}
