import { formatNativeMoney, type NativeProduct } from '@kablet/domain';
import { isNativeProductSellable } from '../../lib/native-cart-presenter';
import { availabilityLabel } from './NativeProductSpotlight';

type Props = {
  products: NativeProduct[];
  primaryProduct: NativeProduct | null;
  comparedProductIds: string[];
  onSelect: (productId: string) => void;
  onCompare: (productId: string) => void;
  onAdd: (product: NativeProduct) => void;
  addingProductId: string | null;
};

function EditorialProductMedia({ product, prominent = false }: { product: NativeProduct; prominent?: boolean }) {
  return <div className={`adaptive-editorial-product-media${prominent ? ' is-prominent' : ''}`}>
    {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span aria-hidden="true">{product.title.slice(0, 1)}</span>}
  </div>;
}

function ProductAction({ product, onSelect, onCompare, onAdd, adding, prominent = false, compared = false }: { product: NativeProduct; onSelect: () => void; onCompare: () => void; onAdd: () => void; adding: boolean; prominent?: boolean; compared?: boolean }) {
  const sellable = isNativeProductSellable(product);
  return <div className="adaptive-editorial-product-actions">
    <button type="button" className="adaptive-text-action" onClick={onSelect}>View product</button>
    <button type="button" className="adaptive-secondary-action" aria-pressed={compared} onClick={onCompare}>{compared ? 'Selected' : 'Compare'}</button>
    <button type="button" className={`adaptive-primary-action${prominent ? '' : ' adaptive-product-add'}`} disabled={!sellable || adding} onClick={onAdd}>{adding ? 'Adding…' : sellable ? 'Add to cart' : 'Unavailable'}</button>
  </div>;
}

export function NativeDiscoveryExperience({ products, primaryProduct, comparedProductIds, onSelect, onCompare, onAdd, addingProductId }: Props) {
  const alternatives = products.filter(product => product.id !== primaryProduct?.id);
  if (!primaryProduct) return <section className="adaptive-discovery adaptive-editorial-discovery" aria-labelledby="discovery-title"><p className="eyebrow">The collection</p><h1 id="discovery-title">Nothing to choose yet.</h1><p className="adaptive-guidance">No published products are available. Shopping remains available when the merchant publishes a collection.</p></section>;

  return <section className="adaptive-discovery adaptive-editorial-discovery" aria-labelledby="discovery-title">
    <p className="adaptive-editorial-eyebrow">The collection</p>
    <div className="adaptive-editorial-primary">
      <button type="button" className="adaptive-editorial-primary-media-button" onClick={() => onSelect(primaryProduct.id)} aria-label={`View ${primaryProduct.title}`}>
        <EditorialProductMedia product={primaryProduct} prominent />
      </button>
      <div className="adaptive-editorial-primary-copy"><p className="adaptive-product-availability">{availabilityLabel(primaryProduct.availability)}</p><h2>{primaryProduct.title}</h2><p>{primaryProduct.description || 'Description not provided by the store.'}</p><div className="adaptive-editorial-facts"><span>{formatNativeMoney(primaryProduct.amountMinor, primaryProduct.currency)}</span><span>{primaryProduct.fulfillmentType === 'digital' ? 'Digital product' : 'Physical product'}</span></div><ProductAction product={primaryProduct} compared={comparedProductIds.includes(primaryProduct.id)} onSelect={() => onSelect(primaryProduct.id)} onCompare={() => onCompare(primaryProduct.id)} onAdd={() => onAdd(primaryProduct)} adding={addingProductId === primaryProduct.id} prominent /></div>
    </div>
    {alternatives.length > 0 && <section className="adaptive-editorial-alternatives" aria-label="Other published products"><div className="adaptive-editorial-alternatives-heading"><p className="eyebrow">More from the collection</p><span>{alternatives.length} alternative{alternatives.length === 1 ? '' : 's'}</span></div><div className="adaptive-editorial-alternatives-grid">{alternatives.map(product => <article key={product.id} className="adaptive-editorial-alternative"><button type="button" className="adaptive-editorial-alternative-select" onClick={() => onSelect(product.id)} aria-label={`View ${product.title}`}><EditorialProductMedia product={product} /></button><div className="adaptive-editorial-alternative-copy"><p className="adaptive-product-availability">{availabilityLabel(product.availability)}</p><h3>{product.title}</h3><strong>{formatNativeMoney(product.amountMinor, product.currency)}</strong><ProductAction product={product} compared={comparedProductIds.includes(product.id)} onSelect={() => onSelect(product.id)} onCompare={() => onCompare(product.id)} onAdd={() => onAdd(product)} adding={addingProductId === product.id} /></div></article>)}</div></section>}
  </section>;
}
