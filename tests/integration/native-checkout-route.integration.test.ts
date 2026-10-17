import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { provisionBrowserDatabase, type BrowserDatabase } from '../e2e/support/disposable-postgres';
import { nativeCartCookieName } from '../../apps/web/lib/native-cart-api';

const enabled = Boolean(process.env.TEST_MANAGER_PASSWORD && process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD && process.env.TEST_CONTROL_PASSWORD);

function key(): string { return randomBytes(32).toString('base64url'); }
function requestHeaders(cookie?: string): HeadersInit { return { origin: 'https://example.test', host: 'example.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }; }
function params(storeSlug: string) { return { params: Promise.resolve({ storeSlug }) }; }

describe.skipIf(!enabled)('native checkout route policy and fulfillment boundary', () => {
  let fixture: BrowserDatabase;
  let setup: pg.Pool;
  let createCart: typeof import('../../apps/web/app/api/store/[storeSlug]/cart/route').POST;
  let addLine: typeof import('../../apps/web/app/api/store/[storeSlug]/cart/lines/route').POST;
  let prepareCheckout: typeof import('../../apps/web/app/api/store/[storeSlug]/checkout/route').POST;
  let initiatePayment: typeof import('../../apps/web/app/api/store/[storeSlug]/checkout/[checkoutId]/payment/route').POST;
  const storeSlug = 'browser-native-store';

  beforeAll(async () => {
    fixture = await provisionBrowserDatabase();
    const bootstrap = new URL(fixture.runtimeUrl);
    bootstrap.username = process.env.TEST_BOOTSTRAP_USER!;
    bootstrap.password = process.env.TEST_BOOTSTRAP_PASSWORD!;
    setup = new pg.Pool({ connectionString: bootstrap.toString(), max: 1 });
    process.env.NODE_ENV = 'test';
    process.env.TEST_DATABASE_URL = fixture.runtimeUrl;
    process.env.CONTROL_DATABASE_URL = fixture.controlUrl;
    process.env.KABLET_CREDENTIAL_KEY = fixture.credentialKey;
    process.env.KABLET_CREDENTIAL_KEY_VERSION = fixture.credentialKeyVersion;
    process.env.KABLET_PUBLIC_ORIGIN = 'https://example.test';
    ({ POST: createCart } = await import('../../apps/web/app/api/store/[storeSlug]/cart/route'));
    ({ POST: addLine } = await import('../../apps/web/app/api/store/[storeSlug]/cart/lines/route'));
    ({ POST: prepareCheckout } = await import('../../apps/web/app/api/store/[storeSlug]/checkout/route'));
    ({ POST: initiatePayment } = await import('../../apps/web/app/api/store/[storeSlug]/checkout/[checkoutId]/payment/route'));
  });

  beforeEach(async () => {
    await tenantQuery(`update kablet_native_checkout_policies set status='active', currency='USD', eligible_countries=array['US'], shipping_amount_minor=500, tax_rate_bps=875 where id=$1`, [fixture.nativeCheckoutPolicyId]);
    await tenantQuery(`update kablet_native_products set fulfillment_type='physical', inventory_quantity=12, availability='available', status='published' where id=$1`, [fixture.nativeVisibleProductId]);
    await tenantQuery(`update kablet_native_products set fulfillment_type='digital', inventory_quantity=8, availability='available', status='published' where id=$1`, [fixture.nativeSecondProductId]);
  });

  afterAll(async () => { await setup?.end(); await fixture?.cleanup(); });

  async function tenantQuery(text: string, values: unknown[] = []): Promise<void> {
    const client = await setup.connect();
    try {
      await client.query('begin');
      await client.query(`select set_config('kablet.organization_id', $1, true), set_config('kablet.business_id', $2, true)`, [fixture.organizationId, fixture.businessId]);
      await client.query(text, values);
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
  }

  async function cartWith(productIds: string[]): Promise<string> {
    const created = await createCart(new Request(`https://example.test/api/store/${storeSlug}/cart`, { method: 'POST', headers: requestHeaders(), body: JSON.stringify({ idempotencyKey: key() }) }), params(storeSlug));
    expect(created.status).toBe(201);
    const setCookie = created.headers.get('set-cookie');
    if (!setCookie) throw new Error('checkout route fixture did not issue a cart cookie');
    const cookie = setCookie.split(';', 1)[0];
    for (const productId of productIds) {
      const added = await addLine(new Request(`https://example.test/api/store/${storeSlug}/cart/lines`, { method: 'POST', headers: requestHeaders(cookie), body: JSON.stringify({ productId, quantity: 1, idempotencyKey: key() }) }), params(storeSlug));
      expect(added.status).toBe(200);
    }
    return cookie;
  }

  async function prepare(cookie: string, countryCode = 'US', shippingAddress: Record<string, string> | null = { recipientName: 'A Visitor', line1: '1 Test Street', line2: '', city: 'Test City', region: 'TS', postalCode: '00001', countryCode }) {
    return prepareCheckout(new Request(`https://example.test/api/store/${storeSlug}/checkout`, { method: 'POST', headers: requestHeaders(cookie), body: JSON.stringify({ idempotencyKey: key(), contact: { email: 'visitor@example.test', name: 'A Visitor', phone: null }, shippingAddress }) }), params(storeSlug));
  }

  async function initiate(cookie: string, checkoutId: string, idempotencyKey: string) {
    return initiatePayment(new Request(`https://example.test/api/store/${storeSlug}/checkout/${checkoutId}/payment`, { method: 'POST', headers: requestHeaders(cookie), body: JSON.stringify({ idempotencyKey }) }), { params: Promise.resolve({ storeSlug, checkoutId }) });
  }

  it('supports digital-only checkout without shipping reservation', async () => {
    const cookie = await cartWith([fixture.nativeSecondProductId]);
    const response = await prepare(cookie, 'US', null);
    expect(response.status).toBe(201);
    const body = await response.json() as { checkout: { fulfillmentType: string }; reservations: unknown[] };
    expect(body.checkout.fulfillmentType).toBe('digital');
    expect(body.reservations).toHaveLength(0);
  });

  it('supports mixed physical and digital checkout with only physical reservation', async () => {
    const cookie = await cartWith([fixture.nativeVisibleProductId, fixture.nativeSecondProductId]);
    const response = await prepare(cookie);
    expect(response.status).toBe(201);
    const body = await response.json() as { checkout: { fulfillmentType: string; lines: unknown[] }; reservations: unknown[] };
    expect(body.checkout.fulfillmentType).toBe('physical');
    expect(body.checkout.lines).toHaveLength(2);
    expect(body.reservations).toHaveLength(1);
  });

  it('fails closed when the shipping policy is missing or inactive', async () => {
    await tenantQuery('update kablet_native_checkout_sessions set shipping_policy_id=null, tax_policy_id=null', []);
    await tenantQuery('delete from kablet_native_checkout_policies where id=$1', [fixture.nativeCheckoutPolicyId]);
    const missing = await prepare(await cartWith([fixture.nativeVisibleProductId]));
    expect(missing.status).toBe(409);
    expect(await missing.json()).toMatchObject({ code: 'policy_unavailable' });
    await tenantQuery(`insert into kablet_native_checkout_policies(id,organization_id,business_id,store_id,revision,status,currency,eligible_countries,shipping_amount_minor,tax_rate_bps) values ($1,$2,$3,$4,1,'inactive','USD',array['US'],500,875)`, [fixture.nativeCheckoutPolicyId, fixture.organizationId, fixture.businessId, fixture.nativeStoreId]);
    const inactive = await prepare(await cartWith([fixture.nativeVisibleProductId]));
    expect(inactive.status).toBe(409);
    expect(await inactive.json()).toMatchObject({ code: 'policy_unavailable' });
  });

  it('rejects unsupported shipping countries and tax currency configuration', async () => {
    await tenantQuery(`update kablet_native_checkout_policies set eligible_countries=array['CA'] where id=$1`, [fixture.nativeCheckoutPolicyId]);
    const country = await prepare(await cartWith([fixture.nativeVisibleProductId]), 'US');
    expect(country.status).toBe(409);
    expect(await country.json()).toMatchObject({ code: 'shipping_unavailable' });
    await tenantQuery(`update kablet_native_checkout_policies set eligible_countries=array['US'], currency='EUR' where id=$1`, [fixture.nativeCheckoutPolicyId]);
    const currency = await prepare(await cartWith([fixture.nativeVisibleProductId]));
    expect(currency.status).toBe(409);
    expect(await currency.json()).toMatchObject({ code: 'policy_unavailable' });
  });

  it('keeps payment initiation retryable after provider timeout and session persistence failure', async () => {
    const cookie = await cartWith([fixture.nativeVisibleProductId]);
    const checkoutResponse = await prepare(cookie);
    const checkout = await checkoutResponse.json() as { checkout: { checkoutId: string } };
    const paymentKey = key();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        if (String(input).endsWith('/v1/account')) return new Response(JSON.stringify({ id: 'acct_browser_fixture', charges_enabled: true, payouts_enabled: true }), { status: 200 });
        throw new Error('simulated Stripe timeout');
      }) as typeof fetch;
      const timeout = await initiate(cookie, checkout.checkout.checkoutId, paymentKey);
      expect(timeout.status).toBe(503);
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        if (String(input).endsWith('/v1/account')) return new Response(JSON.stringify({ id: 'acct_browser_fixture', charges_enabled: true, payouts_enabled: true }), { status: 200 });
        return new Response(JSON.stringify({ id: 'cs_retryable_fixture', url: 'https://checkout.stripe.com/c/pay/cs_retryable_fixture', expires_at: Math.floor(Date.now() / 1000) + 1800 }), { status: 200 });
      }) as typeof fetch;
      const retried = await initiate(cookie, checkout.checkout.checkoutId, paymentKey);
      expect(retried.status).toBe(200);
      expect(await retried.json()).toMatchObject({ payment: { status: 'session_created' }, session: { customerActionRequired: true }, idempotent: true });
    } finally { globalThis.fetch = originalFetch; }

    const persistenceKey = key();
    const controlUrl = process.env.CONTROL_DATABASE_URL;
    try {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        if (String(input).endsWith('/v1/account')) return new Response(JSON.stringify({ id: 'acct_browser_fixture', charges_enabled: true, payouts_enabled: true }), { status: 200 });
        return new Response(JSON.stringify({ id: 'cs_persistence_fixture', url: 'https://checkout.stripe.com/c/pay/cs_persistence_fixture', expires_at: Math.floor(Date.now() / 1000) + 1800 }), { status: 200 });
      }) as typeof fetch;
      process.env.CONTROL_DATABASE_URL = 'postgresql://kablet_control:invalid@127.0.0.1:1/unavailable';
      const persistenceFailure = await initiate(cookie, checkout.checkout.checkoutId, persistenceKey);
      expect(persistenceFailure.status).toBe(503);
      process.env.CONTROL_DATABASE_URL = controlUrl;
      const persistenceRetry = await initiate(cookie, checkout.checkout.checkoutId, persistenceKey);
      expect([200, 201]).toContain(persistenceRetry.status);
    } finally { process.env.CONTROL_DATABASE_URL = controlUrl; globalThis.fetch = originalFetch; }
  });
});
