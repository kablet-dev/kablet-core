import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { commerceProductSchema, commerceVariantSchema, type CommerceProduct, type CommerceVariant, providerErrorSchema } from '@kablet/domain';

export const SHOPIFY_REQUIRED_SCOPES = ['read_products', 'read_inventory'] as const;
export type ShopifyScope = typeof SHOPIFY_REQUIRED_SCOPES[number];

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeShopifyDomain(value: string): string {
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) throw new Error('invalid_shop_domain');
  return domain;
}

export function verifyShopifyWebhook(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return safeEqual(expected, signature);
}

export function verifyShopifyOAuthQuery(params: URLSearchParams, secret: string): boolean {
  const supplied = params.get('hmac');
  if (!supplied || !secret) return false;
  const canonical = [...params.entries()].filter(([key]) => key !== 'hmac' && key !== 'signature').sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
  return safeEqual(createHmac('sha256', secret).update(canonical).digest('hex'), supplied);
}

export function createShopifyOAuthState() {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: createHash('sha256').update(raw, 'utf8').digest('hex') };
}

function decimalToMinor(value: string): string | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(`${whole}${fraction.padEnd(2, '0')}`).toString();
}

export function buildShopifyInstallUrl(input: { clientId: string; shopDomain: string; redirectUri: string; state: string; scopes?: readonly string[] }): string {
  const shop = normalizeShopifyDomain(input.shopDomain);
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('scope', (input.scopes ?? SHOPIFY_REQUIRED_SCOPES).join(','));
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  return url.toString();
}

export async function exchangeShopifyCode(input: { shopDomain: string; clientId: string; clientSecret: string; code: string; fetcher?: typeof fetch }) {
  const shop = normalizeShopifyDomain(input.shopDomain);
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(`https://${shop}/admin/oauth/access_token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: input.clientId, client_secret: input.clientSecret, code: input.code }) });
  if (!response.ok) throw new Error('shopify_oauth_exchange_failed');
  const body = await response.json() as { access_token?: unknown; scope?: unknown; associated_user_scope?: unknown };
  if (typeof body.access_token !== 'string' || typeof body.scope !== 'string') throw new Error('shopify_oauth_response_invalid');
  const scopes = body.scope.split(',').map(value => value.trim()).filter(Boolean);
  if (SHOPIFY_REQUIRED_SCOPES.some(scope => !scopes.includes(scope))) throw new Error('shopify_required_scope_missing');
  return { accessToken: body.access_token, scopes };
}

export function normalizeShopifyProduct(input: unknown, observedAt = new Date()): { product: CommerceProduct; variants: CommerceVariant[] } {
  if (!input || typeof input !== 'object') throw new Error('shopify_product_invalid');
  const source = input as Record<string, unknown>;
  const externalId = String(source.id ?? '');
  const providerRevision = typeof source.updated_at === 'string' ? source.updated_at : null;
  const sourceEvidence = { providerRevision, state: providerRevision ? ('authoritative' as const) : ('unknown' as const) };
  const product = commerceProductSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', externalId, title: String(source.title ?? ''), description: String(source.body_html ?? ''), status: source.status === 'active' || source.status === 'draft' || source.status === 'archived' ? source.status : 'unknown', availability: 'unknown', sourceUpdatedAt: source.updated_at ?? null, observedAt, ingestionRevision: 1, sourceEvidence, imageUrls: Array.isArray(source.images) ? source.images.flatMap(image => image && typeof image === 'object' && typeof (image as Record<string, unknown>).src === 'string' ? [(image as Record<string, unknown>).src] : []) : [] });
  const variants = Array.isArray(source.variants) ? source.variants.map((value, index) => {
    const variant = value as Record<string, unknown>;
    const quantity = typeof variant.inventory_quantity === 'number' && Number.isInteger(variant.inventory_quantity) && variant.inventory_quantity >= 0 ? variant.inventory_quantity : null;
    const currency = typeof source.currency === 'string' && /^[A-Z]{3}$/.test(source.currency) ? source.currency : null;
    const amountMinor = typeof variant.price === 'string' ? decimalToMinor(variant.price) : null;
    return commerceVariantSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', externalId: String(variant.id ?? ''), productExternalId: externalId, title: String(variant.title ?? 'Default'), price: currency && amountMinor ? { amountMinor, currency } : null, availableQuantity: quantity, availability: quantity === null ? 'unknown' : quantity > 0 ? 'available' : 'unavailable', sourceUpdatedAt: source.updated_at ?? null, observedAt, ingestionRevision: 1, sourceEvidence });
  }) : [];
  return { product, variants };
}

export function classifyShopifyError(status: number, providerCode: string | null = null) {
  const error = status === 401 ? { kind: 'authentication', retryable: false } : status === 403 ? { kind: 'authorization', retryable: false } : status === 404 ? { kind: 'not_found', retryable: false } : status === 429 ? { kind: 'rate_limited', retryable: true } : status >= 500 ? { kind: 'transient', retryable: true } : { kind: 'invalid_request', retryable: false };
  return providerErrorSchema.parse({ ...error, providerCode, message: 'Shopify request failed' });
}

export function createShopifyClient(input: { shopDomain: string; requiredScopes?: readonly string[]; credentialReader: (requiredScopes: string[]) => Promise<string>; fetcher?: typeof fetch }) {
  const shop = normalizeShopifyDomain(input.shopDomain);
  const fetcher = input.fetcher ?? fetch;
  return {
    async get(path: string) {
      const secret = await input.credentialReader([...(input.requiredScopes ?? SHOPIFY_REQUIRED_SCOPES)]);
      const url = new URL(path, `https://${shop}/admin/api/`);
      const response = await fetcher(url, { headers: { 'x-shopify-access-token': secret, accept: 'application/json' } });
      if (!response.ok) throw classifyShopifyError(response.status, response.headers.get('x-request-id'));
      return response.json();
    },
  };
}
