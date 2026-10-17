import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { loadTestManagerConfig } from '@kablet/config';
import { createCredentialVault, createDb, createNativeStripeIngestionRepository, createNativeVerifiedOrderService, createNativeVerifiedOrderWorker } from '@kablet/db';
import { nativeCartCookieName } from '../../apps/web/lib/native-cart-api';

const enabled = Boolean(process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD && process.env.TEST_CONTROL_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');

async function provision() {
  const manager = loadTestManagerConfig();
  const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
  const database = `kablet_order_${randomBytes(12).toString('hex')}`;
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  await managerPool.query(`create database "${database}" owner "${manager.TEST_MANAGER_USER}"`);
  await managerPool.query(`grant connect, create on database "${database}" to "${process.env.TEST_BOOTSTRAP_USER}"`);
  await managerPool.query(`grant connect on database "${database}" to kablet_control`);
  const target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
  await target.query(`grant usage, create on schema public to "${process.env.TEST_BOOTSTRAP_USER}"`);
  await target.query('grant usage, create on schema public to kablet_privacy_owner');
  await target.end();
  const bootstrap = createDb(`postgresql://${encodeURIComponent(process.env.TEST_BOOTSTRAP_USER!)}:${encodeURIComponent(process.env.TEST_BOOTSTRAP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
  const admin = new pg.Pool({ connectionString: process.env.TEST_ROLE_ADMIN_URL, max: 1 });
  await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
  try { await migrate(bootstrap.db, { migrationsFolder }); } finally { await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await admin.end(); }
  const runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
  const control = createDb(`postgresql://kablet_control:${encodeURIComponent(process.env.TEST_CONTROL_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
  return { manager, managerPool, database, bootstrap, runtime, control };
}

async function dispose(resource: Awaited<ReturnType<typeof provision>>) {
  await Promise.all([resource.bootstrap.pool.end(), resource.runtime.pool.end(), resource.control.pool.end()]);
  await resource.managerPool.query(`drop database if exists "${resource.database}"`);
  await resource.managerPool.end();
}

type Fixture = Awaited<ReturnType<typeof provision>> & { organizationId: string; businessId: string; storeId: string; accountId: string; productId: string; cartId: string; cartToken: string };

async function fixture(resource: Awaited<ReturnType<typeof provision>>): Promise<Fixture> {
  const organizationId = randomUUID(); const businessId = randomUUID(); const storeId = randomUUID(); const accountId = randomUUID(); const productId = randomUUID(); const cartId = randomUUID(); const cartToken = randomBytes(32).toString('base64url'); const policyId = randomUUID();
  await resource.bootstrap.db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${businessId}, true)`);
    await tx.execute(sql`insert into organizations(id,name) values (${organizationId}::uuid,'Order Test Org')`);
    await tx.execute(sql`insert into businesses(id,organization_id,name) values (${businessId}::uuid,${organizationId}::uuid,'Order Test Business')`);
    await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${storeId}::uuid,${organizationId}::uuid,${businessId}::uuid,'order-test-store','Order Test Store','USD','published')`);
    await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${productId}::uuid,${storeId}::uuid,${organizationId}::uuid,${businessId}::uuid,'order-test-product','ORD-001','Order Product','Fixture',2400,'USD',1,1,'published','available')`);
    await tx.execute(sql`insert into kablet_native_carts(id,organization_id,business_id,store_id,token_hash,currency,expires_at) values (${cartId}::uuid,${organizationId}::uuid,${businessId}::uuid,${storeId}::uuid,${createHash('sha256').update(cartToken).digest()},'USD',now()+interval '30 days')`);
    await tx.execute(sql`insert into kablet_native_cart_lines(id,organization_id,business_id,store_id,cart_id,product_id,quantity,sku_snapshot,amount_minor_snapshot,currency_snapshot,price_revision_snapshot) values (${randomUUID()}::uuid,${organizationId}::uuid,${businessId}::uuid,${storeId}::uuid,${cartId}::uuid,${productId}::uuid,1,'ORD-001',2400,'USD',1)`);
    await tx.execute(sql`insert into kablet_native_checkout_policies(id,organization_id,business_id,store_id,revision,status,currency,eligible_countries,shipping_amount_minor,tax_rate_bps) values (${policyId}::uuid,${organizationId}::uuid,${businessId}::uuid,${storeId}::uuid,1,'active','USD',array['US'],0,0)`);
    await tx.execute(sql`insert into kablet_native_payment_accounts(id,organization_id,business_id,store_id,provider_key,adapter_version,merchant_account_reference,credential_mode,credential_reference,webhook_signing_secret_reference,supported_countries,supported_currencies,status,can_authorize,can_capture,can_refund,can_receive_webhooks) values (${accountId}::uuid,${organizationId}::uuid,${businessId}::uuid,${storeId}::uuid,'stripe','v1','acct_order_fixture','test','stripe:test:api','stripe:test:webhook',array['US'],array['USD'],'active',true,true,false,true)`);
  });
  return { ...resource, organizationId, businessId, storeId, accountId, productId, cartId, cartToken };
}

async function createPayment(f: Fixture, options: { status?: string; reservationStatus?: string; expired?: boolean; evidenceStatus?: string; amount?: number; currency?: string; fulfillmentType?: 'physical' | 'digital'; skipEvidence?: boolean } = {}) {
  const checkoutId = randomUUID(); const lineId = randomUUID(); const reservationId = randomUUID(); const paymentId = randomUUID(); const evidenceId = randomUUID();
  const providerReference = `pi_${randomBytes(8).toString('hex')}`;
  const paymentStatus = options.status ?? 'authorized'; const reservationStatus = options.reservationStatus ?? 'active'; const evidenceStatus = options.evidenceStatus ?? 'captured';
  await f.bootstrap.db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
    await tx.execute(sql`insert into kablet_native_checkout_sessions(id,organization_id,business_id,store_id,cart_id,cart_version,checkout_revision,fulfillment_type,status,currency,shipping_eligibility,shipping_charge_state,tax_state,server_total_state,server_total_amount_minor,server_total_currency,expires_at) values (${checkoutId}::uuid,${f.organizationId}::uuid,${f.businessId}::uuid,${f.storeId}::uuid,${f.cartId}::uuid,0,1,${options.fulfillmentType ?? 'physical'},'reserved',${options.currency ?? 'USD'},'pending','not_calculated','not_calculated','calculated',${options.amount ?? 2400},${options.currency ?? 'USD'},now()+interval '15 minutes')`);
    await tx.execute(sql`insert into kablet_native_checkout_lines(id,organization_id,business_id,store_id,checkout_id,product_id,fulfillment_type,sku_snapshot,quantity,unit_amount_minor,line_amount_minor,currency_snapshot,price_revision_snapshot,product_title_snapshot) values (${lineId}::uuid,${f.organizationId}::uuid,${f.businessId}::uuid,${f.storeId}::uuid,${checkoutId}::uuid,${f.productId}::uuid,${options.fulfillmentType ?? 'physical'},'ORD-001',1,2400,2400,${options.currency ?? 'USD'},1,'Order Product')`);
    if ((options.fulfillmentType ?? 'physical') === 'physical') await tx.execute(sql`insert into kablet_native_inventory_reservations(id,organization_id,business_id,store_id,checkout_id,checkout_line_id,product_id,sku_snapshot,quantity,status,expires_at) values (${reservationId}::uuid,${f.organizationId}::uuid,${f.businessId}::uuid,${f.storeId}::uuid,${checkoutId}::uuid,${lineId}::uuid,${f.productId}::uuid,'ORD-001',1,${reservationStatus},${options.expired ? sql`now()-interval '1 minute'` : sql`now()+interval '15 minutes'`})`);
    await tx.execute(sql`insert into kablet_native_payment_attempts(id,organization_id,business_id,store_id,checkout_id,checkout_revision,merchant_payment_account_id,amount_minor,currency,operation_id,idempotency_key_hash,provider_payment_reference,status) values (${paymentId}::uuid,${f.organizationId}::uuid,${f.businessId}::uuid,${f.storeId}::uuid,${checkoutId}::uuid,1,${f.accountId}::uuid,${options.amount ?? 2400},${options.currency ?? 'USD'},${randomUUID()},${createHash('sha256').update(paymentId).digest()},${providerReference},${paymentStatus})`);
  });
  if (!options.skipEvidence) await createNativeStripeIngestionRepository(f.control.db).ingestVerifiedEvidence({ evidenceId, organizationId: f.organizationId, businessId: f.businessId, storeId: f.storeId, merchantPaymentAccountId: f.accountId, providerEventId: `evt_${evidenceId.replaceAll('-', '')}`, eventType: 'payment_intent.updated', providerObjectReference: providerReference, payloadDigest: createHash('sha256').update(evidenceId).digest(), paymentId, providerPaymentReference: providerReference, amountMinor: options.amount ?? 2400, currency: options.currency ?? 'USD', paymentStatus: evidenceStatus as 'captured', observedAt: new Date() });
  return { checkoutId, paymentId, evidenceId, reservationId, providerReference };
}

describe.skipIf(!enabled)('native verified order commitment', () => {
  it('connects customer checkout preparation and trusted Stripe payment initiation to durable persistence', async () => {
    const resource = await provision();
    const previous = { nodeEnv: process.env.NODE_ENV, publicOrigin: process.env.KABLET_PUBLIC_ORIGIN, testDatabaseUrl: process.env.TEST_DATABASE_URL, controlDatabaseUrl: process.env.CONTROL_DATABASE_URL, vaultKey: process.env.KABLET_CREDENTIAL_KEY, vaultVersion: process.env.KABLET_CREDENTIAL_KEY_VERSION, fetch: globalThis.fetch };
    try {
      const f = await fixture(resource);
      const userId = randomUUID();
      const vaultKey = randomBytes(32);
      const vault = createCredentialVault(vaultKey, 'checkout-route-test');
      const encrypted = vault.encrypt('rk_test_checkout_fixture');
        await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        await tx.execute(sql`insert into kablet_users(id,auth_provider,provider_subject) values (${userId}::uuid,'test','native-customer-checkout')`);
        await tx.execute(sql`insert into kablet_provider_credentials(id,organization_id,business_id,provider_key,encrypted_secret,key_version,scopes,created_by) values (${randomUUID()}::uuid,${f.organizationId}::uuid,${f.businessId}::uuid,'stripe:test:api',${encrypted.ciphertext},${encrypted.keyVersion},${JSON.stringify(['checkout_sessions.create','checkout_sessions.read','payment_intents.read','account.read','webhooks.verify'])}::jsonb,${userId}::uuid)`);
        const webhookEncrypted = vault.encrypt('whsec_checkoutfixture');
        await tx.execute(sql`insert into kablet_provider_credentials(id,organization_id,business_id,provider_key,encrypted_secret,key_version,scopes,created_by) values (${randomUUID()}::uuid,${f.organizationId}::uuid,${f.businessId}::uuid,'stripe:test:webhook',${webhookEncrypted.ciphertext},${webhookEncrypted.keyVersion},${JSON.stringify(['webhooks.verify'])}::jsonb,${userId}::uuid)`);
      });
      process.env.NODE_ENV = 'test';
      process.env.KABLET_PUBLIC_ORIGIN = 'https://example.test';
      process.env.TEST_DATABASE_URL = `postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${resource.manager.TEST_MANAGER_HOST}:${resource.manager.TEST_MANAGER_PORT}/${resource.database}`;
      process.env.CONTROL_DATABASE_URL = `postgresql://kablet_control:${encodeURIComponent(process.env.TEST_CONTROL_PASSWORD!)}@${resource.manager.TEST_MANAGER_HOST}:${resource.manager.TEST_MANAGER_PORT}/${resource.database}`;
      process.env.KABLET_CREDENTIAL_KEY = vaultKey.toString('base64');
      process.env.KABLET_CREDENTIAL_KEY_VERSION = 'checkout-route-test';
      let initiatedPaymentId: string | null = null;
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/v1/account')) return new Response(JSON.stringify({ id: 'acct_order_fixture', charges_enabled: true, payouts_enabled: true }), { status: 200 });
        if (url.endsWith('/v1/checkout/sessions/cs_checkout_fixture')) return new Response(JSON.stringify({ id: 'cs_checkout_fixture', client_reference_id: initiatedPaymentId, amount_total: 2400, currency: 'usd', payment_intent: 'pi_checkout_fixture', metadata: { kablet_payment_id: initiatedPaymentId, kablet_checkout_id: preparedCheckoutId, kablet_organization_id: f.organizationId, kablet_business_id: f.businessId, kablet_store_id: f.storeId, kablet_merchant_payment_account_id: f.accountId, kablet_merchant_account_reference: 'acct_order_fixture' } }), { status: 200 });
        if (url.includes('/v1/checkout/sessions')) return new Response(JSON.stringify({ id: 'cs_checkout_fixture', url: 'https://checkout.stripe.com/c/pay/cs_checkout_fixture', expires_at: Math.floor(Date.now() / 1000) + 1800 }), { status: 200 });
        return new Response(JSON.stringify({}), { status: 404 });
      }) as typeof fetch;
      const { POST: prepare } = await import('../../apps/web/app/api/store/[storeSlug]/checkout/route');
      const cookie = `${nativeCartCookieName('order-test-store')}=${f.cartToken}`;
      const prepareResponse = await prepare(new Request('https://example.test/api/store/order-test-store/checkout', { method: 'POST', headers: { origin: 'https://example.test', host: 'example.test', cookie, 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: randomBytes(32).toString('base64url'), contact: { email: 'visitor@example.test', name: 'A Visitor', phone: null }, shippingAddress: { recipientName: 'A Visitor', line1: '1 Test Street', line2: null, city: 'Test City', region: 'TS', postalCode: '00001', countryCode: 'US' } }) }), { params: Promise.resolve({ storeSlug: 'order-test-store' }) });
      const prepared = await prepareResponse.json() as { checkout?: { checkoutId: string; serverTotal: { amountMinor: string }; status: string }; message?: string };
      const preparedCheckoutId = prepared.checkout!.checkoutId;
      expect(prepareResponse.status, JSON.stringify(prepared)).toBe(201);
      expect(prepared.checkout).toMatchObject({ status: 'reserved', serverTotal: { amountMinor: '2400' } });
      const { POST: initiate } = await import('../../apps/web/app/api/store/[storeSlug]/checkout/[checkoutId]/payment/route');
      const paymentIdempotencyKey = randomBytes(32).toString('base64url');
      const initiatePayment = () => initiate(new Request(`https://example.test/api/store/order-test-store/checkout/${prepared.checkout!.checkoutId}/payment`, { method: 'POST', headers: { origin: 'https://example.test', host: 'example.test', cookie, 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: paymentIdempotencyKey }) }), { params: Promise.resolve({ storeSlug: 'order-test-store', checkoutId: prepared.checkout!.checkoutId }) });
      const paymentResponses = await Promise.all([initiatePayment(), initiatePayment()]);
      const paymentBodies = await Promise.all(paymentResponses.map(response => response.json() as Promise<Record<string, unknown>>));
      expect(paymentResponses.map(response => response.status).sort(), JSON.stringify(paymentBodies)).toEqual([200, 201]);
      const payment = paymentBodies.find(body => (body as { payment?: { status?: string } }).payment?.status === 'session_created')!;
      initiatedPaymentId = String((payment.payment as { paymentId: string }).paymentId);
      expect(payment).toMatchObject({ payment: { status: 'session_created', amountMinor: 2400, currency: 'USD' }, session: { customerActionRequired: true } });
      expect(JSON.stringify(paymentBodies)).not.toContain('rk_test_checkout_fixture');
      const stored = await resource.bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`); return tx.execute(sql`select provider_session_reference, amount_minor, currency, count(*) over()::int as attempt_count from kablet_native_payment_attempts where checkout_id=${prepared.checkout!.checkoutId}::uuid`); });
      expect(stored.rows[0]).toMatchObject({ provider_session_reference: 'cs_checkout_fixture', amount_minor: '2400', currency: 'USD', attempt_count: 1 });
      const { POST: webhook } = await import('../../apps/web/app/api/webhooks/stripe/[storeSlug]/route');
      const timestamp = Math.floor(Date.now() / 1000);
      const webhookEvent = { id: 'evt_checkout_journey', type: 'payment_intent.succeeded', created: timestamp, data: { object: { id: 'pi_checkout_fixture', amount_received: 2400, currency: 'usd', metadata: { kablet_payment_id: initiatedPaymentId, kablet_checkout_id: preparedCheckoutId, kablet_organization_id: f.organizationId, kablet_business_id: f.businessId, kablet_store_id: f.storeId, kablet_merchant_payment_account_id: f.accountId, kablet_merchant_account_reference: 'acct_order_fixture' } } } };
      const webhookBody = JSON.stringify(webhookEvent);
      const webhookSignature = createHmac('sha256', 'whsec_checkoutfixture').update(`${timestamp}.${webhookBody}`).digest('hex');
      const webhookResponse = await webhook(new Request('https://example.test/api/webhooks/stripe/order-test-store', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${timestamp},v1=${webhookSignature}` }, body: webhookBody }), { params: Promise.resolve({ storeSlug: 'order-test-store' }) });
      expect(webhookResponse.status, await webhookResponse.clone().text()).toBe(202);
      const duplicateWebhookResponse = await webhook(new Request('https://example.test/api/webhooks/stripe/order-test-store', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${timestamp},v1=${webhookSignature}` }, body: webhookBody }), { params: Promise.resolve({ storeSlug: 'order-test-store' }) });
      expect(duplicateWebhookResponse.status).toBe(202);
      expect(await duplicateWebhookResponse.json()).toMatchObject({ accepted: true, duplicate: true });
      const worker = createNativeVerifiedOrderWorker(resource.control.db);
      const workerResult = await worker.processOnce('checkout-journey-worker');
      expect(workerResult).toMatchObject({ claimed: true, result: { recoveryRequired: false } });
      const { GET: getCheckout } = await import('../../apps/web/app/api/store/[storeSlug]/checkout/[checkoutId]/route');
      const confirmationResponse = await getCheckout(new Request(`https://example.test/api/store/order-test-store/checkout/${prepared.checkout!.checkoutId}`, { headers: { cookie } }), { params: Promise.resolve({ storeSlug: 'order-test-store', checkoutId: prepared.checkout!.checkoutId }) });
      expect(confirmationResponse.status).toBe(200);
      expect(await confirmationResponse.json()).toMatchObject({ order: { paymentId: initiatedPaymentId } });
      const committed = await resource.bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`); return tx.execute(sql`select p.inventory_quantity, count(o.id)::int as order_count from kablet_native_products p left join kablet_native_orders o on o.payment_id=${initiatedPaymentId}::uuid where p.id=${f.productId}::uuid group by p.inventory_quantity`); });
      expect(committed.rows[0]).toMatchObject({ inventory_quantity: 0, order_count: 1 });
    } finally {
      globalThis.fetch = previous.fetch;
      if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
      if (previous.publicOrigin === undefined) delete process.env.KABLET_PUBLIC_ORIGIN; else process.env.KABLET_PUBLIC_ORIGIN = previous.publicOrigin;
      if (previous.testDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL; else process.env.TEST_DATABASE_URL = previous.testDatabaseUrl;
      if (previous.controlDatabaseUrl === undefined) delete process.env.CONTROL_DATABASE_URL; else process.env.CONTROL_DATABASE_URL = previous.controlDatabaseUrl;
      if (previous.vaultKey === undefined) delete process.env.KABLET_CREDENTIAL_KEY; else process.env.KABLET_CREDENTIAL_KEY = previous.vaultKey;
      if (previous.vaultVersion === undefined) delete process.env.KABLET_CREDENTIAL_KEY_VERSION; else process.env.KABLET_CREDENTIAL_KEY_VERSION = previous.vaultVersion;
      await dispose(resource);
    }
  }, 30000);

  it('creates exactly one order and decrements inventory once, including concurrent duplicate calls', async () => {
    const resource = await provision();
    try {
      const f = await fixture(resource); const payment = await createPayment(f);
      const service = createNativeVerifiedOrderService(f.control.db);
      const key = 'order-commitment-key-000000000000000000000000';
      const [first, second] = await Promise.all([service.commitCapturedPayment({ organizationId: f.organizationId, businessId: f.businessId, storeId: f.storeId, paymentId: payment.paymentId, evidenceId: payment.evidenceId, commitmentKey: key }), service.commitCapturedPayment({ organizationId: f.organizationId, businessId: f.businessId, storeId: f.storeId, paymentId: payment.paymentId, evidenceId: payment.evidenceId, commitmentKey: key })]);
      expect(first.order?.orderId).toBe(second.order?.orderId); expect([first.idempotent, second.idempotent].sort()).toEqual([false, true]);
      const duplicateEvidence = await createNativeStripeIngestionRepository(f.control.db).ingestVerifiedEvidence({ evidenceId: payment.evidenceId, organizationId: f.organizationId, businessId: f.businessId, storeId: f.storeId, merchantPaymentAccountId: f.accountId, providerEventId: `evt_${payment.evidenceId.replaceAll('-', '')}`, eventType: 'payment_intent.updated', providerObjectReference: payment.providerReference, payloadDigest: createHash('sha256').update(payment.evidenceId).digest(), paymentId: payment.paymentId, providerPaymentReference: payment.providerReference, amountMinor: 2400, currency: 'USD', paymentStatus: 'captured', observedAt: new Date() });
      expect(duplicateEvidence.inserted).toBe(false);
      const state = await f.bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`); return tx.execute(sql`select p.inventory_quantity, r.status, c.status checkout_status, pa.status payment_status, (select count(*) from kablet_native_orders where payment_id=${payment.paymentId}::uuid) order_count from kablet_native_products p join kablet_native_inventory_reservations r on r.product_id=p.id join kablet_native_checkout_sessions c on c.id=r.checkout_id join kablet_native_payment_attempts pa on pa.id=${payment.paymentId}::uuid where p.id=${f.productId}::uuid`); });
      expect(state.rows[0]).toMatchObject({ inventory_quantity: 0, status: 'committed', checkout_status: 'completed', payment_status: 'captured', order_count: '1' });
    } finally { await dispose(resource); }
  }, 90000);

  it('rejects non-captured evidence, expired reservations, and ordinary runtime commitment', async () => {
    const resource = await provision();
    try {
      const f = await fixture(resource); const authorized = await createPayment(f, { evidenceStatus: 'authorized' });
      const commit = createNativeVerifiedOrderService(f.control.db); const input = { organizationId: f.organizationId, businessId: f.businessId, storeId: f.storeId, paymentId: authorized.paymentId, evidenceId: authorized.evidenceId, commitmentKey: 'authorized-order-key-000000000000000000000' };
      await expect(commit.commitCapturedPayment(input)).rejects.toThrow();
      const authorizedWork = await resource.bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`); return tx.execute(sql`select order_status from kablet_native_payment_webhook_inbox where id=${authorized.evidenceId}::uuid`); });
      expect(authorizedWork.rows[0]).toMatchObject({ order_status: 'not_required' });
      const expired = await createPayment(f, { expired: true });
      const recovery = await commit.commitCapturedPayment({ ...input, paymentId: expired.paymentId, evidenceId: expired.evidenceId, commitmentKey: 'expired-order-key-000000000000000000000000' });
      expect(recovery).toMatchObject({ order: null, recoveryRequired: true, recoveryReason: 'reservation_expired' });
      await expect(createNativeVerifiedOrderService(f.runtime.db).commitCapturedPayment({ ...input, paymentId: expired.paymentId, evidenceId: expired.evidenceId, commitmentKey: 'runtime-order-key-000000000000000000000000' })).rejects.toThrow();
      const quarantined = await createPayment(f, { reservationStatus: 'unknown', expired: true });
      await expect(commit.commitCapturedPayment({ ...input, paymentId: quarantined.paymentId, evidenceId: quarantined.evidenceId, commitmentKey: 'quarantined-order-key-000000000000000000000' })).resolves.toMatchObject({ recoveryRequired: true, recoveryReason: 'quarantined_reservation' });
      const failed = await createPayment(f, { status: 'failed' });
      await expect(commit.commitCapturedPayment({ ...input, paymentId: failed.paymentId, evidenceId: failed.evidenceId, commitmentKey: 'failed-order-key-0000000000000000000000000' })).resolves.toMatchObject({ recoveryRequired: true, recoveryReason: 'payment_state_uncertain' });
      const unknown = await createPayment(f, { status: 'unknown' });
      await expect(commit.commitCapturedPayment({ ...input, paymentId: unknown.paymentId, evidenceId: unknown.evidenceId, commitmentKey: 'unknown-order-key-000000000000000000000000' })).resolves.toMatchObject({ recoveryRequired: true, recoveryReason: 'payment_state_uncertain' });
      const cancelled = await createPayment(f, { status: 'cancelled' });
      await expect(commit.commitCapturedPayment({ ...input, paymentId: cancelled.paymentId, evidenceId: cancelled.evidenceId, commitmentKey: 'cancelled-order-key-0000000000000000000000' })).resolves.toMatchObject({ recoveryRequired: true, recoveryReason: 'payment_state_uncertain' });
      const wrongCurrency = await createPayment(f, { currency: 'EUR' });
      await expect(commit.commitCapturedPayment({ ...input, paymentId: wrongCurrency.paymentId, evidenceId: wrongCurrency.evidenceId, commitmentKey: 'currency-order-key-00000000000000000000000' })).resolves.toMatchObject({ recoveryRequired: true, recoveryReason: 'invalid_checkout' });
      const digital = await createPayment(f, { fulfillmentType: 'digital' });
      const digitalResult = await commit.commitCapturedPayment({ ...input, paymentId: digital.paymentId, evidenceId: digital.evidenceId, commitmentKey: 'digital-order-key-000000000000000000000000' });
      expect(digitalResult.order?.fulfillmentType).toBe('digital');
      await expect(commit.commitCapturedPayment({ ...input, storeId: randomUUID(), paymentId: digital.paymentId, evidenceId: digital.evidenceId, commitmentKey: 'wrong-store-order-key-000000000000000000' })).rejects.toThrow();
      await expect(commit.commitCapturedPayment({ ...input, paymentId: digital.paymentId, evidenceId: randomUUID(), commitmentKey: 'missing-evidence-order-key-000000000000000' })).rejects.toThrow();
      const inventory = await f.bootstrap.db.execute(sql`select inventory_quantity from kablet_native_products where id=${f.productId}::uuid`); expect(inventory.rows[0].inventory_quantity).toBe(1);
    } finally { await dispose(resource); }
  }, 90000);

  it('does not oversell the final unit across concurrent independent payments', async () => {
    const resource = await provision();
    try {
      const f = await fixture(resource); const first = await createPayment(f); const second = await createPayment(f);
      const service = createNativeVerifiedOrderService(f.control.db);
      const [a, b] = await Promise.all([
        service.commitCapturedPayment({ organizationId: f.organizationId, businessId: f.businessId, storeId: f.storeId, paymentId: first.paymentId, evidenceId: first.evidenceId, commitmentKey: 'competing-order-key-shared-00000000000000' }),
        service.commitCapturedPayment({ organizationId: f.organizationId, businessId: f.businessId, storeId: f.storeId, paymentId: second.paymentId, evidenceId: second.evidenceId, commitmentKey: 'competing-order-key-shared-00000000000000' }),
      ]);
      expect([a.order, b.order].filter(Boolean)).toHaveLength(1);
      expect([a.recoveryReason, b.recoveryReason].filter(Boolean)).toEqual(['inventory_unavailable']);
      const state = await f.bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`); return tx.execute(sql`select inventory_quantity, (select count(*) from kablet_native_orders) order_count from kablet_native_products where id=${f.productId}::uuid`); });
      expect(state.rows[0]).toMatchObject({ inventory_quantity: 0, order_count: '1' });
    } finally { await dispose(resource); }
  }, 90000);

  it('rolls back order, reservation, and inventory when a post-update failure occurs', async () => {
    const resource = await provision();
    try {
      const f = await fixture(resource); const payment = await createPayment(f);
      await resource.bootstrap.db.execute(sql`create function test_native_order_failure() returns trigger language plpgsql as $$ begin raise exception 'test-only commitment failure'; end; $$`);
      await resource.bootstrap.db.execute(sql`create trigger test_native_order_failure_trigger after update of inventory_quantity on kablet_native_products for each row execute function test_native_order_failure()`);
      const service = createNativeVerifiedOrderService(f.control.db);
      await expect(service.commitCapturedPayment({ organizationId: f.organizationId, businessId: f.businessId, storeId: f.storeId, paymentId: payment.paymentId, evidenceId: payment.evidenceId, commitmentKey: 'rollback-order-key-000000000000000000000000' })).rejects.toThrow();
      const state = await resource.bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`); return tx.execute(sql`select p.inventory_quantity, r.status, (select count(*) from kablet_native_orders) order_count from kablet_native_products p join kablet_native_inventory_reservations r on r.product_id=p.id where p.id=${f.productId}::uuid`); });
      expect(state.rows[0]).toMatchObject({ inventory_quantity: 1, status: 'active', order_count: '0' });
    } finally { await dispose(resource); }
  }, 90000);

  it('hands captured evidence to the durable worker and safely replays after an acknowledgement failure', async () => {
    const resource = await provision();
    try {
      const f = await fixture(resource); const payment = await createPayment(f);
      const pending = await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        return tx.execute(sql`select order_status, order_attempt_count from kablet_native_payment_webhook_inbox where id=${payment.evidenceId}::uuid`);
      });
      expect(pending.rows[0]).toMatchObject({ order_status: 'pending', order_attempt_count: 0 });
      await expect(resource.runtime.db.execute(sql`select * from kablet_claim_native_verified_order_work('runtime-worker', 60, 5)`)).rejects.toThrow();
      const claimable = await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        return tx.execute(sql`select i.order_status, e.verification_status, e.payment_status, i.merchant_payment_account_id, e.merchant_payment_account_id as evidence_account from kablet_native_payment_webhook_inbox i join kablet_native_payment_evidence e on e.id=i.id where i.id=${payment.evidenceId}::uuid`);
      });
      expect(claimable.rows[0], JSON.stringify(claimable.rows)).toMatchObject({ order_status: 'pending', verification_status: 'verified', payment_status: 'captured' });
      const directClaimCandidate = await resource.control.db.execute(sql`select i.id from kablet_native_payment_webhook_inbox i join kablet_native_payment_evidence e on e.id=i.id where e.verification_status='verified' and e.payment_status='captured' and i.order_status in ('pending','retryable') and (i.order_next_attempt_at is null or i.order_next_attempt_at <= now()) and i.id=${payment.evidenceId}::uuid`);
      expect(directClaimCandidate.rows, JSON.stringify(directClaimCandidate.rows)).toHaveLength(1);

      const crashingWorker = createNativeVerifiedOrderWorker(resource.control.db, {
        beforeAcknowledgement: async () => { throw Object.assign(new Error('simulated worker connection termination'), { code: '08006' }); },
      });
      await expect(crashingWorker.processOnce('worker-crash-test')).resolves.toMatchObject({ claimed: true, failed: true, status: 'retryable' });

      const afterCommitFailure = await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        return tx.execute(sql`select order_status, order_attempt_count from kablet_native_payment_webhook_inbox where id=${payment.evidenceId}::uuid`);
      });
      expect(afterCommitFailure.rows[0]).toMatchObject({ order_status: 'retryable', order_attempt_count: 1 });

      // A process failure after the order transaction is committed must not
      // create a second order. Re-open the work as an expired processing lease
      // to model a worker dying before its acknowledgement.
      await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        await tx.execute(sql`update kablet_native_payment_webhook_inbox set order_status='processing', order_worker_id='dead-worker', order_lease_expires_at=now()-interval '1 minute' where id=${payment.evidenceId}::uuid`);
      });
      const leased = await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        return tx.execute(sql`select order_status, order_attempt_count, order_lease_expires_at, order_worker_id from kablet_native_payment_webhook_inbox where id=${payment.evidenceId}::uuid`);
      });
      expect(leased.rows[0], JSON.stringify(leased.rows)).toMatchObject({ order_status: 'processing', order_worker_id: 'dead-worker' });
      const replay = createNativeVerifiedOrderWorker(resource.control.db);
      const replayResult = await replay.processOnce('worker-recovery-test');
      expect(replayResult).toMatchObject({ claimed: true, result: { idempotent: true, recoveryRequired: false } });
      const state = await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        return tx.execute(sql`select i.order_status, p.inventory_quantity, (select count(*) from kablet_native_orders where payment_id=${payment.paymentId}::uuid) order_count from kablet_native_payment_webhook_inbox i join kablet_native_products p on p.id=${f.productId}::uuid where i.id=${payment.evidenceId}::uuid`);
      });
      expect(state.rows[0]).toMatchObject({ order_status: 'processed', inventory_quantity: 0, order_count: '1' });
    } finally { await dispose(resource); }
  }, 90000);

  it('connects the exported Stripe POST route to real evidence handoff and order processing', async () => {
    const resource = await provision();
    const previous = {
      nodeEnv: process.env.NODE_ENV,
      testDatabaseUrl: process.env.TEST_DATABASE_URL,
      controlDatabaseUrl: process.env.CONTROL_DATABASE_URL,
      vaultKey: process.env.KABLET_CREDENTIAL_KEY,
      vaultVersion: process.env.KABLET_CREDENTIAL_KEY_VERSION,
    };
    try {
      const f = await fixture(resource); const payment = await createPayment(f, { status: 'captured', skipEvidence: true });
      const userId = randomUUID();
      const vaultKey = randomBytes(32);
      const vault = createCredentialVault(vaultKey, 'route-test');
      const encrypted = vault.encrypt('whsec_routeintegration');
      await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        await tx.execute(sql`insert into kablet_users(id,auth_provider,provider_subject) values (${userId}::uuid,'test','native-order-route')`);
        await tx.execute(sql`insert into kablet_provider_credentials(id,organization_id,business_id,provider_key,encrypted_secret,key_version,scopes,created_by) values (${randomUUID()}::uuid,${f.organizationId}::uuid,${f.businessId}::uuid,'stripe:test:webhook',${encrypted.ciphertext},${encrypted.keyVersion},${JSON.stringify(['webhooks.verify'])}::jsonb,${userId}::uuid)`);
      });

      process.env.NODE_ENV = 'test';
      process.env.TEST_DATABASE_URL = `postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${resource.manager.TEST_MANAGER_HOST}:${resource.manager.TEST_MANAGER_PORT}/${resource.database}`;
      process.env.CONTROL_DATABASE_URL = `postgresql://kablet_control:${encodeURIComponent(process.env.TEST_CONTROL_PASSWORD!)}@${resource.manager.TEST_MANAGER_HOST}:${resource.manager.TEST_MANAGER_PORT}/${resource.database}`;
      process.env.KABLET_CREDENTIAL_KEY = vaultKey.toString('base64');
      process.env.KABLET_CREDENTIAL_KEY_VERSION = 'route-test';
      const { POST } = await import('../../apps/web/app/api/webhooks/stripe/[storeSlug]/route');
      const timestamp = Math.floor(Date.now() / 1000);
      const event = {
        id: `evt_route_${randomBytes(8).toString('hex')}`,
        type: 'payment_intent.succeeded',
        created: timestamp,
        data: { object: {
          id: payment.providerReference,
          amount_received: 2400,
          currency: 'usd',
          metadata: {
            kablet_payment_id: payment.paymentId,
            kablet_checkout_id: payment.checkoutId,
            kablet_organization_id: f.organizationId,
            kablet_business_id: f.businessId,
            kablet_store_id: f.storeId,
            kablet_merchant_payment_account_id: f.accountId,
            kablet_merchant_account_reference: 'acct_order_fixture',
          },
        } },
      };
      const body = JSON.stringify(event);
      const signature = createHmac('sha256', 'whsec_routeintegration').update(`${timestamp}.${body}`).digest('hex');
      const requestInit = { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${timestamp},v1=${signature}` }, body } as const;
      const response = await POST(new Request('https://example.test/api/webhooks/stripe/order-test-store', requestInit), { params: Promise.resolve({ storeSlug: 'order-test-store' }) });
      const responseBody = await response.json();
      const routeDiagnostics = await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        return tx.execute(sql`select (select count(*) from kablet_native_payment_webhook_inbox where provider_event_id=${event.id}) inbox_count, (select count(*) from kablet_native_payment_evidence where provider_event_reference=${event.id}) evidence_count`);
      });
      expect(response.status, JSON.stringify({ responseBody, routeDiagnostics: routeDiagnostics.rows })).toBe(202);
      expect(responseBody).toMatchObject({ accepted: true, duplicate: false });

      const handoff = await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        return tx.execute(sql`select order_status from kablet_native_payment_webhook_inbox where provider_event_id=${event.id}`);
      });
      expect(handoff.rows[0]).toMatchObject({ order_status: 'pending' });
      const [workerA, workerB] = await Promise.all([
        createNativeVerifiedOrderWorker(resource.control.db).processOnce('route-order-worker-a'),
        createNativeVerifiedOrderWorker(resource.control.db).processOnce('route-order-worker-b'),
      ]);
      expect([workerA, workerB].filter(result => result.claimed)).toHaveLength(1);
      expect([workerA, workerB].find(result => result.claimed)).toMatchObject({ claimed: true, result: { recoveryRequired: false } });
      const committed = await resource.bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${f.organizationId}, true), set_config('kablet.business_id', ${f.businessId}, true)`);
        return tx.execute(sql`select i.order_status, p.inventory_quantity, (select count(*) from kablet_native_orders where payment_id=${payment.paymentId}::uuid) order_count from kablet_native_payment_webhook_inbox i join kablet_native_products p on p.id=${f.productId}::uuid where i.provider_event_id=${event.id}`);
      });
      expect(committed.rows[0]).toMatchObject({ order_status: 'processed', inventory_quantity: 0, order_count: '1' });
    } finally {
      if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
      if (previous.testDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL; else process.env.TEST_DATABASE_URL = previous.testDatabaseUrl;
      if (previous.controlDatabaseUrl === undefined) delete process.env.CONTROL_DATABASE_URL; else process.env.CONTROL_DATABASE_URL = previous.controlDatabaseUrl;
      if (previous.vaultKey === undefined) delete process.env.KABLET_CREDENTIAL_KEY; else process.env.KABLET_CREDENTIAL_KEY = previous.vaultKey;
      if (previous.vaultVersion === undefined) delete process.env.KABLET_CREDENTIAL_KEY_VERSION; else process.env.KABLET_CREDENTIAL_KEY_VERSION = previous.vaultVersion;
      await dispose(resource);
    }
  }, 90000);
});
