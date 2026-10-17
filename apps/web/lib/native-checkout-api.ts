import { createDb, createNativeCheckoutPolicyRepository, createNativeCheckoutReservationService, createNativePaymentExecutionService, createNativeStripeWebhookRepository, createSecurityRepository } from '@kablet/db';
import { sql } from 'drizzle-orm';
import { nativeCheckoutContactSchema, nativeShippingAddressSchema } from '@kablet/domain';
import { loadControlServerConfig, loadServerConfig } from '@kablet/config';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { loadControlCredentialVault } from './control-credential-vault';
import { createAndBindStripeHostedSession } from './stripe-payment-execution';
import { createStripeAdapter, createStripeCredentialReader, STRIPE_API_KEY_PURPOSE } from './stripe-provider';
import { NativeCheckoutServiceError } from '@kablet/db';
import { isSameOriginMutation, openNativeCartStore, readNativeCartJson, readNativeCartToken, setNativeCartCookie, cartJson, NativeCartApiError } from './native-cart-api';

export const nativeCheckoutRequestSchema = z.object({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'idempotencyKey must be a 32-byte base64url value'),
  contact: nativeCheckoutContactSchema,
  shippingAddress: nativeShippingAddressSchema.nullable(),
}).strict();
export const nativePaymentInitiationSchema = z.object({ idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();

export async function openNativeCheckoutStore(storeSlug: string) {
  const opened = await openNativeCartStore(storeSlug);
  if (!opened) return null;
  const policies = createNativeCheckoutPolicyRepository(opened.runtime.db);
  const service = createNativeCheckoutReservationService(opened.runtime.db, {
    calculateShippingAndTax: async input => {
      const subtotal = input.lines.reduce((sum, line) => sum + BigInt(line.lineAmountMinor), 0n);
      const productIds = input.lines.map(line => line.productId);
      const products = await opened.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.context.organizationId}, true), set_config('kablet.business_id', ${input.context.businessId}, true)`);
        return tx.execute(sql`select fulfillment_type from kablet_native_products where organization_id=${input.context.organizationId}::uuid and business_id=${input.context.businessId}::uuid and store_id=${input.context.storeId}::uuid and id in (${sql.join(productIds.map(id => sql`${id}::uuid`), sql`,`)})`);
      });
      const requiresShipping = products.rows.some(row => String((row as Record<string, unknown>).fulfillment_type ?? 'physical') === 'physical');
      return policies.calculate({ ...input.context, currency: input.currency, shippingAddress: input.shippingAddress, subtotalMinor: subtotal, requiresShipping });
    },
  });
  return { ...opened, service, policies };
}

export function checkoutErrorResponse(error: unknown): NextResponse {
  if (error instanceof NativeCartApiError || error instanceof ZodError) return NextResponse.json({ code: error instanceof NativeCartApiError ? error.code : 'invalid_request', message: 'The checkout request was invalid.' }, { status: error instanceof NativeCartApiError ? error.status : 400, headers: { 'cache-control': 'private, no-store' } });
  if (error instanceof NativeCheckoutServiceError) {
    const status = error.code === 'checkout_not_found' ? 404 : ['cart_empty','policy_unavailable','shipping_unavailable','shipping_country_ineligible','price_changed','product_unavailable','product_unpublished','insufficient_inventory','currency_mismatch','cart_version_conflict','checkout_expired','idempotency_conflict'].includes(error.code) ? 409 : 400;
    return NextResponse.json({ contractVersion: 'native-checkout.v1', code: error.code, message: error.message }, { status, headers: { 'cache-control': 'private, no-store' } });
  }
  const message = error instanceof Error ? error.message : '';
  if (message === 'checkout_policy_unavailable') return NextResponse.json({ code: 'policy_unavailable', message: 'Merchant checkout policy is unavailable.' }, { status: 409, headers: { 'cache-control': 'private, no-store' } });
  if (message === 'shipping_country_ineligible') return NextResponse.json({ code: 'shipping_unavailable', message: 'Shipping is not available to this country.' }, { status: 409, headers: { 'cache-control': 'private, no-store' } });
  return NextResponse.json({ code: 'unavailable', message: 'Checkout is temporarily unavailable.' }, { status: 503, headers: { 'cache-control': 'private, no-store' } });
}

export function requireCheckoutMutation(request: Request): void {
  if (!isSameOriginMutation(request)) throw new NativeCartApiError('origin_mismatch', 403);
}

export async function initiateNativeStripePayment(input: { request: Request; storeSlug: string; checkoutId: string; token: string; idempotencyKey: string }) {
  const opened = await openNativeCheckoutStore(input.storeSlug);
  if (!opened) throw new NativeCheckoutServiceError('checkout_not_found', 'The checkout was not found.');
  let control: ReturnType<typeof createDb> | undefined;
  try {
    const checkoutResult = await opened.service.getCheckout({ ...opened.context, checkoutId: input.checkoutId, token: input.token });
    if (checkoutResult.checkout.status !== 'reserved' || new Date(checkoutResult.checkout.expiresAt).getTime() <= Date.now()) throw new NativeCheckoutServiceError('checkout_expired', 'The checkout reservation has expired.');
    const account = await createNativeStripeWebhookRepository(opened.runtime.db).resolveAccount(input.storeSlug);
    if (!account) throw new Error('merchant_payment_account_unavailable');
    const vault = loadControlCredentialVault();
    const security = createSecurityRepository(opened.runtime.db);
    const reader = createStripeCredentialReader({ readSecret: (reference, purpose, scopes) => {
      if (purpose !== STRIPE_API_KEY_PURPOSE || reference !== account.credentialReference) throw new Error('payment_credential_unavailable');
      return security.readProviderCredentialSecret({ organizationId: account.organizationId, businessId: account.businessId, providerKey: reference, requiredScopes: [...scopes] }, vault);
    } });
    const adapter = createStripeAdapter({ account, credentialReader: reader });
    const payments = createNativePaymentExecutionService(opened.runtime.db);
    const created = await payments.createPaymentAttempt({ ...opened.context, checkoutId: input.checkoutId, merchantPaymentAccountId: account.paymentAccountId, idempotencyKey: input.idempotencyKey, captureMode: 'authorize_and_capture' });
    if (created.payment.providerSessionReference) return { payment: created.payment, session: { providerSessionReference: created.payment.providerSessionReference, customerActionRequired: true, expiresAt: null, url: null }, idempotent: true };
    const origin = process.env.KABLET_PUBLIC_ORIGIN ?? new URL(input.request.url).origin;
    const returnReference = new URL(`/store/${input.storeSlug}?checkout=${encodeURIComponent(input.checkoutId)}`, origin);
    if (process.env.NODE_ENV === 'production' && returnReference.protocol !== 'https:') throw new Error('payment_return_origin_unavailable');
    control = createDb(loadControlServerConfig().DATABASE_URL);
    const controlPayments = createNativePaymentExecutionService(control.db);
    const result = await createAndBindStripeHostedSession({ payment: created.payment, captureMode: 'authorize_and_capture', returnReference: returnReference.toString(), adapter, recordSession: controlPayments.recordProviderSessionReference });
    return { payment: result.payment, session: result.session, idempotent: created.idempotent };
  } finally { await control?.pool.end().catch(() => undefined); await opened.runtime.pool.end(); }
}

export function checkoutJson(data: unknown, status = 200): NextResponse { return cartJson(data, status); }

export function publicPaymentResult(result: Awaited<ReturnType<typeof initiateNativeStripePayment>>) {
  return {
    payment: { paymentId: result.payment.paymentId, checkoutId: result.payment.checkoutId, status: result.payment.status, amountMinor: result.payment.amountMinor, currency: result.payment.currency },
    session: { customerActionRequired: result.session.customerActionRequired, expiresAt: result.session.expiresAt, url: result.session.url ?? null },
    idempotent: result.idempotent,
  };
}
