import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  nativeCheckoutErrorCodeSchema,
  nativeCheckoutSessionSchema,
  nativeInventoryReservationSchema,
  nativeShippingAddressSchema,
  type NativeCheckoutContact,
  type NativeCheckoutLine,
  type NativeCheckoutSession,
  type NativeCheckoutStatus,
  type NativeChargeSnapshot,
  type NativeInventoryReservation,
  type NativeShippingAddress,
  type NativeCart,
} from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';
import { createNativeCartService, type NativeCartContext } from './native-cart.js';
import type { NativeIntelligenceLineage } from './native-intelligence.js';

type Tx = DatabaseTransaction;
const reservationTtlMinutes = 15;
const tokenPattern = /^[A-Za-z0-9_-]{32,512}$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;

export type NativeCheckoutServiceErrorCode = ReturnType<typeof nativeCheckoutErrorCodeSchema.parse>;

export class NativeCheckoutServiceError extends Error {
  readonly code: NativeCheckoutServiceErrorCode;

  constructor(code: NativeCheckoutServiceErrorCode, message: string) {
    super(message);
    this.name = 'NativeCheckoutServiceError';
    this.code = nativeCheckoutErrorCodeSchema.parse(code);
  }
}

export type NativeCheckoutPolicyInput = {
  context: NativeCartContext;
  currency: string;
  lines: Array<Pick<NativeCheckoutLine, 'productId' | 'sku' | 'quantity' | 'unitAmountMinor' | 'lineAmountMinor' | 'currency' | 'priceRevision'>>;
  contact: NativeCheckoutContact;
  shippingAddress: NativeShippingAddress | null;
};

export type NativeCheckoutPolicyResult = {
  shippingEligibility: 'eligible' | 'ineligible' | 'unavailable' | 'not_required';
  shippingCharge: NativeChargeSnapshot;
  tax: NativeChargeSnapshot;
  serverTotal: Extract<NativeChargeSnapshot, { state: 'calculated' }>;
  policyId?: string;
  policyRevision?: number;
};

export type NativeCheckoutServiceOptions = {
  calculateShippingAndTax?: (input: NativeCheckoutPolicyInput) => Promise<NativeCheckoutPolicyResult>;
};

export type NativeReservationConfirmationInput = NativeCartContext & {
  token: string;
  idempotencyKey: string;
  contact: NativeCheckoutContact;
  shippingAddress: NativeShippingAddress | null;
  attribution?: NativeIntelligenceLineage | null;
};

export type NativeReservationConfirmationResult = {
  checkout: NativeCheckoutSession;
  reservations: NativeInventoryReservation[];
  idempotent: boolean;
};

export type NativeReservationOperationResult = {
  reservation: NativeInventoryReservation;
  idempotent: boolean;
};

function assertUuid(value: string): void {
  if (!uuidPattern.test(value)) throw new NativeCheckoutServiceError('checkout_not_found', 'The checkout was not found.');
}

function hashToken(token: string): Buffer {
  if (!tokenPattern.test(token)) throw new NativeCheckoutServiceError('checkout_not_found', 'The checkout was not found.');
  return createHash('sha256').update(token, 'utf8').digest();
}

function hashKey(key: string): Buffer {
  if (!key.trim() || key.length > 200) throw new NativeCheckoutServiceError('idempotency_conflict', 'The reservation request key is invalid.');
  return createHash('sha256').update(key, 'utf8').digest();
}

function requestFingerprint(input: NativeReservationConfirmationInput, cart: NativeCart['lines'], cartVersion: number): string {
  return createHash('sha256').update(JSON.stringify({
    cartVersion,
    contact: input.contact,
    shippingAddress: input.shippingAddress,
    lines: cart.map(line => ({ productId: line.productId, quantity: line.quantity, sku: line.originalPrice.sku, amountMinor: line.originalPrice.amountMinor, currency: line.originalPrice.currency, priceRevision: line.originalPrice.priceRevision })),
  }), 'utf8').digest('hex');
}

