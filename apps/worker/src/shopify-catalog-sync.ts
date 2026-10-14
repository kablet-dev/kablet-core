import type { createCommerceRepository } from '@kablet/db';
import { normalizeShopifyProduct } from './shopify-worker.js';

type CommerceRepository = ReturnType<typeof createCommerceRepository>;
type ShopifyPage = { products?: unknown; next_cursor?: unknown };

function nextCursor(response: Response, body: ShopifyPage): string | null {
  if (typeof body.next_cursor === 'string' && body.next_cursor) return body.next_cursor;
  const link = response.headers.get('link');
  const next = link?.split(',').find(value => /rel="next"/.test(value));
  if (!next) return null;
  const match = next.match(/[?&]page_info=([^&>]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function syncShopifyCatalog(input: {
  repository: CommerceRepository;
  organizationId: string;
  businessId: string;
  connectionId: string;
  shopDomain: string;
  apiVersion: string;
  workerId: string;
  credentialReader: (requiredScopes: string[]) => Promise<string>;
  fetcher?: typeof fetch;
  syncId?: string;
  kind?: 'initial' | 'incremental' | 'reconciliation';
}) {
  const fetcher = input.fetcher ?? fetch;
  const sync = input.syncId
    ? await input.repository.resumeCatalogSync({ organizationId: input.organizationId, businessId: input.businessId, syncId: input.syncId })
    : await input.repository.beginCatalogSync({ organizationId: input.organizationId, businessId: input.businessId, connectionId: input.connectionId, syncKind: input.kind ?? 'initial' });
  const syncRow = sync.rows[0] as { id: string; cursor?: string | null } | undefined;
  if (!syncRow) throw new Error('catalog_sync_unavailable');
  const claimed = await input.repository.claimCatalogSync({ organizationId: input.organizationId, businessId: input.businessId, connectionId: input.connectionId, workerId: input.workerId });
  if (!claimed || String(claimed.id) !== String(syncRow.id)) throw new Error('catalog_sync_not_claimed');
  let cursor = claimed.cursor ?? null;
  let seen = Number(claimed.records_seen ?? 0);
  let applied = Number(claimed.records_applied ?? 0);
  try {
    do {
      const token = await input.credentialReader(['read_products', 'read_inventory']);
      const url = new URL(`https://${input.shopDomain}/admin/api/${encodeURIComponent(input.apiVersion)}/products.json`);
      url.searchParams.set('limit', '250');
      if (cursor) url.searchParams.set('page_info', cursor);
      const response = await fetcher(url, { headers: { accept: 'application/json', 'x-shopify-access-token': token } });
      if (response.status === 429 || response.status >= 500) throw new Error('shopify_catalog_retryable_failure');
      if (!response.ok) throw new Error('shopify_catalog_request_failed');
      const body = await response.json() as ShopifyPage;
      if (!Array.isArray(body.products)) throw new Error('shopify_catalog_response_invalid');
      for (const raw of body.products) {
        if (!raw || typeof raw !== 'object') throw new Error('shopify_catalog_product_invalid');
        const normalized = normalizeShopifyProduct(raw as Record<string, unknown>);
        const product = await input.repository.upsertProduct({ organizationId: input.organizationId, businessId: input.businessId, connectionId: input.connectionId, product: normalized.product });
        const productId = String(product.rows[0]?.id ?? '');
        if (!productId) {
          seen += 1;
          continue;
        }
        for (const variant of normalized.variants) {
          await input.repository.upsertVariant({ organizationId: input.organizationId, businessId: input.businessId, connectionId: input.connectionId, productId, variant });
        }
        seen += 1;
        applied += 1;
      }
      cursor = nextCursor(response, body);
      await input.repository.checkpointCatalogSync({ organizationId: input.organizationId, businessId: input.businessId, syncId: String(syncRow.id), cursor, recordsSeen: seen, recordsApplied: applied });
    } while (cursor);
    await input.repository.finishCatalogSync({ organizationId: input.organizationId, businessId: input.businessId, syncId: String(syncRow.id), status: 'completed' });
    return { syncId: String(syncRow.id), recordsSeen: seen, recordsApplied: applied, status: 'completed' as const };
  } catch (error) {
    await input.repository.finishCatalogSync({ organizationId: input.organizationId, businessId: input.businessId, syncId: String(syncRow.id), status: 'failed', errorMessage: error instanceof Error ? error.message : 'catalog_sync_failed' });
    throw error;
  }
}
