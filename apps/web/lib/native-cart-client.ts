import { nativeCartErrorCodeSchema, nativeCartSchema, type NativeCart, type NativeCartErrorCode } from '@kablet/domain';
import { nativeStoreSlugSchema } from '@kablet/domain';
import { z } from 'zod';

const idempotencyKeyPattern = /^[A-Za-z0-9_-]{43}$/;
const mutationKeySchema = z.string().trim().min(1).max(200);

const cartResponseSchema = z.object({ cart: nativeCartSchema.nullable() }).strict();
const createdCartResponseSchema = z.object({ cart: nativeCartSchema }).strict();
const mutationResponseSchema = z.object({ cart: nativeCartSchema, idempotent: z.boolean() }).strict();
const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  cartVersion: z.number().int().nonnegative().nullable().optional(),
}).passthrough();

export type NativeCartClientFetch = typeof fetch;
export type NativeCartMutationOptions = { idempotencyKey?: string; expectedCartVersion?: number };

export type NativeCartClientErrorCode = NativeCartErrorCode | 'invalid_request' | 'origin_mismatch' | 'unavailable' | 'invalid_response' | 'network_error' | 'http_error';

export class NativeCartClientError extends Error {
  readonly code: NativeCartClientErrorCode;
  readonly status: number | null;
  readonly cartVersion: number | null;
  readonly retryKey: string | null;
  readonly uncertain: boolean;

  constructor(input: {
    code: NativeCartClientErrorCode;
    message: string;
    status?: number | null;
    cartVersion?: number | null;
    retryKey?: string | null;
    uncertain?: boolean;
  }) {
    super(input.message);
    this.name = 'NativeCartClientError';
    this.code = input.code;
    this.status = input.status ?? null;
    this.cartVersion = input.cartVersion ?? null;
    this.retryKey = input.retryKey ?? null;
    this.uncertain = input.uncertain ?? false;
  }
}

function randomBase64UrlKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createNativeCartIdempotencyKey(): string {
  const key = randomBase64UrlKey();
  if (!idempotencyKeyPattern.test(key)) throw new NativeCartClientError({ code: 'invalid_response', message: 'Unable to create a valid cart request key.' });
  return key;
}

function createMutationKey(provided?: string): string {
  const key = provided ?? createNativeCartIdempotencyKey();
  return mutationKeySchema.parse(key);
}

function pathFor(storeSlug: string, suffix = ''): string {
  const slug = nativeStoreSlugSchema.parse(storeSlug);
  return `/api/store/${encodeURIComponent(slug)}/cart${suffix}`;
}

function knownErrorCode(value: string): NativeCartClientErrorCode {
  if (nativeCartErrorCodeSchema.safeParse(value).success) return value as NativeCartErrorCode;
  if (value === 'invalid_request' || value === 'origin_mismatch' || value === 'unavailable') return value;
  return 'http_error';
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw new NativeCartClientError({ code: 'invalid_response', message: 'The cart response was invalid.', status: response.status }); }
}

export class NativeCartClient {
  private readonly fetcher: NativeCartClientFetch;

  constructor(readonly storeSlug: string, fetcher: NativeCartClientFetch = (...args) => globalThis.fetch(...args)) {
    this.storeSlug = nativeStoreSlugSchema.parse(storeSlug);
    this.fetcher = fetcher;
  }

  async getCart(): Promise<NativeCart | null> {
    const response = await this.request(pathFor(this.storeSlug), { method: 'GET' });
    const payload = await readJson(response);
    const parsed = cartResponseSchema.safeParse(payload);
    if (!response.ok) throw this.errorFromResponse(response, payload);
    if (!parsed.success) throw new NativeCartClientError({ code: 'invalid_response', message: 'The cart response was invalid.', status: response.status });
    return parsed.data.cart;
  }

  async createCart(idempotencyKey = createNativeCartIdempotencyKey()): Promise<NativeCart> {
    if (!idempotencyKeyPattern.test(idempotencyKey)) throw new NativeCartClientError({ code: 'invalid_response', message: 'The cart request key was invalid.', retryKey: idempotencyKey });
    return this.mutation(pathFor(this.storeSlug), 'POST', { idempotencyKey }, idempotencyKey, createdCartResponseSchema).then(result => result.cart);
  }

