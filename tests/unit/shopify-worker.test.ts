import { describe, expect, it, vi } from 'vitest';
import { processShopifyWebhook } from '../../apps/worker/src/shopify-worker';

describe('Shopify webhook worker', () => {
  it('normalizes a product event and persists every variant through the repository', async () => {
    const repository = { upsertProduct: vi.fn().mockResolvedValue({ rows: [{ id: 'product-1' }] }), upsertVariant: vi.fn().mockResolvedValue({ rows: [{ id: 'variant-1' }] }) };
    await processShopifyWebhook({ repository: repository as never, organizationId: '73000000-0000-4000-8000-000000000001', businessId: '74000000-0000-4000-8000-000000000001', connectionId: '75000000-0000-4000-8000-000000000001', eventType: 'products/update', payload: { id: 'external-product', title: 'Product', status: 'active', variants: [{ id: 'external-variant', title: 'Default', inventory_quantity: 4 }] } });
    expect(repository.upsertProduct).toHaveBeenCalledOnce();
    expect(repository.upsertVariant).toHaveBeenCalledOnce();
  });

  it('does not mutate catalog state for unsupported event topics', async () => {
    const repository = { upsertProduct: vi.fn(), upsertVariant: vi.fn() };
    await processShopifyWebhook({ repository: repository as never, organizationId: '73000000-0000-4000-8000-000000000001', businessId: '74000000-0000-4000-8000-000000000001', connectionId: '75000000-0000-4000-8000-000000000001', eventType: 'app/uninstalled', payload: {} });
    expect(repository.upsertProduct).not.toHaveBeenCalled();
  });
});
