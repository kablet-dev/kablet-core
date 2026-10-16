import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const pool = { end: vi.fn().mockResolvedValue(undefined) };
  class NativeCartServiceError extends Error { code = ''; cartVersion = null; }
  return {
    pool,
    createDb: vi.fn(() => ({ db: {}, pool })),
    getPublishedStorefront: vi.fn(),
    createNativeStoreRepository: vi.fn(() => ({ getPublishedStorefront })),
    createNativeCartService: vi.fn(),
    loadServerConfig: vi.fn(() => ({ DATABASE_URL: 'postgres://test' })),
    NativeCartServiceError,
  };
});

vi.mock('next/server', () => {
  class MockNextResponse {
    status = 200;
    headers = new Headers();
    cookies = { set: (name: string, value: string, options: Record<string, unknown>) => { this.headers.set('set-cookie', `${name}=${value}; Path=${String(options.path)}; Max-Age=${String(options.maxAge)}`); } };
    static json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
      const response = new MockNextResponse();
      response.status = init.status ?? 200;
      response.headers = new Headers(init.headers);
      (response as MockNextResponse & { body: unknown }).body = data;
      return response;
    }
  }
  return { NextResponse: MockNextResponse };
});
vi.mock('@kablet/config', () => ({ loadServerConfig: mocks.loadServerConfig }));
vi.mock('@kablet/db', () => ({
  createDb: mocks.createDb,
  createNativeStoreRepository: mocks.createNativeStoreRepository,
  createNativeCartService: mocks.createNativeCartService,
  NativeCartServiceError: mocks.NativeCartServiceError,
}));

import { GET, POST } from '../../apps/web/app/api/store/[storeSlug]/cart/route';
import { POST as addLine } from '../../apps/web/app/api/store/[storeSlug]/cart/lines/route';
import { DELETE as removeLine, PATCH as updateLine } from '../../apps/web/app/api/store/[storeSlug]/cart/lines/[lineId]/route';
import { POST as acceptPrice } from '../../apps/web/app/api/store/[storeSlug]/cart/lines/[lineId]/price-acceptance/route';
import { nativeCartCookieName } from '../../apps/web/lib/native-cart-api';

const storefront = {
  id: '10000000-0000-4000-8000-000000000001',
  organizationId: '10000000-0000-4000-8000-000000000002',
  businessId: '10000000-0000-4000-8000-000000000003',
};
const cart = { contractVersion: 'native-cart.v1', cartId: '10000000-0000-4000-8000-000000000004', storeId: storefront.id, organizationId: storefront.organizationId, businessId: storefront.businessId, currency: 'USD', status: 'active', version: 0, expiresAt: new Date(), lastActivityAt: new Date(), lines: [] };
const key = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefg';
const lineId = '10000000-0000-4000-8000-000000000005';
const productId = '10000000-0000-4000-8000-000000000006';
const requestContext = { storeSlug: 'demo' };
const lineContext = { storeSlug: 'demo', lineId };

function mutationRequest(path: string, method: string, body: unknown, token = 'opaque-token') {
  return new Request(`https://shop.example${path}`, {
    method,
    headers: { Host: 'shop.example', Origin: 'https://shop.example', 'Content-Type': 'application/json', Cookie: `${nativeCartCookieName('demo')}=${token}` },
    body: JSON.stringify(body),
  });
}

