import { createHash } from 'node:crypto';
import { createDb, createNativeCartService, createNativeStoreRepository, type NativeCartContext, type NativeCartService } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { nativeStoreSlugSchema } from '@kablet/domain';
import { NextResponse } from 'next/server';
import { NativeCartServiceError } from '@kablet/db';
import { readJsonBody, RequestBodyTooLargeError } from './request-body';
import { z, ZodError } from 'zod';

export const nativeCartMaxBodyBytes = 4096;
export const nativeCartCookieMaxAge = 30 * 24 * 60 * 60;
const nativeCartCookiePrefix = 'kablet_cart_';

export const addNativeCartLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(2147483647),
  idempotencyKey: z.string().trim().min(1).max(200),
  expectedCartVersion: z.number().int().nonnegative().optional(),
}).strict();

export const updateNativeCartLineSchema = z.object({
  quantity: z.number().int().positive().max(2147483647),
  idempotencyKey: z.string().trim().min(1).max(200),
  expectedCartVersion: z.number().int().nonnegative().optional(),
}).strict();

export const cartMutationRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(200),
  expectedCartVersion: z.number().int().nonnegative().optional(),
}).strict();
export const nativeCartCreationIdempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'idempotencyKey must be a 32-byte base64url value');
export const createNativeCartSchema = z.object({ idempotencyKey: nativeCartCreationIdempotencyKeySchema }).strict();
export const nativeCartLineIdSchema = z.string().uuid();

export function nativeCartCookieName(storeSlug: string): string {
  const slug = nativeStoreSlugSchema.parse(storeSlug);
  return `${nativeCartCookiePrefix}${createHash('sha256').update(slug, 'utf8').digest('hex').slice(0, 16)}`;
}

function cookiePath(storeSlug: string): string {
  return `/api/store/${nativeStoreSlugSchema.parse(storeSlug)}`;
}

export function setNativeCartCookie(response: NextResponse, storeSlug: string, token: string): void {
  response.cookies.set(nativeCartCookieName(storeSlug), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: cookiePath(storeSlug),
    maxAge: nativeCartCookieMaxAge,
  });
}

export function clearNativeCartCookie(response: NextResponse, storeSlug: string): void {
  response.cookies.set(nativeCartCookieName(storeSlug), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: cookiePath(storeSlug),
    maxAge: 0,
  });
}

export function readNativeCartToken(request: Request, storeSlug: string): string | undefined {
  const name = nativeCartCookieName(storeSlug);
  const cookies = request.headers.get('cookie')?.split(';') ?? [];
  const entry = cookies.find(value => value.trim().startsWith(`${name}=`));
  return entry ? entry.trim().slice(name.length + 1) || undefined : undefined;
}

function expectedOrigin(request: Request): URL | null {
  const configured = process.env.KABLET_PUBLIC_ORIGIN;
  if (configured) {
    try {
      const url = new URL(configured);
      return process.env.NODE_ENV === 'production' && url.protocol !== 'https:' ? null : url;
    } catch { return null; }
  }
  if (process.env.NODE_ENV === 'production') return null;
  try { return new URL(request.url).origin === 'null' ? null : new URL(request.url); } catch { return null; }
}

export function isSameOriginMutation(request: Request): boolean {
  const expected = expectedOrigin(request);
  if (!expected) return false;
  const origin = request.headers.get('origin');
  try { if (!origin || new URL(origin).origin !== expected.origin) return false; } catch { return false; }
  const trustedProxy = process.env.KABLET_TRUSTED_PROXY_HEADERS === 'true';
  const forwardedHost = trustedProxy ? request.headers.get('x-forwarded-host') : null;
  const requestHost = forwardedHost ?? request.headers.get('host');
  return requestHost === expected.host;
}

export function hasJsonContentType(request: Request): boolean {
  const value = request.headers.get('content-type');
  return value !== null && value.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

export async function readNativeCartJson(request: Request): Promise<unknown> {
  if (!hasJsonContentType(request)) throw new NativeCartApiError('invalid_request', 415);
  return readJsonBody(request, nativeCartMaxBodyBytes);
}

export class NativeCartApiError extends Error {
  constructor(readonly code: 'invalid_request' | 'origin_mismatch', readonly status: 400 | 403 | 415 = 400) {
    super(code);
    this.name = 'NativeCartApiError';
  }
}

export type NativeCartStoreRuntime = {
  runtime: ReturnType<typeof createDb>;
  service: NativeCartService;
  context: NativeCartContext;
};

export async function openNativeCartStore(storeSlug: string): Promise<NativeCartStoreRuntime | null> {
  const parsed = nativeStoreSlugSchema.safeParse(storeSlug);
  if (!parsed.success) return null;
  const runtime = createDb(loadServerConfig().DATABASE_URL);
  try {
    const storefront = await createNativeStoreRepository(runtime.db).getPublishedStorefront(parsed.data);
    if (!storefront) {
      await runtime.pool.end();
      return null;
    }
    return {
      runtime,
      service: createNativeCartService(runtime.db),
      context: { organizationId: storefront.organizationId, businessId: storefront.businessId, storeId: storefront.id },
    };
  } catch (error) {
    await runtime.pool.end().catch(() => undefined);
    throw error;
  }
}

const publicErrorMessages: Record<string, string> = {
  cart_not_found: 'The cart was not found.',
  cart_expired: 'The cart has expired.',
  product_unpublished: 'This product is no longer available.',
  product_unavailable: 'This product is currently unavailable.',
  insufficient_inventory: 'The requested quantity is not available.',
  currency_mismatch: 'This product cannot be added to the cart.',
  cart_version_conflict: 'The cart changed before this request was applied.',
  idempotency_conflict: 'The request key was already used for a different request.',
  invalid_mutation: 'The cart request was invalid.',
  product_not_sellable: 'This product cannot be added to the cart.',
  price_changed: 'The product price has changed.',
};

export function cartErrorResponse(error: unknown): NextResponse {
  if (error instanceof NativeCartApiError || error instanceof RequestBodyTooLargeError || error instanceof SyntaxError || error instanceof ZodError) {
    const status = error instanceof NativeCartApiError ? error.status : error instanceof RequestBodyTooLargeError ? 413 : 400;
    return NextResponse.json({ code: error instanceof NativeCartApiError ? error.code : 'invalid_request', message: error instanceof NativeCartApiError && error.code === 'origin_mismatch' ? 'The request origin was not authorized.' : 'The cart request was invalid.' }, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Origin' } });
  }
  if (error instanceof NativeCartServiceError) {
    const status = error.code === 'cart_expired' ? 410 : error.code === 'cart_not_found' ? 404 : ['cart_version_conflict', 'idempotency_conflict', 'product_unpublished', 'product_unavailable', 'insufficient_inventory', 'currency_mismatch', 'price_changed', 'product_not_sellable'].includes(error.code) ? 409 : 400;
    return NextResponse.json({ contractVersion: 'native-cart-mutation.v1', code: error.code, message: publicErrorMessages[error.code] ?? 'The cart request could not be completed.', cartVersion: error.cartVersion }, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Origin' } });
  }
  return NextResponse.json({ code: 'unavailable', message: 'The cart is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Origin' } });
}

export function cartJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Origin' } });
}
