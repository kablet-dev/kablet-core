import { formatNativeMoney, type NativeGuidancePreference, type NativeGuidanceResponse, type NativeProduct } from '@kablet/domain';

type Props = {
  guidance: NativeGuidanceResponse | null;
  products: NativeProduct[];
  onPreference: (preference: NativeGuidancePreference) => void;
  onProduct: (productId: string) => void;
};

export function NativeGuidance({ guidance, products, onPreference, onProduct }: Props) {
  if (!guidance) return null;
  return <section className="adaptive-native-guidance" aria-live="polite" aria-label="Merchant-grounded guidance">
    <p className="eyebrow">From the merchant's catalog</p>
    <h3>{guidance.heading}</h3>
    <p>{guidance.body}</p>
    {guidance.facts.length > 0 && <ul className="adaptive-native-guidance-facts">{guidance.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>}
    {guidance.options.length > 0 && <div className="adaptive-native-guidance-options" aria-label="Supported directions">
      {guidance.options.map(option => <button key={option.preference} type="button" onClick={() => onPreference(option.preference)}>{option.label}</button>)}
    </div>}
    {guidance.products.length > 0 && <div className="adaptive-native-guidance-products" aria-label="Products from this guidance">
      {guidance.products.map(product => {
        const catalogProduct = products.find(item => item.id === product.productId);
        const availability = product.availability === 'available' ? 'Available now' : product.availability === 'unknown' ? 'Availability not confirmed' : product.availability === 'stale' ? 'Availability needs review' : 'Currently unavailable';
        return <button key={product.productId} type="button" onClick={() => onProduct(product.productId)}>
          <span>{catalogProduct?.title ?? product.title} · {availability}</span>
          <strong>{formatNativeMoney(product.amountMinor, product.currency)}</strong>
        </button>;
      })}
    </div>}
  </section>;
}
