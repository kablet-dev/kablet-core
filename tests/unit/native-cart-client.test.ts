import { describe, expect, it } from 'vitest';
import { NativeCartClient, NativeCartClientError, createNativeCartIdempotencyKey } from '../../apps/web/lib/native-cart-client';
import { NativeCartController } from '../../apps/web/lib/native-cart-state';

const storeId = '85000000-0000-4000-8000-000000000001';
const productId = '85000000-0000-4000-8000-000000000002';

function cart(version = 0, id = '85000000-0000-4000-8000-000000000003') {
  return {
    contractVersion: 'native-cart.v1', cartId: id, storeId, organizationId: '85000000-0000-4000-8000-000000000004', businessId: '85000000-0000-4000-8000-000000000005',
    currency: 'USD', status: 'active', version, expiresAt: '2026-11-16T00:00:00.000Z', lastActivityAt: '2026-10-17T00:00:00.000Z', lines: [],
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('native browser cart client', () => {
  it('generates cryptographically sized base64url creation keys', () => {
    const key = createNativeCartIdempotencyKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hydrates an existing cart without exposing or sending a bearer token', async () => {
    const calls: Array<{ path: string; init: RequestInit }> = [];
    const client = new NativeCartClient('demo-store', async (path, init) => {
      calls.push({ path: String(path), init });
      return response({ cart: cart() });
    });
    await expect(client.getCart()).resolves.toMatchObject({ cartId: cart().cartId });
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/api/store/demo-store/cart');
    expect(calls[0].init.credentials).toBe('include');
    expect(calls[0].init.headers).toBeUndefined();
    expect(JSON.stringify(calls)).not.toContain('token');
  });

  it('keeps an empty cart state on initial GET and never bootstraps during hydration', async () => {
    const calls: string[] = [];
    const client = new NativeCartClient('demo-store', async path => {
      calls.push(String(path));
      return response({ cart: null });
    });
    const controller = new NativeCartController('demo-store', () => client);
    await expect(controller.load()).resolves.toBeNull();
    expect(controller.getState().cart).toBeNull();
    expect(calls).toEqual(['/api/store/demo-store/cart']);
  });

  it('keeps the same mutation key available when a request outcome is uncertain', async () => {
    const key = 'mutation-key-1';
    const client = new NativeCartClient('demo-store', async () => { throw new Error('connection lost'); });
    const error = await client.addLine(productId, 1, { idempotencyKey: key }).catch(value => value as NativeCartClientError);
    expect(error.code).toBe('network_error');
    expect(error.uncertain).toBe(true);
    expect(error.retryKey).toBe(key);
  });

  it('creates the cart only when the first add is requested and then sends the add', async () => {
    const calls: Array<{ path: string; init: RequestInit }> = [];
    const client = new NativeCartClient('demo-store', async (path, init) => {
      calls.push({ path: String(path), init });
      return calls.length === 1 ? response({ cart: cart() }, 201) : response({ cart: cart(1), idempotent: false });
    });
    const controller = new NativeCartController('demo-store', () => client);
    await controller.addLine(productId, 1);
    expect(calls.map(call => call.path)).toEqual(['/api/store/demo-store/cart', '/api/store/demo-store/cart/lines']);
    const creationBody = JSON.parse(String(calls[0].init.body)) as { idempotencyKey: string };
    const mutationBody = JSON.parse(String(calls[1].init.body)) as { idempotencyKey: string };
    expect(creationBody.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mutationBody.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(creationBody.idempotencyKey).not.toBe(mutationBody.idempotencyKey);
    expect(JSON.stringify(calls)).not.toContain('opaque-token');
    expect(controller.getState().cart?.version).toBe(1);
  });

  it('serializes mutations and advances the expected version from authoritative responses', async () => {
    const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
    let active = 0;
    let maximumActive = 0;
    const client = new NativeCartClient('demo-store', async (path, init) => {
      active += 1; maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      const body = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      calls.push({ path: String(path), body });
      if (!String(path).endsWith('/lines')) return response({ cart: cart(0) }, 201);
      const version = calls.length;
      return response({ cart: cart(version), idempotent: false }, 200);
    });
    const controller = new NativeCartController('demo-store', () => client);
    const first = controller.addLine(productId, 1);
    const second = controller.addLine(productId, 1);
    await Promise.all([first, second]);
    expect(maximumActive).toBe(1);
    const mutationCalls = calls.filter(call => call.path.endsWith('/lines'));
    expect(mutationCalls).toHaveLength(2);
    expect(mutationCalls[1].body.expectedCartVersion).toBe(2);
  });

  it('refreshes after a version conflict and preserves the recoverable error', async () => {
    let lineAttempt = 0;
    const refreshed = cart(2);
    const client = new NativeCartClient('demo-store', async (path, init) => {
      if (String(path).endsWith('/lines')) {
        lineAttempt += 1;
        return response({ contractVersion: 'native-cart-mutation.v1', code: 'cart_version_conflict', message: 'The cart changed before this request was applied.', cartVersion: 2 }, 409);
      }
      if (init.method === 'GET') return response({ cart: refreshed });
      return response({ cart: cart(0) }, 201);
    });
    const controller = new NativeCartController('demo-store', () => client);
    await controller.load();
    await expect(controller.addLine(productId, 1)).rejects.toMatchObject({ code: 'cart_version_conflict' });
    expect(lineAttempt).toBe(1);
    expect(controller.getState().cart?.version).toBe(2);
    expect(controller.getState().error?.code).toBe('cart_version_conflict');
  });

  it('ignores a stale response after switching stores', async () => {
    let resolveOld!: (value: Response) => void;
    const oldResponse = new Promise<Response>(resolve => { resolveOld = resolve; });
    const oldClient = new NativeCartClient('old-store', async () => oldResponse);
    const newClient = new NativeCartClient('new-store', async () => response({ cart: cart(4, '85000000-0000-4000-8000-000000000006') }));
    const controller = new NativeCartController('old-store', slug => slug === 'old-store' ? oldClient : newClient);
    const oldLoad = controller.load();
    controller.setStore('new-store');
    await controller.load();
    resolveOld(response({ cart: cart(1) }));
    await oldLoad;
    expect(controller.getState().cart?.cartId).toBe('85000000-0000-4000-8000-000000000006');
  });
});
