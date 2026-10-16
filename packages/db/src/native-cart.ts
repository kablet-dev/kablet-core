import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  nativeCartErrorCodeSchema,
  nativeCartMutationSchema,
  nativeCartSchema,
  type NativeCart,
  type NativeCartErrorCode,
  type NativeCartMutationOperation,
} from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';

type Tx = DatabaseTransaction;
export type NativeCartContext = { organizationId: string; businessId: string; storeId: string };
export type NativeCartMutationInput = NativeCartContext & {
  token: string;
  operation: NativeCartMutationOperation;
  idempotencyKey: string;
  expectedCartVersion?: number;
  lineId?: string;
  productId?: string;
  quantity?: number;
};

export class NativeCartServiceError extends Error {
  readonly code: NativeCartErrorCode;
  readonly cartVersion: number | null;

  constructor(code: NativeCartErrorCode, message: string, cartVersion: number | null = null) {
    super(message);
    this.name = 'NativeCartServiceError';
    this.code = nativeCartErrorCodeSchema.parse(code);
    this.cartVersion = cartVersion;
  }
}

export type NativeCartCreated = { token: string; cart: NativeCart };
export type NativeCartMutationResult = { cart: NativeCart; idempotent: boolean };

const uuidPattern = /^[0-9a-f-]{36}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{32,512}$/;

function assertUuid(value: string): void {
  if (!uuidPattern.test(value)) throw new NativeCartServiceError('invalid_mutation', 'The cart request is invalid.');
}

function hashToken(token: string): Buffer {
  if (!tokenPattern.test(token)) throw new NativeCartServiceError('cart_not_found', 'The cart was not found.');
  return createHash('sha256').update(token, 'utf8').digest();
}

function fingerprint(input: { operation: NativeCartMutationOperation; lineId: string | null; productId: string | null; quantity: number | null; expectedCartVersion: number | null }): string {
  return createHash('sha256').update(JSON.stringify(input), 'utf8').digest('hex');
}

function rowString(row: Record<string, unknown>, key: string): string {
  return String(row[key]);
}

function rowNullableString(row: Record<string, unknown>, key: string): string | null {
  return row[key] === null || row[key] === undefined ? null : String(row[key]);
}

function currentPrice(row: Record<string, unknown>, cartCurrency: string) {
  if (row.catalog_product_id === null || row.product_currency === null || String(row.product_currency) !== cartCurrency) return null;
  return {
    sku: rowString(row, 'product_sku'),
    amountMinor: rowString(row, 'product_amount_minor'),
    currency: String(row.product_currency),
    priceRevision: Number(row.product_price_revision),
  };
}

function lineStatus(row: Record<string, unknown>, price: ReturnType<typeof currentPrice>, cartStatus: string): 'active' | 'stale_price' | 'unavailable' | 'unpublished' | 'expired' {
  if (cartStatus === 'expired') return 'expired';
  if (row.catalog_product_id === null || row.product_status !== 'published') return 'unpublished';
  if (row.product_currency === null || String(row.product_currency) !== String(row.cart_currency)) return 'unavailable';
  if (row.product_availability !== 'available' || row.product_inventory_quantity === null || Number(row.product_inventory_quantity) < Number(row.quantity)) return 'unavailable';
  const changed = !price || price.sku !== String(row.sku_snapshot) || price.amountMinor !== String(row.amount_minor_snapshot) || price.currency !== String(row.currency_snapshot) || price.priceRevision !== Number(row.price_revision_snapshot);
  return changed ? 'stale_price' : 'active';
}

function validAcceptance(row: Record<string, unknown>, price: ReturnType<typeof currentPrice>) {
  if (!price || row.accepted_amount_minor === null || row.accepted_currency === null || row.accepted_price_revision === null || row.accepted_at === null) return null;
  if (String(row.accepted_amount_minor) !== price.amountMinor || String(row.accepted_currency) !== price.currency || Number(row.accepted_price_revision) !== price.priceRevision) return null;
  return {
    acceptedAmountMinor: String(row.accepted_amount_minor),
    acceptedCurrency: String(row.accepted_currency),
    acceptedPriceRevision: Number(row.accepted_price_revision),
    acceptedAt: row.accepted_at,
  };
}

