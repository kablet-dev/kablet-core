import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createDb: vi.fn(), createCommerceRepository: vi.fn() }));
vi.mock('@kablet/config', () => ({ loadControlServerConfig: () => ({ DATABASE_URL: 'postgres://control' }) }));
vi.mock('@kablet/db', () => ({ createDb: mocks.createDb, createCommerceRepository: mocks.createCommerceRepository }));

import { POST } from '../../apps/web/app/api/webhooks/shopify/route';

const db = { pool: { end: vi.fn().mockResolvedValue(undefined) } };
const commerce = { resolveConnectionForWebhook: vi.fn(), acceptVerifiedWebhook: vi.fn() };
const secret = 'synthetic-shopify-secret';

function signedRequest(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/webhooks/shopify', { method: 'POST', body, headers: { 'x-shopify-hmac-sha256': createHmac('sha256', secret).update(body).digest('base64'), 'x-shopify-shop-domain': 'demo.myshopify.com', 'x-shopify-event-id': 'event-1', 'x-shopify-topic': 'products/update', ...headers } });
}

describe('Shopify webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHOPIFY_CLIENT_SECRET = secret;
    mocks.createDb.mockReturnValue(db);
    mocks.createCommerceRepository.mockReturnValue(commerce);
    commerce.resolveConnectionForWebhook.mockResolvedValue({ rows: [{ id: '40000000-0000-4000-8000-000000000001', organization_id: '20000000-0000-4000-8000-000000000001', business_id: '30000000-0000-4000-8000-000000000001' }] });
    commerce.acceptVerifiedWebhook.mockResolvedValue({ rows: [{ id: 'inbox-1' }] });
  });

  it('rejects missing or invalid signatures before database access', async () => {
    const response = await POST(new Request('http://localhost/api/webhooks/shopify', { method: 'POST', body: '{}', headers: { 'x-shopify-shop-domain': 'demo.myshopify.com' } }));
    expect(response.status).toBe(401);
    expect(mocks.createDb).not.toHaveBeenCalled();
  });

  it('persists a verified event before acknowledging it', async () => {
    const response = await POST(signedRequest(JSON.stringify({ id: 'product-1', title: 'Product' })));
    expect(response.status).toBe(202);
    expect(commerce.acceptVerifiedWebhook).toHaveBeenCalledWith(expect.objectContaining({ connectionId: '40000000-0000-4000-8000-000000000001' }));
  });

  it('rejects an authenticated webhook for an unknown shop without accepting it', async () => {
    commerce.resolveConnectionForWebhook.mockResolvedValueOnce({ rows: [] });
    const response = await POST(signedRequest(JSON.stringify({ id: 'product-1', title: 'Product' })));
    expect(response.status).toBe(404);
    expect(commerce.acceptVerifiedWebhook).not.toHaveBeenCalled();
  });

  it('rejects missing event identity before persistence', async () => {
    const body = JSON.stringify({ id: 'product-1', title: 'Product' });
    const signature = createHmac('sha256', secret).update(body).digest('base64');
    const response = await POST(new Request('http://localhost/api/webhooks/shopify', { method: 'POST', body, headers: { 'x-shopify-hmac-sha256': signature, 'x-shopify-shop-domain': 'demo.myshopify.com', 'x-shopify-topic': 'products/update' } }));
    expect(response.status).toBe(400);
    expect(commerce.acceptVerifiedWebhook).not.toHaveBeenCalled();
  });
});