function rowString(row: Record<string, unknown>, key: string): string { return String(row[key]); }
function rowNullableString(row: Record<string, unknown>, key: string): string | null { return row[key] === null || row[key] === undefined ? null : String(row[key]); }

function chargeSnapshot(row: Record<string, unknown>, prefix: string): NativeChargeSnapshot {
  const state = String(row[`${prefix}_state`]) as NativeChargeSnapshot['state'];
  if (state === 'calculated') return { state, amountMinor: String(row[`${prefix}_amount_minor`]), currency: String(row[`${prefix}_currency`]) };
  return { state, amountMinor: null, currency: null } as NativeChargeSnapshot;
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  return value as Record<string, unknown>;
}

function mapReservation(row: Record<string, unknown>): NativeInventoryReservation {
  return nativeInventoryReservationSchema.parse({
    contractVersion: 'native-inventory-reservation.v1', reservationId: row.id, checkoutId: row.checkout_id, checkoutLineId: row.checkout_line_id,
    storeId: row.store_id, productId: row.product_id, sku: row.sku_snapshot, quantity: Number(row.quantity), status: row.status,
    expiresAt: row.expires_at, createdAt: row.created_at, updatedAt: row.updated_at, committedAt: row.committed_at, releasedAt: row.released_at,
  });
}

async function loadCheckout(tx: Tx, checkoutId: string): Promise<{ checkout: NativeCheckoutSession; reservations: NativeInventoryReservation[] }> {
  const sessionResult = await tx.execute(sql`select id, store_id, cart_id, cart_version, checkout_revision, fulfillment_type, status, currency, contact_email, contact_name, contact_phone, shipping_address, shipping_eligibility, shipping_charge_state, shipping_charge_amount_minor::text, shipping_charge_currency, tax_state, tax_amount_minor::text, tax_currency, server_total_state, server_total_amount_minor::text, server_total_currency, customer_confirmation_revision, expires_at, created_at, updated_at from kablet_native_checkout_sessions where id=${checkoutId}::uuid`);
  const session = sessionResult.rows[0] as Record<string, unknown> | undefined;
  if (!session) throw new NativeCheckoutServiceError('checkout_not_found', 'The checkout was not found.');
  const linesResult = await tx.execute(sql`select id, checkout_id, store_id, product_id, fulfillment_type, sku_snapshot, quantity, unit_amount_minor::text, line_amount_minor::text, currency_snapshot, price_revision_snapshot, product_title_snapshot from kablet_native_checkout_lines where checkout_id=${checkoutId}::uuid order by product_id asc, id asc`);
  const reservationsResult = await tx.execute(sql`select id, checkout_id, checkout_line_id, store_id, product_id, sku_snapshot, quantity, status, expires_at, created_at, updated_at, committed_at, released_at from kablet_native_inventory_reservations where checkout_id=${checkoutId}::uuid order by product_id asc, id asc`);
  const lines = linesResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return {
      contractVersion: 'native-checkout-line.v1' as const, lineId: row.id, checkoutId: row.checkout_id, storeId: row.store_id, productId: row.product_id,
      fulfillmentType: row.fulfillment_type, sku: row.sku_snapshot, quantity: Number(row.quantity), unitAmountMinor: row.unit_amount_minor,
      lineAmountMinor: row.line_amount_minor, currency: row.currency_snapshot, priceRevision: Number(row.price_revision_snapshot), productTitleSnapshot: row.product_title_snapshot,
    };
  });
  const checkout = nativeCheckoutSessionSchema.parse({
    contractVersion: 'native-checkout.v1', checkoutId: session.id, storeId: session.store_id, cartId: session.cart_id, cartVersion: Number(session.cart_version),
    checkoutRevision: Number(session.checkout_revision), fulfillmentType: session.fulfillment_type, status: session.status, currency: session.currency,
    contact: session.contact_email === null ? null : { email: String(session.contact_email), name: String(session.contact_name), phone: rowNullableString(session, 'contact_phone') },
    shippingAddress: jsonObject(session.shipping_address), shippingEligibility: session.shipping_eligibility,
    shippingCharge: chargeSnapshot(session, 'shipping_charge'), tax: chargeSnapshot(session, 'tax'), serverTotal: chargeSnapshot(session, 'server_total'),
    customerConfirmationRevision: session.customer_confirmation_revision === null ? null : Number(session.customer_confirmation_revision),
    expiresAt: session.expires_at, createdAt: session.created_at, updatedAt: session.updated_at, lines,
  });
  return { checkout, reservations: reservationsResult.rows.map(row => mapReservation(row as Record<string, unknown>)) };
}