async function cartRows(tx: Tx, cart: Record<string, unknown>): Promise<NativeCart> {
  const lines = await tx.execute(sql`
    select l.id, l.cart_id, l.store_id, l.product_id as line_product_id, l.quantity, l.sku_snapshot, l.amount_minor_snapshot::text,
      l.currency_snapshot, l.price_revision_snapshot, l.accepted_amount_minor::text, l.accepted_currency,
      l.accepted_price_revision, l.accepted_at, c.currency as cart_currency, c.status as cart_status,
      p.id as catalog_product_id, p.status as product_status, p.title as product_title, p.image_url as product_image_url,
      p.sku as product_sku, p.amount_minor::text as product_amount_minor, p.currency as product_currency,
      p.price_revision as product_price_revision, p.availability as product_availability,
      p.inventory_quantity as product_inventory_quantity
    from kablet_native_cart_lines l
    join kablet_native_carts c on c.id = l.cart_id
    left join kablet_native_products p on p.id = l.product_id and p.store_id = l.store_id
    where l.cart_id = ${rowString(cart, 'id')}::uuid
    order by l.created_at asc, l.id asc
  `);
  const mapped = lines.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    const price = currentPrice(row, String(cart.currency));
    return {
      contractVersion: 'native-cart-line.v1' as const,
      lineId: rowString(row, 'id'),
      cartId: rowString(row, 'cart_id'),
      storeId: rowString(row, 'store_id'),
      productId: rowString(row, 'line_product_id'),
      quantity: Number(row.quantity),
      originalPrice: { sku: rowString(row, 'sku_snapshot'), amountMinor: rowString(row, 'amount_minor_snapshot'), currency: rowString(row, 'currency_snapshot'), priceRevision: Number(row.price_revision_snapshot) },
      currentPrice: price,
      priceAcceptance: validAcceptance(row, price),
      status: lineStatus(row, price, String(cart.status)),
      currentTitle: rowNullableString(row, 'product_title'),
      currentImageUrl: rowNullableString(row, 'product_image_url'),
    };
  });
  return nativeCartSchema.parse({
    contractVersion: 'native-cart.v1',
    cartId: rowString(cart, 'id'), storeId: rowString(cart, 'store_id'), organizationId: rowString(cart, 'organization_id'), businessId: rowString(cart, 'business_id'),
    currency: rowString(cart, 'currency'), status: rowString(cart, 'status'), version: Number(cart.version), expiresAt: cart.expires_at, lastActivityAt: cart.last_activity_at, lines: mapped,
  });
}