describe('native cart route boundary', () => {
  beforeEach(() => {
    process.env.KABLET_PUBLIC_ORIGIN = 'https://shop.example';
    mocks.pool.end.mockClear();
    mocks.createDb.mockClear();
    mocks.getPublishedStorefront.mockReset().mockResolvedValue(storefront);
    mocks.createNativeStoreRepository.mockReset().mockReturnValue({ getPublishedStorefront: mocks.getPublishedStorefront });
    mocks.createNativeCartService.mockReset();
  });

  it('does not create an empty cart on a read without a cookie', async () => {
    const service = { getCart: vi.fn(), createCart: vi.fn() };
    mocks.createNativeCartService.mockReturnValue(service);
    const response = await GET(new Request('https://shop.example/api/store/demo/cart', { headers: { Host: 'shop.example' } }), { params: Promise.resolve({ storeSlug: 'demo' }) });
    expect(response.status).toBe(200);
    expect((await response.json()).cart).toBeNull();
    expect(service.getCart).not.toHaveBeenCalled();
    expect(service.createCart).not.toHaveBeenCalled();
    expect(mocks.pool.end).toHaveBeenCalledOnce();
  });

  it('creates the cart server-side and never includes the bearer token in JSON', async () => {
    const service = { createCart: vi.fn().mockResolvedValue({ token: 'opaque-token', cart }), getCart: vi.fn() };
    mocks.createNativeCartService.mockReturnValue(service);
    const response = await POST(new Request('https://shop.example/api/store/demo/cart', { method: 'POST', headers: { Host: 'shop.example', Origin: 'https://shop.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefg' }) }), { params: Promise.resolve({ storeSlug: 'demo' }) });
    expect(response.status).toBe(201);
    expect(service.createCart).toHaveBeenCalledWith({ organizationId: storefront.organizationId, businessId: storefront.businessId, storeId: storefront.id }, { idempotencyKey: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefg' });
    expect(JSON.stringify(await response.clone().json())).not.toContain('opaque-token');
    expect(response.headers.get('set-cookie')).toContain('opaque-token');
    expect(mocks.pool.end).toHaveBeenCalledOnce();
  });

  it('forwards validated add, update, remove, and price-acceptance mutations', async () => {
    const service = {
      addLine: vi.fn().mockResolvedValue({ cart, idempotent: false }),
      updateLine: vi.fn().mockResolvedValue({ cart, idempotent: false }),
      removeLine: vi.fn().mockResolvedValue({ cart, idempotent: true }),
      acceptPrice: vi.fn().mockResolvedValue({ cart, idempotent: false }),
    };
    mocks.createNativeCartService.mockReturnValue(service);
    await addLine(mutationRequest('/api/store/demo/cart/lines', 'POST', { productId, quantity: 2, idempotencyKey: key, expectedCartVersion: 0 }), { params: Promise.resolve(requestContext) });
    await updateLine(mutationRequest(`/api/store/demo/cart/lines/${lineId}`, 'PATCH', { quantity: 1, idempotencyKey: key, expectedCartVersion: 1 }), { params: Promise.resolve(lineContext) });
    await removeLine(mutationRequest(`/api/store/demo/cart/lines/${lineId}`, 'DELETE', { idempotencyKey: key, expectedCartVersion: 2 }), { params: Promise.resolve(lineContext) });
    await acceptPrice(mutationRequest(`/api/store/demo/cart/lines/${lineId}/price-acceptance`, 'POST', { idempotencyKey: key, expectedCartVersion: 2 }), { params: Promise.resolve(lineContext) });
    expect(service.addLine).toHaveBeenCalledWith(expect.objectContaining({ token: 'opaque-token', productId, quantity: 2, idempotencyKey: key, expectedCartVersion: 0 }));
    expect(service.updateLine).toHaveBeenCalledWith(expect.objectContaining({ token: 'opaque-token', lineId, quantity: 1 }));
    expect(service.removeLine).toHaveBeenCalledWith(expect.objectContaining({ token: 'opaque-token', lineId }));
    expect(service.acceptPrice).toHaveBeenCalledWith(expect.objectContaining({ token: 'opaque-token', lineId }));
  });

  it('rejects missing keys, malformed bodies, and cross-origin mutations', async () => {
    const service = { addLine: vi.fn() };
    mocks.createNativeCartService.mockReturnValue(service);
    const missingKey = await addLine(mutationRequest('/api/store/demo/cart/lines', 'POST', { productId, quantity: 1 }), { params: Promise.resolve(requestContext) });
    expect(missingKey.status).toBe(400);
    const malformed = await addLine(new Request('https://shop.example/api/store/demo/cart/lines', { method: 'POST', headers: { Host: 'shop.example', Origin: 'https://shop.example', 'Content-Type': 'application/json', Cookie: `${nativeCartCookieName('demo')}=opaque-token` }, body: '{' }), { params: Promise.resolve(requestContext) });
    expect(malformed.status).toBe(400);
    const crossOrigin = await addLine(new Request('https://shop.example/api/store/demo/cart/lines', { method: 'POST', headers: { Host: 'shop.example', Origin: 'https://evil.example', 'Content-Type': 'application/json', Cookie: `${nativeCartCookieName('demo')}=opaque-token` }, body: JSON.stringify({ productId, quantity: 1, idempotencyKey: key }) }), { params: Promise.resolve(requestContext) });
    expect(crossOrigin.status).toBe(403);
    expect(service.addLine).not.toHaveBeenCalled();
  });

  it('rejects creation keys that are not the required high-entropy format', async () => {
    const response = await POST(new Request('https://shop.example/api/store/demo/cart', { method: 'POST', headers: { Host: 'shop.example', Origin: 'https://shop.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'predictable' }) }), { params: Promise.resolve({ storeSlug: 'demo' }) });
    expect(response.status).toBe(400);
    expect(mocks.createDb).not.toHaveBeenCalled();
  });

  it('clears expired cart cookies and never returns the token in JSON', async () => {
    const error = new mocks.NativeCartServiceError('expired');
    error.code = 'cart_expired';
    const service = { addLine: vi.fn().mockRejectedValue(error) };
    mocks.createNativeCartService.mockReturnValue(service);
    const response = await addLine(mutationRequest('/api/store/demo/cart/lines', 'POST', { productId, quantity: 1, idempotencyKey: key }), { params: Promise.resolve(requestContext) });
    expect(response.status).toBe(410);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(JSON.stringify((response as unknown as { body: unknown }).body)).not.toContain('opaque-token');
  });
});
