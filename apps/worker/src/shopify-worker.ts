import { commerceProductSchema, commerceVariantSchema } from '@kablet/domain';
import type { createCommerceRepository } from '@kablet/db';

function decimalToMinor(value: string): string | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(`${whole}${fraction.padEnd(2, '0')}`).toString();
}

export function normalizeShopifyProduct(payload: Record<string, unknown>, observedAt = new Date()) {
  const externalId = String(payload.id ?? '');
  const providerRevision = typeof payload.updated_at === 'string' ? payload.updated_at : null;
  const sourceEvidence = { providerRevision, state: providerRevision ? ('authoritative' as const) : ('unknown' as const) };
  const product = commerceProductSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', externalId, title: String(payload.title ?? ''), description: String(payload.body_html ?? ''), status: payload.status === 'active' || payload.status === 'draft' || payload.status === 'archived' ? payload.status : 'unknown', availability: 'unknown', sourceUpdatedAt: payload.updated_at ?? null, observedAt, ingestionRevision: 1, sourceEvidence, imageUrls: Array.isArray(payload.images) ? payload.images.flatMap(image => image && typeof image === 'object' && typeof (image as Record<string, unknown>).src === 'string' ? [(image as Record<string, unknown>).src] : []) : [] });
  const variants = Array.isArray(payload.variants) ? payload.variants.map(item => {
    const variant = item as Record<string, unknown>;
    const quantity = typeof variant.inventory_quantity === 'number' && Number.isInteger(variant.inventory_quantity) && variant.inventory_quantity >= 0 ? variant.inventory_quantity : null;
    const currency = typeof payload.currency === 'string' && /^[A-Z]{3}$/.test(payload.currency) ? payload.currency : null;
    const amountMinor = typeof variant.price === 'string' ? decimalToMinor(variant.price) : null;
    return commerceVariantSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', externalId: String(variant.id ?? ''), productExternalId: externalId, title: String(variant.title ?? 'Default'), price: currency && amountMinor ? { amountMinor, currency } : null, availableQuantity: quantity, availability: quantity === null ? 'unknown' : quantity > 0 ? 'available' : 'unavailable', sourceUpdatedAt: payload.updated_at ?? null, observedAt, ingestionRevision: 1, sourceEvidence });
  }) : [];
  return { product, variants };
}

export async function processShopifyWebhook(input: { repository: ReturnType<typeof createCommerceRepository>; organizationId: string; businessId: string; connectionId: string; eventType: string; payload: unknown }) {
  if (!input.payload || typeof input.payload !== 'object') throw new Error('webhook_payload_invalid');
  if (!input.eventType.startsWith('products/')) return;
  const normalized = normalizeShopifyProduct(input.payload as Record<string, unknown>);
  const productResult = await input.repository.upsertProduct({ organizationId: input.organizationId, businessId: input.businessId, connectionId: input.connectionId, product: normalized.product });
  const productId = String(productResult.rows[0]?.id ?? '');
  if (!productId) return;
  for (const variant of normalized.variants) await input.repository.upsertVariant({ organizationId: input.organizationId, businessId: input.businessId, connectionId: input.connectionId, productId, variant });
}
