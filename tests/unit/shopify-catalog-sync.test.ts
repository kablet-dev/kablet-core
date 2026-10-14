import { describe, expect, it, vi } from 'vitest';
import { syncShopifyCatalog } from '../../apps/worker/src/shopify-catalog-sync';

function repository() {
  return {
    beginCatalogSync: vi.fn().mockResolvedValue({ rows: [{ id: 'sync-1', cursor: null }] }),
    resumeCatalogSync: vi.fn().mockResolvedValue({ rows: [{ id: 'sync-1', cursor: null }] }),
    claimCatalogSync: vi.fn().mockResolvedValue({ id: 'sync-1', cursor: null, records_seen: 0, records_applied: 0 }),
    checkpointCatalogSync: vi.fn().mockResolvedValue({ rows: [{ id: 'sync-1' }] }),
    finishCatalogSync: vi.fn().mockResolvedValue({ rows: [{ id: 'sync-1', status: 'completed' }] }),
    upsertProduct: vi.fn().mockResolvedValue({ rows: [{ id: 'product-1' }] }),
    upsertVariant: vi.fn().mockResolvedValue({ rows: [{ id: 'variant-1' }] }),
  };
}

describe('Shopify catalog synchronization', () => {
  it('progresses through multiple pages and finalizes only after checkpointing each page', async () => {
    const repo = repository();
    const credentialReader = vi.fn().mockResolvedValue('server-token');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ products: [{ id: 'p1', title: 'One', updated_at: '2026-01-01T00:00:00Z', variants: [] }] }), { status: 200, headers: { link: '<https://shop/admin/api/2026-01/products.json?page_info=cursor-2>; rel="next"' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ products: [{ id: 'p2', title: 'Two', updated_at: '2026-01-02T00:00:00Z', variants: [] }] }), { status: 200 }));
    const result = await syncShopifyCatalog({ repository: repo as never, organizationId: 'org', businessId: 'business', connectionId: 'connection', shopDomain: 'demo.myshopify.com', apiVersion: '2026-01', workerId: 'worker', credentialReader, fetcher });
    expect(result).toMatchObject({ recordsSeen: 2, recordsApplied: 2, status: 'completed' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(credentialReader).toHaveBeenCalledTimes(2);
    expect(repo.checkpointCatalogSync).toHaveBeenCalledTimes(2);
    expect(repo.finishCatalogSync).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('marks a provider outage failed and never reports freshness', async () => {
    const repo = repository();
    const fetcher = vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 }));
    await expect(syncShopifyCatalog({ repository: repo as never, organizationId: 'org', businessId: 'business', connectionId: 'connection', shopDomain: 'demo.myshopify.com', apiVersion: '2026-01', workerId: 'worker', credentialReader: vi.fn().mockResolvedValue('server-token'), fetcher })).rejects.toThrow('shopify_catalog_retryable_failure');
    expect(repo.finishCatalogSync).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('fails closed when credential access is revoked between pages', async () => {
    const repo = repository();
    const credentialReader = vi.fn().mockResolvedValueOnce('server-token').mockRejectedValueOnce(new Error('credential_revoked'));
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ products: [{ id: 'p1', title: 'One', updated_at: '2026-01-01T00:00:00Z', variants: [] }] }), { status: 200, headers: { link: '<https://shop/admin/api/2026-01/products.json?page_info=cursor-2>; rel="next"' } }));
    await expect(syncShopifyCatalog({ repository: repo as never, organizationId: 'org', businessId: 'business', connectionId: 'connection', shopDomain: 'demo.myshopify.com', apiVersion: '2026-01', workerId: 'worker', credentialReader, fetcher })).rejects.toThrow('credential_revoked');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(repo.finishCatalogSync).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('fails closed when a worker cannot claim an already-owned sync', async () => {
    const repo = repository();
    repo.claimCatalogSync.mockResolvedValueOnce(null);
    await expect(syncShopifyCatalog({ repository: repo as never, organizationId: 'org', businessId: 'business', connectionId: 'connection', shopDomain: 'demo.myshopify.com', apiVersion: '2026-01', workerId: 'worker', credentialReader: vi.fn(), fetcher: vi.fn() })).rejects.toThrow('catalog_sync_not_claimed');
  });
});