async function lockCart(tx: Tx, input: NativeCartContext & { token: string }): Promise<Record<string, unknown>> {
  assertUuid(input.organizationId); assertUuid(input.businessId); assertUuid(input.storeId);
  const result = await tx.execute(sql`
    select id, organization_id, business_id, store_id, currency, status, version, expires_at, last_activity_at
    from kablet_native_carts
    where token_hash = ${hashToken(input.token)}
      and organization_id = ${input.organizationId}::uuid
      and business_id = ${input.businessId}::uuid
      and store_id = ${input.storeId}::uuid
    for update
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new NativeCartServiceError('cart_not_found', 'The cart was not found.');
  if (String(row.status) === 'expired' || new Date(String(row.expires_at)).getTime() <= Date.now()) {
    await tx.execute(sql`update kablet_native_carts set status = 'expired', updated_at = now() where id = ${String(row.id)}::uuid`);
    return { ...row, status: 'expired' };
  }
  return row;
}

async function renewCart(tx: Tx, cartId: string): Promise<void> {
  await tx.execute(sql`update kablet_native_carts set last_activity_at = now(), expires_at = now() + interval '30 days', updated_at = now() where id = ${cartId}::uuid`);
}

async function loadPublishedProduct(tx: Tx, context: NativeCartContext, productId: string, quantity: number): Promise<Record<string, unknown>> {
  assertUuid(productId);
  const result = await tx.execute(sql`
    select id, store_id, sku, title, image_url, amount_minor::text, currency, price_revision, status, availability, inventory_quantity
    from kablet_native_products
    where id = ${productId}::uuid and store_id = ${context.storeId}::uuid
      and organization_id = ${context.organizationId}::uuid and business_id = ${context.businessId}::uuid
    for update
  `);
  const product = result.rows[0] as Record<string, unknown> | undefined;
  if (!product || String(product.status) !== 'published') throw new NativeCartServiceError('product_unpublished', 'This product is no longer published.');
  if (String(product.currency) !== String((await tx.execute(sql`select primary_currency from kablet_native_stores where id = ${context.storeId}::uuid and organization_id = ${context.organizationId}::uuid and business_id = ${context.businessId}::uuid`)).rows[0]?.primary_currency)) throw new NativeCartServiceError('currency_mismatch', 'This product currency is not supported by the store.');
  if (String(product.availability) !== 'available') throw new NativeCartServiceError('product_unavailable', 'This product is currently unavailable.');
  if (product.inventory_quantity === null || Number(product.inventory_quantity) < quantity) throw new NativeCartServiceError('insufficient_inventory', 'The requested quantity is not available.');
  return product;
}

function validateQuantity(quantity: number | undefined): number {
  if (quantity === undefined || !Number.isInteger(quantity) || quantity <= 0) throw new NativeCartServiceError('invalid_mutation', 'The requested quantity is invalid.');
  return quantity;
}

export interface NativeCartService {
  createCart(context: NativeCartContext): Promise<NativeCartCreated>;
  getCart(context: NativeCartContext & { token: string }): Promise<NativeCart>;
  addLine(input: Omit<NativeCartMutationInput, 'operation'>): Promise<NativeCartMutationResult>;
  updateLine(input: Omit<NativeCartMutationInput, 'operation'>): Promise<NativeCartMutationResult>;
  removeLine(input: Omit<NativeCartMutationInput, 'operation'>): Promise<NativeCartMutationResult>;
  acceptPrice(input: Omit<NativeCartMutationInput, 'operation'>): Promise<NativeCartMutationResult>;
}

async function applyMutation(db: Database['db'], input: NativeCartMutationInput & { operation: NativeCartMutationOperation }): Promise<NativeCartMutationResult> {
  const quantity = input.quantity === undefined ? null : input.quantity;
  const lineId = input.lineId ?? null;
  const productId = input.productId ?? null;
  const expectedCartVersion = input.expectedCartVersion === undefined ? null : input.expectedCartVersion;
  const requestFingerprint = fingerprint({ operation: input.operation, lineId, productId, quantity, expectedCartVersion });
  const result = await db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
    const cart = await lockCart(tx, input);
    if (String(cart.status) === 'expired') return { expired: true as const, cartVersion: Number(cart.version) };
    const parsedMutation = nativeCartMutationSchema.safeParse({ contractVersion: 'native-cart-mutation.v1', operation: input.operation, cartId: String(cart.id), idempotencyKey: input.idempotencyKey, requestFingerprint, expectedCartVersion, lineId, productId, quantity });
    if (!parsedMutation.success) throw new NativeCartServiceError('invalid_mutation', 'The cart request is invalid.', Number(cart.version));
    const prior = await tx.execute(sql`select request_fingerprint, result_cart_version from kablet_native_cart_mutations where organization_id = ${input.organizationId}::uuid and business_id = ${input.businessId}::uuid and cart_id = ${String(cart.id)}::uuid and idempotency_key = ${input.idempotencyKey}`);
    if (prior.rows[0]) {
      if (String(prior.rows[0].request_fingerprint) !== requestFingerprint) throw new NativeCartServiceError('idempotency_conflict', 'The idempotency key was already used for a different request.', Number(cart.version));
      await renewCart(tx, String(cart.id));
      const refreshed = await tx.execute(sql`select id, organization_id, business_id, store_id, currency, status, version, expires_at, last_activity_at from kablet_native_carts where id = ${String(cart.id)}::uuid`);
      return { cart: await cartRows(tx, refreshed.rows[0] as Record<string, unknown>), idempotent: true };
    }
    if (expectedCartVersion !== null && expectedCartVersion !== Number(cart.version)) throw new NativeCartServiceError('cart_version_conflict', 'The cart changed before this request was applied.', Number(cart.version));

    let resultLineId: string | null = null;
    if (input.operation === 'add_line') {
      const requested = validateQuantity(input.quantity);
      const product = await loadPublishedProduct(tx, input, input.productId!, requested);
      const existing = await tx.execute(sql`select id, quantity from kablet_native_cart_lines where cart_id = ${String(cart.id)}::uuid and product_id = ${input.productId!}::uuid for update`);
      if (existing.rows[0]) {
        const total = Number(existing.rows[0].quantity) + requested;
        await loadPublishedProduct(tx, input, input.productId!, total);
        resultLineId = String(existing.rows[0].id);
        await tx.execute(sql`update kablet_native_cart_lines set quantity = ${total}, updated_at = now() where id = ${resultLineId}::uuid`);
      } else {
        resultLineId = randomUUID();
        await tx.execute(sql`insert into kablet_native_cart_lines(id, organization_id, business_id, store_id, cart_id, product_id, quantity, sku_snapshot, amount_minor_snapshot, currency_snapshot, price_revision_snapshot) values (${resultLineId}::uuid, ${input.organizationId}::uuid, ${input.businessId}::uuid, ${input.storeId}::uuid, ${String(cart.id)}::uuid, ${input.productId!}::uuid, ${requested}, ${String(product.sku)}, ${String(product.amount_minor)}, ${String(product.currency)}, ${Number(product.price_revision)})`);
      }
    } else if (input.operation === 'update_line') {
      const requested = validateQuantity(input.quantity);
      assertUuid(input.lineId!);
      const line = await tx.execute(sql`select id, product_id from kablet_native_cart_lines where id = ${input.lineId!}::uuid and cart_id = ${String(cart.id)}::uuid for update`);
      if (!line.rows[0]) throw new NativeCartServiceError('cart_not_found', 'The cart line was not found.', Number(cart.version));
      await loadPublishedProduct(tx, input, String(line.rows[0].product_id), requested);
      resultLineId = input.lineId!;
      await tx.execute(sql`update kablet_native_cart_lines set quantity = ${requested}, updated_at = now() where id = ${input.lineId!}::uuid`);
    } else if (input.operation === 'remove_line') {
      assertUuid(input.lineId!);
      const removed = await tx.execute(sql`delete from kablet_native_cart_lines where id = ${input.lineId!}::uuid and cart_id = ${String(cart.id)}::uuid returning id`);
      if (!removed.rows[0]) throw new NativeCartServiceError('cart_not_found', 'The cart line was not found.', Number(cart.version));
      resultLineId = input.lineId!;
    } else {
      assertUuid(input.lineId!);
      const line = await tx.execute(sql`select l.id, l.product_id, l.quantity from kablet_native_cart_lines l where l.id = ${input.lineId!}::uuid and l.cart_id = ${String(cart.id)}::uuid for update`);
      if (!line.rows[0]) throw new NativeCartServiceError('cart_not_found', 'The cart line was not found.', Number(cart.version));
      const product = await loadPublishedProduct(tx, input, String(line.rows[0].product_id), Number(line.rows[0].quantity));
      await tx.execute(sql`update kablet_native_cart_lines set accepted_amount_minor = ${String(product.amount_minor)}, accepted_currency = ${String(product.currency)}, accepted_price_revision = ${Number(product.price_revision)}, accepted_at = now(), updated_at = now() where id = ${input.lineId!}::uuid`);
      resultLineId = input.lineId!;
    }
    const updated = await tx.execute(sql`update kablet_native_carts set version = version + 1, last_activity_at = now(), expires_at = now() + interval '30 days', updated_at = now() where id = ${String(cart.id)}::uuid returning id, organization_id, business_id, store_id, currency, status, version, expires_at, last_activity_at`);
    const updatedCart = updated.rows[0] as Record<string, unknown>;
    await tx.execute(sql`insert into kablet_native_cart_mutations(id, organization_id, business_id, store_id, cart_id, operation, idempotency_key, request_fingerprint, result_cart_version, result_line_id) values (${randomUUID()}::uuid, ${input.organizationId}::uuid, ${input.businessId}::uuid, ${input.storeId}::uuid, ${String(cart.id)}::uuid, ${input.operation}, ${input.idempotencyKey}, ${requestFingerprint}, ${Number(updatedCart.version)}, ${resultLineId ? sql`${resultLineId}::uuid` : sql`null`})`);
    return { cart: await cartRows(tx, updatedCart), idempotent: false };
  });
  if ('expired' in result) throw new NativeCartServiceError('cart_expired', 'The cart has expired.', result.cartVersion);
  return result;
}

export function createNativeCartService(db: Database['db']): NativeCartService {
  return {
    async createCart(context: NativeCartContext): Promise<NativeCartCreated> {
      assertUuid(context.organizationId); assertUuid(context.businessId); assertUuid(context.storeId);
      const token = randomBytes(32).toString('base64url');
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
        const store = await tx.execute(sql`select id, primary_currency from kablet_native_stores where id = ${context.storeId}::uuid and organization_id = ${context.organizationId}::uuid and business_id = ${context.businessId}::uuid and status = 'published'`);
        if (!store.rows[0]) throw new NativeCartServiceError('cart_not_found', 'The storefront was not found.');
        const cartId = randomUUID();
        const result = await tx.execute(sql`insert into kablet_native_carts(id, organization_id, business_id, store_id, token_hash, currency, expires_at) values (${cartId}::uuid, ${context.organizationId}::uuid, ${context.businessId}::uuid, ${context.storeId}::uuid, ${hashToken(token)}, ${String(store.rows[0].primary_currency)}, now() + interval '30 days') returning id, organization_id, business_id, store_id, currency, status, version, expires_at, last_activity_at`);
        return { token, cart: await cartRows(tx, result.rows[0] as Record<string, unknown>) };
      });
    },
    async getCart(context: NativeCartContext & { token: string }): Promise<NativeCart> {
      const result = await db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
        const cart = await lockCart(tx, context);
        if (String(cart.status) === 'expired') return { expired: true as const, cartVersion: Number(cart.version) };
        await renewCart(tx, String(cart.id));
        const refreshed = await tx.execute(sql`select id, organization_id, business_id, store_id, currency, status, version, expires_at, last_activity_at from kablet_native_carts where id = ${String(cart.id)}::uuid`);
        return cartRows(tx, refreshed.rows[0] as Record<string, unknown>);
      });
      if ('expired' in result) throw new NativeCartServiceError('cart_expired', 'The cart has expired.', result.cartVersion);
      return result;
    },
    addLine(input: Omit<NativeCartMutationInput, 'operation'>) { return applyMutation(db, { ...input, operation: 'add_line' }); },
    updateLine(input: Omit<NativeCartMutationInput, 'operation'>) { return applyMutation(db, { ...input, operation: 'update_line' }); },
    removeLine(input: Omit<NativeCartMutationInput, 'operation'>) { return applyMutation(db, { ...input, operation: 'remove_line' }); },
    acceptPrice(input: Omit<NativeCartMutationInput, 'operation'>) { return applyMutation(db, { ...input, operation: 'accept_price' }); },
  };
}

export const createNativeCartRepository = createNativeCartService;