  async addLine(productId: string, quantity: number, options?: NativeCartMutationOptions): Promise<NativeCart> {
    const idempotencyKey = createMutationKey(options?.idempotencyKey);
    const body = { productId, quantity, idempotencyKey, ...(options?.expectedCartVersion === undefined ? {} : { expectedCartVersion: options.expectedCartVersion }) };
    return this.mutation(pathFor(this.storeSlug, '/lines'), 'POST', body, idempotencyKey, mutationResponseSchema).then(result => result.cart);
  }

  async updateLine(lineId: string, quantity: number, options?: NativeCartMutationOptions): Promise<NativeCart> {
    const idempotencyKey = createMutationKey(options?.idempotencyKey);
    const body = { quantity, idempotencyKey, ...(options?.expectedCartVersion === undefined ? {} : { expectedCartVersion: options.expectedCartVersion }) };
    return this.mutation(pathFor(this.storeSlug, `/lines/${encodeURIComponent(lineId)}`), 'PATCH', body, idempotencyKey, mutationResponseSchema).then(result => result.cart);
  }

  async removeLine(lineId: string, options?: NativeCartMutationOptions): Promise<NativeCart> {
    const idempotencyKey = createMutationKey(options?.idempotencyKey);
    const body = { idempotencyKey, ...(options?.expectedCartVersion === undefined ? {} : { expectedCartVersion: options.expectedCartVersion }) };
    return this.mutation(pathFor(this.storeSlug, `/lines/${encodeURIComponent(lineId)}`), 'DELETE', body, idempotencyKey, mutationResponseSchema).then(result => result.cart);
  }

  async acceptPrice(lineId: string, options?: NativeCartMutationOptions): Promise<NativeCart> {
    const idempotencyKey = createMutationKey(options?.idempotencyKey);
    const body = { idempotencyKey, ...(options?.expectedCartVersion === undefined ? {} : { expectedCartVersion: options.expectedCartVersion }) };
    return this.mutation(pathFor(this.storeSlug, `/lines/${encodeURIComponent(lineId)}/price-acceptance`), 'POST', body, idempotencyKey, mutationResponseSchema).then(result => result.cart);
  }

  private async request(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    try { return await this.fetcher(input, { ...init, credentials: 'include', cache: 'no-store' }); }
    catch { throw new NativeCartClientError({ code: 'network_error', message: 'The cart could not be reached.' }); }
  }

  private async mutation<T extends { cart: NativeCart }>(path: string, method: string, body: unknown, retryKey: string, schema: z.ZodType<T>): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(path, { method, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new NativeCartClientError({ code: 'network_error', message: 'The cart mutation may not have completed. Retry the same operation with its existing key.', retryKey, uncertain: true });
    }
    const payload = await readJson(response).catch(error => {
      if (error instanceof NativeCartClientError) throw new NativeCartClientError({ ...error, retryKey, uncertain: true });
      throw error;
    });
    if (!response.ok) throw this.errorFromResponse(response, payload, retryKey);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new NativeCartClientError({ code: 'invalid_response', message: 'The cart response was invalid. The mutation result is uncertain; do not retry with a new key.', status: response.status, retryKey, uncertain: true });
    return parsed.data;
  }

  private errorFromResponse(response: Response, payload: unknown, retryKey: string | null = null): NativeCartClientError {
    const parsed = errorResponseSchema.safeParse(payload);
    if (!parsed.success) return new NativeCartClientError({ code: 'invalid_response', message: 'The cart response was invalid.', status: response.status, retryKey, uncertain: response.status >= 500 });
    return new NativeCartClientError({
      code: knownErrorCode(parsed.data.code),
      message: parsed.data.message ?? 'The cart request could not be completed.',
      status: response.status,
      cartVersion: parsed.data.cartVersion ?? null,
      retryKey,
      uncertain: response.status >= 500,
    });
  }
}