function assertPolicyResult(result: NativeCheckoutPolicyResult, currency: string): void {
  if (result.shippingEligibility !== 'eligible' && result.shippingEligibility !== 'not_required') throw new NativeCheckoutServiceError('shipping_unavailable', 'Shipping is not available for this checkout.');
  if (result.serverTotal.state !== 'calculated' || result.serverTotal.currency !== currency) throw new NativeCheckoutServiceError('policy_unavailable', 'The merchant checkout policy could not calculate a final total.');
  for (const charge of [result.shippingCharge, result.tax]) {
    if (charge.state === 'calculated' && charge.currency !== currency) throw new NativeCheckoutServiceError('currency_mismatch', 'A checkout charge uses an unsupported currency.');
  }
}

async function findExistingMutation(db: Database['db'], context: NativeCartContext, cartId: string, keyHash: Buffer, requestHash: string): Promise<NativeReservationConfirmationResult | null> {
  return db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
    const result = await tx.execute(sql`select m.request_fingerprint, m.checkout_id, s.cart_id from kablet_native_reservation_mutations m join kablet_native_checkout_sessions s on s.id=m.checkout_id where m.organization_id=${context.organizationId}::uuid and m.business_id=${context.businessId}::uuid and m.store_id=${context.storeId}::uuid and m.cart_id=${cartId}::uuid and m.idempotency_key_hash=${keyHash} and s.cart_id=${cartId}::uuid`);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    if (String(row.request_fingerprint) !== requestHash) throw new NativeCheckoutServiceError('idempotency_conflict', 'The reservation request key was already used for different checkout data.');
    const loaded = await loadCheckout(tx, String(row.checkout_id));
    return { checkout: loaded.checkout, reservations: loaded.reservations, idempotent: true };
  });
}

