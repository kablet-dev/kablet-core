import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildShopifyInstallUrl, createShopifyOAuthState, createShopifyClient, normalizeShopifyProduct, verifyShopifyOAuthQuery, verifyShopifyWebhook } from '../../apps/web/lib/shopify-provider';

describe('Shopify provider boundary', () => {
  it('verifies the raw webhook body with constant-time-compatible inputs', () => {
    const body = JSON.stringify({ id: 1 });
    const signature = createHmac('sha256', 'synthetic-secret').update(body).digest('base64');
    expect(verifyShopifyWebhook(body, signature, 'synthetic-secret')).toBe(true);
    expect(verifyShopifyWebhook(body, signature.slice(0, -1), 'synthetic-secret')).toBe(false);
    expect(verifyShopifyWebhook(body, signature, 'wrong-secret')).toBe(false);
  });

  it('creates a replay-resistant install URL and rejects invalid shop identity', () => {
    const state = createShopifyOAuthState();
    const url = new URL(buildShopifyInstallUrl({ clientId: 'client', shopDomain: 'Demo-Shop.myshopify.com', redirectUri: 'https://app.example.test/callback', state: state.raw }));
    expect(url.hostname).toBe('demo-shop.myshopify.com');
    expect(url.searchParams.get('state')).toBe(state.raw);
    expect(url.searchParams.get('scope')).toBe('read_products,read_inventory');
    expect(() => buildShopifyInstallUrl({ clientId: 'client', shopDomain: 'evil.example.test', redirectUri: 'https://app.example.test/callback', state: state.raw })).toThrow('invalid_shop_domain');
  });

  it('validates OAuth callback HMAC over canonical query parameters', () => {
    const params = new URLSearchParams({ code: 'code', shop: 'demo-shop.myshopify.com', state: 'state' });
    const canonical = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
    params.set('hmac', createHmac('sha256', 'oauth-secret').update(canonical).digest('hex'));
    expect(verifyShopifyOAuthQuery(params, 'oauth-secret')).toBe(true);
    params.set('state', 'replayed-or-tampered');
    expect(verifyShopifyOAuthQuery(params, 'oauth-secret')).toBe(false);
  });

  it('does not invent currency when normalizing catalog data', () => {
    const normalized = normalizeShopifyProduct({ id: 'p-1', title: 'Product', body_html: '', status: 'active', updated_at: '2026-01-01T00:00:00Z', variants: [{ id: 'v-1', title: 'Default', price: '12.50', inventory_quantity: 3 }] });
    expect(normalized.product.externalId).toBe('p-1');
    expect(normalized.variants[0].price).toBeNull();
    expect(normalized.variants[0].availability).toBe('available');
  });

  it('resolves credentials immediately before provider execution', async () => {
    const credentialReader = vi.fn().mockResolvedValue('server-only-token');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ products: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const client = createShopifyClient({ shopDomain: 'demo-shop.myshopify.com', credentialReader, fetcher });
    await expect(client.get('2026-01/products.json')).resolves.toEqual({ products: [] });
    expect(credentialReader).toHaveBeenCalledWith(['read_products', 'read_inventory']);
    expect(fetcher.mock.calls[0][1]).not.toMatchObject({ body: 'server-only-token' });
  });
});
