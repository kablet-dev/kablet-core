import { notFound } from 'next/navigation';
import { createDb, createNativeStoreRepository } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { formatNativeMoney } from '@kablet/domain';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }) {
  return { title: `Native Store · ${(await params).storeSlug}` };
}

export default async function NativeStorePage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const runtime = createDb(loadServerConfig().DATABASE_URL);
  try {
    const storefront = await createNativeStoreRepository(runtime.db).getPublishedStorefront(storeSlug);
    if (!storefront) notFound();
    return (
      <main className="native-store-shell">
        <header className="native-store-header">
          <div className="native-store-brand">
            <span className="native-store-brand-mark" aria-hidden="true">{storefront.brandMark ?? storefront.name.slice(0, 1)}</span>
            <span>{storefront.name}</span>
          </div>
          <span className="native-store-currency">{storefront.primaryCurrency}</span>
        </header>
        <section className="native-store-hero" aria-labelledby="store-title">
          <p className="eyebrow">The collection</p>
          <h1 id="store-title">{storefront.name}</h1>
          <p>Thoughtfully chosen for your next chapter, with clear prices and availability from the store.</p>
        </section>
        <section className="native-store-products" aria-label={`${storefront.name} products`}>
          {storefront.products.length === 0 ? (
            <div className="native-store-empty"><h2>Collection coming soon</h2><p>This store is preparing its first collection.</p></div>
          ) : storefront.products.map(product => (
            <article className="native-product-card" key={product.id}>
              <div className="native-product-image">
                {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span aria-hidden="true">{product.title.slice(0, 1)}</span>}
              </div>
              <div className="native-product-copy">
                <div><p className="native-product-availability">{product.availability === 'available' ? 'Available now' : product.availability === 'stale' ? 'Availability being refreshed' : 'Availability to be confirmed'}</p><h2>{product.title}</h2></div>
                <p>{product.description || 'A considered addition to your everyday.'}</p>
                <strong>{formatNativeMoney(product.amountMinor, product.currency)}</strong>
              </div>
            </article>
          ))}
        </section>
        <footer className="native-store-footer">{storefront.name} · Prices shown in {storefront.primaryCurrency}</footer>
      </main>
    );
  } finally {
    await runtime.pool.end();
  }
}
