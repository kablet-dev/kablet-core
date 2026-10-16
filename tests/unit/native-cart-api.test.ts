import { describe, expect, it, afterEach, vi } from 'vitest';

vi.mock('next/server', () => {
  class MockNextResponse {
    headers = new Headers();
    cookies = { set: (name: string, value: string, options: Record<string, unknown>) => {
      const attributes = [
        options.httpOnly ? 'HttpOnly' : '',
        options.secure ? 'Secure' : '',
        options.sameSite ? `SameSite=${String(options.sameSite).replace(/^./, value => value.toUpperCase())}` : '',
        options.path ? `Path=${String(options.path)}` : '',
        options.maxAge !== undefined ? `Max-Age=${String(options.maxAge)}` : '',
      ].filter(Boolean).join('; ');
      this.headers.set('set-cookie', `${name}=${value}; ${attributes}`);
    } };
    static json(_data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
      const response = new MockNextResponse();
      response.headers = new Headers(init.headers);
      return response;
    }
  }
  return { NextResponse: MockNextResponse };
});

import { NextResponse } from 'next/server';
import {
  addNativeCartLineSchema,
  cartMutationRequestSchema,
  clearNativeCartCookie,
  hasJsonContentType,
  isSameOriginMutation,
  nativeCartCookieName,
  setNativeCartCookie,
} from '../../apps/web/lib/native-cart-api';

const originalOrigin = process.env.KABLET_PUBLIC_ORIGIN;
const originalProxy = process.env.KABLET_TRUSTED_PROXY_HEADERS;

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.KABLET_PUBLIC_ORIGIN;
  else process.env.KABLET_PUBLIC_ORIGIN = originalOrigin;
  if (originalProxy === undefined) delete process.env.KABLET_TRUSTED_PROXY_HEADERS;
  else process.env.KABLET_TRUSTED_PROXY_HEADERS = originalProxy;
});

describe('native cart browser API boundary', () => {
  it('isolates cookie names and scopes cookies to the store API', () => {
    expect(nativeCartCookieName('northstar')).not.toBe(nativeCartCookieName('velora-demo'));
    const response = NextResponse.json({ cart: null });
    setNativeCartCookie(response, 'velora-demo', 'opaque-token');
    const header = response.headers.get('set-cookie') ?? '';
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/api/store/velora-demo');
    expect(header).toContain('Max-Age=2592000');
    expect(header).toContain('opaque-token');
    const cleared = NextResponse.json({ cart: null });
    clearNativeCartCookie(cleared, 'velora-demo');
    expect(cleared.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('requires matching origin and host for mutations', () => {
    process.env.KABLET_PUBLIC_ORIGIN = 'https://shop.example';
    delete process.env.KABLET_TRUSTED_PROXY_HEADERS;
    expect(isSameOriginMutation(new Request('https://shop.example/api/store/demo/cart', { method: 'POST', headers: { Origin: 'https://shop.example', Host: 'shop.example' } }))).toBe(true);
    expect(isSameOriginMutation(new Request('https://shop.example/api/store/demo/cart', { method: 'POST', headers: { Origin: 'https://evil.example', Host: 'shop.example' } }))).toBe(false);
    expect(isSameOriginMutation(new Request('https://shop.example/api/store/demo/cart', { method: 'POST', headers: { Origin: 'https://shop.example', Host: 'evil.example' } }))).toBe(false);
    expect(isSameOriginMutation(new Request('https://shop.example/api/store/demo/cart', { method: 'POST', headers: { Host: 'shop.example' } }))).toBe(false);
  });

  it('supports explicitly configured trusted proxy host forwarding', () => {
    process.env.KABLET_PUBLIC_ORIGIN = 'https://shop.example';
    process.env.KABLET_TRUSTED_PROXY_HEADERS = 'true';
    expect(isSameOriginMutation(new Request('http://internal:3000/api/store/demo/cart', { method: 'POST', headers: { Origin: 'https://shop.example', Host: 'internal:3000', 'x-forwarded-host': 'shop.example' } }))).toBe(true);
    expect(isSameOriginMutation(new Request('http://internal:3000/api/store/demo/cart', { method: 'POST', headers: { Origin: 'https://shop.example', Host: 'internal:3000', 'x-forwarded-host': 'evil.example' } }))).toBe(false);
  });

  it('strictly validates JSON mutation inputs', () => {
    expect(addNativeCartLineSchema.safeParse({ productId: '00000000-0000-4000-8000-000000000001', quantity: 1, idempotencyKey: 'add-1', unexpected: true }).success).toBe(false);
    expect(cartMutationRequestSchema.safeParse({ idempotencyKey: '', expectedCartVersion: 0 }).success).toBe(false);
    expect(hasJsonContentType(new Request('https://shop.example', { headers: { 'Content-Type': 'application/json; charset=utf-8' } }))).toBe(true);
    expect(hasJsonContentType(new Request('https://shop.example', { headers: { 'Content-Type': 'text/plain' } }))).toBe(false);
  });
});