export function createNativeCheckoutReservationService(db: Database['db'], options: NativeCheckoutServiceOptions = {}) {
  const cartService = createNativeCartService(db);
  return {
    async getCheckout(input: NativeCartContext & { token: string; checkoutId: string }): Promise<{ checkout: NativeCheckoutSession; reservations: NativeInventoryReservation[] }> {
      assertUuid(input.checkoutId);
      const tokenHash = hashToken(input.token);
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
        const owned = await tx.execute(sql`select s.id from kablet_native_checkout_sessions s join kablet_native_carts c on c.id=s.cart_id and c.organization_id=s.organization_id and c.business_id=s.business_id and c.store_id=s.store_id where s.id=${input.checkoutId}::uuid and s.organization_id=${input.organizationId}::uuid and s.business_id=${input.businessId}::uuid and s.store_id=${input.storeId}::uuid and (c.token_hash=${tokenHash} or exists (select 1 from kablet_native_cart_tokens t where t.cart_id=c.id and t.token_hash=${tokenHash} and t.expires_at>now()))`);
        if (!owned.rows[0]) throw new NativeCheckoutServiceError('checkout_not_found', 'The checkout was not found.');
        return loadCheckout(tx, input.checkoutId);
      });
    },
    async confirmReservation(input: NativeReservationConfirmationInput): Promise<NativeReservationConfirmationResult> {
      assertUuid(input.organizationId); assertUuid(input.businessId); assertUuid(input.storeId);
      if (input.shippingAddress) nativeShippingAddressSchema.parse(input.shippingAddress);
      if (!options.calculateShippingAndTax) throw new NativeCheckoutServiceError('policy_unavailable', 'Merchant shipping and tax policy is unavailable.');
      const cart = await cartService.getCart({ organizationId: input.organizationId, businessId: input.businessId, storeId: input.storeId, token: input.token });
      if (cart.lines.length === 0) throw new NativeCheckoutServiceError('cart_empty', 'The cart has no sellable lines.');
      for (const line of cart.lines) {
        if (line.status === 'stale_price' && !line.priceAcceptance) throw new NativeCheckoutServiceError('price_changed', 'A cart line requires explicit price acceptance.');
        if (line.status === 'unpublished') throw new NativeCheckoutServiceError('product_unpublished', 'A cart product is no longer published.');
        if (line.status === 'unavailable' || line.status === 'expired') throw new NativeCheckoutServiceError('product_unavailable', 'A cart product is unavailable.');
        if (!line.currentPrice || !line.currentTitle) throw new NativeCheckoutServiceError('price_changed', 'A cart line is no longer authoritative.');
      }
      const keyHash = hashKey(input.idempotencyKey);
      const fingerprint = requestFingerprint(input, cart.lines, cart.version);
      const existing = await findExistingMutation(db, input, cart.cartId, keyHash, fingerprint);
      if (existing) return existing;
      const policyInput: NativeCheckoutPolicyInput = {
        context: { organizationId: input.organizationId, businessId: input.businessId, storeId: input.storeId }, currency: cart.currency,
        lines: cart.lines.map(line => ({ productId: line.productId, sku: line.currentPrice!.sku, quantity: line.quantity, unitAmountMinor: line.currentPrice!.amountMinor, lineAmountMinor: (BigInt(line.currentPrice!.amountMinor) * BigInt(line.quantity)).toString(), currency: line.currentPrice!.currency, priceRevision: line.currentPrice!.priceRevision })),
        contact: input.contact, shippingAddress: input.shippingAddress,
      };
      const policy = await options.calculateShippingAndTax(policyInput);
      assertPolicyResult(policy, cart.currency);
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
        const lockedCartResult = await tx.execute(sql`select id, store_id, currency, status, version, expires_at from kablet_native_carts where id=${cart.cartId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and store_id=${input.storeId}::uuid and (token_hash=${hashToken(input.token)} or exists (select 1 from kablet_native_cart_tokens t where t.cart_id=kablet_native_carts.id and t.token_hash=${hashToken(input.token)} and t.expires_at>now())) for update`);
        const lockedCart = lockedCartResult.rows[0] as Record<string, unknown> | undefined;
        if (!lockedCart) throw new NativeCheckoutServiceError('checkout_not_found', 'The cart was not found.');
        if (String(lockedCart.status) === 'expired' || new Date(String(lockedCart.expires_at)).getTime() <= Date.now()) throw new NativeCheckoutServiceError('checkout_expired', 'The cart has expired.');
        if (Number(lockedCart.version) !== cart.version) throw new NativeCheckoutServiceError('cart_version_conflict', 'The cart changed before checkout confirmation.');
        const prior = await tx.execute(sql`select request_fingerprint, checkout_id from kablet_native_reservation_mutations where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and store_id=${input.storeId}::uuid and cart_id=${cart.cartId}::uuid and idempotency_key_hash=${keyHash}`);
        if (prior.rows[0]) {
          if (String((prior.rows[0] as Record<string, unknown>).request_fingerprint) !== fingerprint) throw new NativeCheckoutServiceError('idempotency_conflict', 'The reservation request key was already used for different checkout data.');
          const loaded = await loadCheckout(tx, String((prior.rows[0] as Record<string, unknown>).checkout_id));
          return { checkout: loaded.checkout, reservations: loaded.reservations, idempotent: true };
        }
        const products: Record<string, Record<string, unknown>> = {};
        for (const line of [...cart.lines].sort((a, b) => a.productId.localeCompare(b.productId))) {
          const productResult = await tx.execute(sql`select id, store_id, sku, title, amount_minor::text, currency, price_revision, status, availability, inventory_quantity, fulfillment_type from kablet_native_products where id=${line.productId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and store_id=${input.storeId}::uuid for update`);
          const product = productResult.rows[0] as Record<string, unknown> | undefined;
          if (!product || String(product.status) !== 'published') throw new NativeCheckoutServiceError('product_unpublished', 'A checkout product is no longer published.');
          if (String(product.fulfillment_type ?? 'physical') === 'physical' && (String(product.availability) !== 'available' || product.inventory_quantity === null)) throw new NativeCheckoutServiceError('product_unavailable', 'A checkout product is unavailable.');
          if (String(product.fulfillment_type ?? 'physical') === 'physical' && Number(product.inventory_quantity) < line.quantity) throw new NativeCheckoutServiceError('insufficient_inventory', 'The requested quantity is no longer available.');
          if (String(product.currency) !== cart.currency) throw new NativeCheckoutServiceError('currency_mismatch', 'A checkout product uses an unsupported currency.');
          const accepted = line.priceAcceptance;
          const snapshotMatches = String(product.sku) === line.originalPrice.sku && String(product.amount_minor) === line.originalPrice.amountMinor && Number(product.price_revision) === line.originalPrice.priceRevision;
          const acceptedMatches = Boolean(accepted && String(product.amount_minor) === accepted.acceptedAmountMinor && String(product.currency) === accepted.acceptedCurrency && Number(product.price_revision) === accepted.acceptedPriceRevision);
          if (!snapshotMatches && !acceptedMatches) throw new NativeCheckoutServiceError('price_changed', 'A checkout price changed before confirmation.');
          products[line.productId] = product;
        }
        const checkoutId = randomUUID();
        const fulfillmentType = Object.values(products).some(product => String(product.fulfillment_type ?? 'physical') === 'physical') ? 'physical' : 'digital';
        await tx.execute(sql`insert into kablet_native_checkout_sessions(id,organization_id,business_id,store_id,cart_id,cart_version,checkout_revision,fulfillment_type,status,currency,contact_email,contact_name,contact_phone,shipping_address,shipping_eligibility,shipping_charge_state,shipping_charge_amount_minor,shipping_charge_currency,tax_state,tax_amount_minor,tax_currency,server_total_state,server_total_amount_minor,server_total_currency,customer_confirmation_revision,expires_at,shipping_policy_id,shipping_policy_revision,tax_policy_id,tax_policy_revision,native_visitor_identity_id,native_visitor_session_id,native_interaction_session_id,native_decision_id,native_exposure_id,native_composition_id,native_composition_version) values (${checkoutId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.storeId}::uuid,${cart.cartId}::uuid,${cart.version},1,${fulfillmentType},'reservation_pending',${cart.currency},${input.contact.email},${input.contact.name},${input.contact.phone},${JSON.stringify(input.shippingAddress)}::jsonb,${policy.shippingEligibility},${policy.shippingCharge.state},${policy.shippingCharge.state === 'calculated' ? policy.shippingCharge.amountMinor : null},${policy.shippingCharge.state === 'calculated' ? policy.shippingCharge.currency : null},${policy.tax.state},${policy.tax.state === 'calculated' ? policy.tax.amountMinor : null},${policy.tax.state === 'calculated' ? policy.tax.currency : null},'calculated',${policy.serverTotal.amountMinor},${policy.serverTotal.currency},1,now()+interval '15 minutes',${policy.policyId ?? null}::uuid,${policy.policyRevision ?? null},${policy.policyId ?? null}::uuid,${policy.policyRevision ?? null},${input.attribution?.visitorIdentityId ?? null}::uuid,${input.attribution?.visitorSessionId ?? null}::uuid,${input.attribution?.interactionSessionId ?? null}::uuid,${input.attribution?.decisionId ?? null}::uuid,${input.attribution?.exposureId ?? null}::uuid,${input.attribution?.compositionId ?? null},${input.attribution?.compositionVersion ?? null})`);
        const lineIds = new Map<string, string>();
        for (const line of cart.lines) {
          const product = products[line.productId]; const lineId = randomUUID(); lineIds.set(line.productId, lineId);
          const unit = String(product.amount_minor); const total = (BigInt(unit) * BigInt(line.quantity)).toString();
          await tx.execute(sql`insert into kablet_native_checkout_lines(id,organization_id,business_id,store_id,checkout_id,product_id,fulfillment_type,sku_snapshot,quantity,unit_amount_minor,line_amount_minor,currency_snapshot,price_revision_snapshot,product_title_snapshot) values (${lineId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.storeId}::uuid,${checkoutId}::uuid,${line.productId}::uuid,${String(product.fulfillment_type ?? 'physical')},${String(product.sku)},${line.quantity},${unit},${total},${String(product.currency)},${Number(product.price_revision)},${String(product.title)})`);
        }
        for (const line of cart.lines) {
          const product = products[line.productId];
          if (String(product.fulfillment_type ?? 'physical') === 'physical') {
            const reserved = await tx.execute(sql`select coalesce(sum(quantity),0)::int as quantity from kablet_native_inventory_reservations where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and store_id=${input.storeId}::uuid and product_id=${line.productId}::uuid and ((status='active' and expires_at>now()) or status='unknown')`);
            if (Number((reserved.rows[0] as Record<string, unknown>).quantity) + line.quantity > Number(product.inventory_quantity)) throw new NativeCheckoutServiceError('insufficient_inventory', 'The requested quantity is no longer available.');
            await tx.execute(sql`insert into kablet_native_inventory_reservations(id,organization_id,business_id,store_id,checkout_id,checkout_line_id,product_id,sku_snapshot,quantity,status,expires_at) values (${randomUUID()}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.storeId}::uuid,${checkoutId}::uuid,${lineIds.get(line.productId)}::uuid,${line.productId}::uuid,${String(product.sku)},${line.quantity},'active',now()+interval '15 minutes')`);
          }
        }
        await tx.execute(sql`update kablet_native_checkout_sessions set status='reserved', updated_at=now() where id=${checkoutId}::uuid`);
        await tx.execute(sql`insert into kablet_native_reservation_mutations(id,organization_id,business_id,store_id,cart_id,checkout_id,idempotency_key_hash,request_fingerprint,checkout_revision) values (${randomUUID()}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.storeId}::uuid,${cart.cartId}::uuid,${checkoutId}::uuid,${keyHash},${fingerprint},1)`);
        const loaded = await loadCheckout(tx, checkoutId);
        return { checkout: loaded.checkout, reservations: loaded.reservations, idempotent: false };
      });
    },
    async getReservation(context: NativeCartContext, reservationId: string): Promise<NativeInventoryReservation> {
      assertUuid(reservationId);
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
        const result = await tx.execute(sql`select id, checkout_id, checkout_line_id, store_id, product_id, sku_snapshot, quantity, status, expires_at, created_at, updated_at, committed_at, released_at from kablet_native_inventory_reservations where id=${reservationId}::uuid and organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid`);
        if (!result.rows[0]) throw new NativeCheckoutServiceError('reservation_not_found', 'The reservation was not found.');
        return mapReservation(result.rows[0] as Record<string, unknown>);
      });
    },
    async releaseReservation(context: NativeCartContext, reservationId: string): Promise<NativeReservationOperationResult> {
      assertUuid(reservationId);
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
        const result = await tx.execute(sql`select id, checkout_id, checkout_line_id, store_id, product_id, sku_snapshot, quantity, status, expires_at, created_at, updated_at, committed_at, released_at from kablet_native_inventory_reservations where id=${reservationId}::uuid and organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid for update`);
        if (!result.rows[0]) throw new NativeCheckoutServiceError('reservation_not_found', 'The reservation was not found.');
        const reservation = mapReservation(result.rows[0] as Record<string, unknown>);
        if (reservation.status === 'released') return { reservation, idempotent: true };
        if (reservation.status !== 'active') throw new NativeCheckoutServiceError(reservation.status === 'unknown' ? 'reservation_quarantined' : 'invalid_transition', 'The reservation cannot be released in its current state.');
        const updated = await tx.execute(sql`update kablet_native_inventory_reservations set status='released', released_at=now(), updated_at=now() where id=${reservationId}::uuid returning id, checkout_id, checkout_line_id, store_id, product_id, sku_snapshot, quantity, status, expires_at, created_at, updated_at, committed_at, released_at`);
        return { reservation: mapReservation(updated.rows[0] as Record<string, unknown>), idempotent: false };
      });
    },
    async expireReservation(context: NativeCartContext, reservationId: string): Promise<NativeReservationOperationResult> {
      assertUuid(reservationId);
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
        const result = await tx.execute(sql`select id, checkout_id, checkout_line_id, store_id, product_id, sku_snapshot, quantity, status, expires_at, created_at, updated_at, committed_at, released_at from kablet_native_inventory_reservations where id=${reservationId}::uuid and organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid for update`);
        if (!result.rows[0]) throw new NativeCheckoutServiceError('reservation_not_found', 'The reservation was not found.');
        const reservation = mapReservation(result.rows[0] as Record<string, unknown>);
        if (reservation.status === 'unknown') throw new NativeCheckoutServiceError('reservation_quarantined', 'The reservation is quarantined pending reconciliation.');
        if (reservation.status === 'expired') return { reservation, idempotent: true };
        if (reservation.status !== 'active') throw new NativeCheckoutServiceError('invalid_transition', 'The reservation cannot expire in its current state.');
        if (reservation.expiresAt.getTime() > Date.now()) throw new NativeCheckoutServiceError('reservation_not_expired', 'The reservation has not expired.');
        const updated = await tx.execute(sql`update kablet_native_inventory_reservations set status='expired', released_at=now(), updated_at=now() where id=${reservationId}::uuid returning id, checkout_id, checkout_line_id, store_id, product_id, sku_snapshot, quantity, status, expires_at, created_at, updated_at, committed_at, released_at`);
        return { reservation: mapReservation(updated.rows[0] as Record<string, unknown>), idempotent: false };
      });
    },
    async quarantineReservation(context: NativeCartContext, reservationId: string): Promise<NativeReservationOperationResult> {
      assertUuid(reservationId);
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
        const result = await tx.execute(sql`select id, checkout_id, checkout_line_id, store_id, product_id, sku_snapshot, quantity, status, expires_at, created_at, updated_at, committed_at, released_at from kablet_native_inventory_reservations where id=${reservationId}::uuid and organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid for update`);
        if (!result.rows[0]) throw new NativeCheckoutServiceError('reservation_not_found', 'The reservation was not found.');
        const reservation = mapReservation(result.rows[0] as Record<string, unknown>);
        if (reservation.status === 'unknown') return { reservation, idempotent: true };
        if (reservation.status !== 'active') throw new NativeCheckoutServiceError('invalid_transition', 'The reservation cannot be quarantined in its current state.');
        const updated = await tx.execute(sql`update kablet_native_inventory_reservations set status='unknown', updated_at=now() where id=${reservationId}::uuid returning id, checkout_id, checkout_line_id, store_id, product_id, sku_snapshot, quantity, status, expires_at, created_at, updated_at, committed_at, released_at`);
        return { reservation: mapReservation(updated.rows[0] as Record<string, unknown>), idempotent: false };
      });
    },
  };
}
