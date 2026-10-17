import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDb, createNativeStripeIngestionRepository, createNativeStripeWebhookRepository } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';
import { processStripeWebhook } from '../../apps/web/lib/stripe-webhook';

const enabled = Boolean(process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD && process.env.TEST_CONTROL_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');

describe.skipIf(!enabled)('native payment schema', () => {
  it('applies payment foundation with tenant RLS, dedupe constraints, and no app evidence writes', async () => {
    const manager = loadTestManagerConfig();
    const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
    const database = `kablet_payment_${randomBytes(12).toString('hex')}`;
    const org = randomUUID(); const biz = randomUUID(); const store = randomUUID(); const account = randomUUID(); const cart = randomUUID(); const checkout = randomUUID(); const payment = randomUUID(); const evidence = randomUUID(); const reconciliationEvidence = randomUUID(); const product = randomUUID(); const line = randomUUID(); const reservation = randomUUID(); const checkout2 = randomUUID(); const line2 = randomUUID(); const reservation2 = randomUUID(); const payment2 = randomUUID(); const payment3 = randomUUID(); const evidence2 = randomUUID(); const successEvidence2 = randomUUID(); const ingestedEvidence = randomUUID();
    const reconciliationKeyHash = createHash('sha256').update('native-payment-reconciliation-fixture').digest();
    const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
    let bootstrap: ReturnType<typeof createDb> | undefined; let runtime: ReturnType<typeof createDb> | undefined; let control: ReturnType<typeof createDb> | undefined;
    try {
      await managerPool.query(`create database "${database}" owner "${manager.TEST_MANAGER_USER}"`);
      await managerPool.query(`grant connect, create on database "${database}" to "${process.env.TEST_BOOTSTRAP_USER}"`);
      await managerPool.query(`grant connect on database "${database}" to kablet_control`);
      const target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
      await target.query(`grant usage, create on schema public to "${process.env.TEST_BOOTSTRAP_USER}"`);
      await target.query('grant usage, create on schema public to kablet_privacy_owner');
      await target.end();
      bootstrap = createDb(`postgresql://${encodeURIComponent(process.env.TEST_BOOTSTRAP_USER!)}:${encodeURIComponent(process.env.TEST_BOOTSTRAP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const admin = new pg.Pool({ connectionString: process.env.TEST_ROLE_ADMIN_URL, max: 1 });
      await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
      try { await migrate(bootstrap.db, { migrationsFolder }); } finally { await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await admin.end(); }
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Payment Schema Org')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${biz}::uuid,${org}::uuid,'Payment Schema Business')`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${store}::uuid,${org}::uuid,${biz}::uuid,'payment-schema-store','Payment Schema Store','USD','published')`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${product}::uuid,${store}::uuid,${org}::uuid,${biz}::uuid,'payment-schema-product','PAY-001','Payment Product','Fixture','2400','USD',1,1,'published','available')`);
        await tx.execute(sql`insert into kablet_native_carts(id,organization_id,business_id,store_id,token_hash,currency,expires_at) values (${cart}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${Buffer.alloc(32, 3)},'USD',now()+interval '30 days')`);
        await tx.execute(sql`insert into kablet_native_checkout_sessions(id,organization_id,business_id,store_id,cart_id,cart_version,checkout_revision,fulfillment_type,status,currency,shipping_eligibility,shipping_charge_state,tax_state,server_total_state,server_total_amount_minor,server_total_currency,expires_at) values (${checkout}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${cart}::uuid,0,1,'physical','created','USD','pending','not_calculated','not_calculated','calculated',2400,'USD',now()+interval '15 minutes')`);
        await tx.execute(sql`insert into kablet_native_checkout_lines(id,organization_id,business_id,store_id,checkout_id,product_id,fulfillment_type,sku_snapshot,quantity,unit_amount_minor,line_amount_minor,currency_snapshot,price_revision_snapshot,product_title_snapshot) values (${line}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${checkout}::uuid,${product}::uuid,'physical','PAY-001',1,2400,2400,'USD',1,'Payment Product')`);
        await tx.execute(sql`insert into kablet_native_inventory_reservations(id,organization_id,business_id,store_id,checkout_id,checkout_line_id,product_id,sku_snapshot,quantity,status,expires_at) values (${reservation}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${checkout}::uuid,${line}::uuid,${product}::uuid,'PAY-001',1,'active',now()+interval '15 minutes')`);
        await tx.execute(sql`insert into kablet_native_checkout_sessions(id,organization_id,business_id,store_id,cart_id,cart_version,checkout_revision,fulfillment_type,status,currency,shipping_eligibility,shipping_charge_state,tax_state,server_total_state,server_total_amount_minor,server_total_currency,expires_at) values (${checkout2}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${cart}::uuid,0,1,'physical','created','USD','pending','not_calculated','not_calculated','calculated',2400,'USD',now()+interval '15 minutes')`);
        await tx.execute(sql`insert into kablet_native_checkout_lines(id,organization_id,business_id,store_id,checkout_id,product_id,fulfillment_type,sku_snapshot,quantity,unit_amount_minor,line_amount_minor,currency_snapshot,price_revision_snapshot,product_title_snapshot) values (${line2}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${checkout2}::uuid,${product}::uuid,'physical','PAY-001',1,2400,2400,'USD',1,'Payment Product')`);
        await tx.execute(sql`insert into kablet_native_inventory_reservations(id,organization_id,business_id,store_id,checkout_id,checkout_line_id,product_id,sku_snapshot,quantity,status,expires_at) values (${reservation2}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${checkout2}::uuid,${line2}::uuid,${product}::uuid,'PAY-001',1,'active',now()+interval '15 minutes')`);
        await tx.execute(sql`insert into kablet_native_payment_accounts(id,organization_id,business_id,store_id,provider_key,adapter_version,merchant_account_reference,credential_mode,credential_reference,webhook_signing_secret_reference,supported_countries,supported_currencies,status,can_authorize,can_capture,can_refund,can_receive_webhooks) values (${account}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,'stripe','v1','acct_fixture','test','stripe:test:api','stripe:test:webhook',array['US'],array['USD'],'active',true,true,false,true)`);
        await tx.execute(sql`insert into kablet_native_payment_attempts(id,organization_id,business_id,store_id,checkout_id,checkout_revision,merchant_payment_account_id,amount_minor,currency,operation_id,idempotency_key_hash,provider_payment_reference,status) values (${payment}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${checkout}::uuid,1,${account}::uuid,2400,'USD','operation-1',${Buffer.alloc(32, 4)},'payment','failed')`);
        await tx.execute(sql`insert into kablet_native_payment_attempts(id,organization_id,business_id,store_id,checkout_id,checkout_revision,merchant_payment_account_id,amount_minor,currency,operation_id,idempotency_key_hash,provider_payment_reference,status) values (${payment2}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${checkout2}::uuid,1,${account}::uuid,2400,'USD','operation-2',${Buffer.alloc(32, 5)},'payment-2','failed')`);
        await tx.execute(sql`insert into kablet_native_payment_attempts(id,organization_id,business_id,store_id,checkout_id,checkout_revision,merchant_payment_account_id,amount_minor,currency,operation_id,idempotency_key_hash,provider_session_reference,status) values (${payment3}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${checkout2}::uuid,2,${account}::uuid,2400,'USD','operation-3',${Buffer.alloc(32, 6)},'cs_binding','created')`);
      });
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`insert into kablet_native_payment_webhook_inbox(id,organization_id,business_id,store_id,merchant_payment_account_id,provider_event_id,event_type,payload_digest,signature_status,processing_status) values (${randomUUID()}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${account}::uuid,'event-1','payment.changed',${Buffer.alloc(32, 1)},'unverified','received')`);
      });
      await expect(bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`insert into kablet_native_payment_webhook_inbox(id,organization_id,business_id,store_id,merchant_payment_account_id,provider_event_id,event_type,payload_digest,signature_status,processing_status) values (${randomUUID()}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${account}::uuid,'event-1','payment.changed',${Buffer.alloc(32, 2)},'unverified','received')`);
      })).rejects.toThrow();
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`insert into kablet_native_payment_evidence(id,organization_id,business_id,store_id,payment_id,merchant_payment_account_id,provider_event_reference,provider_object_reference,provider_payment_reference,amount_minor,currency,payment_status,authentication_method,verification_status,provenance,observed_at) values (${evidence}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${payment}::uuid,${account}::uuid,'event-valid','object','payment',2400,'USD','captured','signed_webhook','pending','fixture',now())`);
        await tx.execute(sql`insert into kablet_native_payment_evidence(id,organization_id,business_id,store_id,payment_id,merchant_payment_account_id,provider_event_reference,provider_object_reference,provider_payment_reference,amount_minor,currency,payment_status,authentication_method,verification_status,provenance,observed_at,authenticated_at,verified_at) values (${reconciliationEvidence}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${payment}::uuid,${account}::uuid,'event-reconciled','object','payment',2400,'USD','failed','signed_webhook','verified','fixture',now(),now(),now())`);
        await tx.execute(sql`insert into kablet_native_payment_evidence(id,organization_id,business_id,store_id,payment_id,merchant_payment_account_id,provider_event_reference,provider_object_reference,provider_payment_reference,amount_minor,currency,payment_status,authentication_method,verification_status,provenance,observed_at,authenticated_at,verified_at) values (${evidence2}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${payment2}::uuid,${account}::uuid,'event-reconciled-2','object-2','payment-2',2400,'USD','failed','signed_webhook','verified','fixture',now(),now(),now())`);
      });
      for (const [amount, currency] of [[2500, 'USD'], [2400, 'EUR']] as const) {
        await expect(bootstrap.db.transaction(async tx => {
          await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
          await tx.execute(sql`insert into kablet_native_payment_evidence(id,organization_id,business_id,store_id,payment_id,merchant_payment_account_id,provider_event_reference,provider_object_reference,provider_payment_reference,amount_minor,currency,payment_status,authentication_method,verification_status,provenance,observed_at) values (${randomUUID()}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${payment}::uuid,${account}::uuid,${'event-mismatch-' + amount + currency},'object','payment',${amount},${currency},'captured','signed_webhook','pending','fixture',now())`);
        })).rejects.toThrow();
      }
      await expect(bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`insert into kablet_native_payment_evidence(id,organization_id,business_id,store_id,payment_id,merchant_payment_account_id,provider_event_reference,provider_object_reference,provider_payment_reference,amount_minor,currency,payment_status,authentication_method,verification_status,provenance,observed_at) values (${randomUUID()}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${randomUUID()}::uuid,${account}::uuid,'event-unrelated','object','payment',2400,'USD','captured','signed_webhook','pending','fixture',now())`);
      })).rejects.toThrow();
      await expect(bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`insert into kablet_native_payment_evidence(id,organization_id,business_id,store_id,payment_id,merchant_payment_account_id,provider_event_reference,provider_object_reference,provider_payment_reference,amount_minor,currency,payment_status,authentication_method,verification_status,provenance,observed_at) values (${randomUUID()}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${payment}::uuid,${randomUUID()}::uuid,'event-account','object','payment',2400,'USD','captured','signed_webhook','pending','fixture',now())`);
      })).rejects.toThrow();
      await expect(bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`insert into kablet_native_payment_evidence(id,organization_id,business_id,store_id,payment_id,merchant_payment_account_id,provider_event_reference,provider_object_reference,provider_payment_reference,amount_minor,currency,payment_status,authentication_method,verification_status,provenance,observed_at) values (${randomUUID()}::uuid,${randomUUID()}::uuid,${biz}::uuid,${store}::uuid,${payment}::uuid,${account}::uuid,'event-tenant','object','payment',2400,'USD','captured','signed_webhook','pending','fixture',now())`);
      })).rejects.toThrow();
      const reconciliationInsert = async (id: string, status: string, evidenceId: string | null, reference: string | null, resolvedAt: string | null) => bootstrap!.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`insert into kablet_native_payment_reconciliations(id,organization_id,business_id,store_id,payment_id,merchant_payment_account_id,reconciliation_key_hash,reason,status,resolution_evidence_id,authorized_resolution_reference,resolved_at) values (${id}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${payment}::uuid,${account}::uuid,${reconciliationKeyHash},'unknown_payment',${status},${evidenceId ? sql`${evidenceId}::uuid` : sql`null`},${reference},${resolvedAt ? sql`${resolvedAt}::timestamptz` : sql`null`})`);
      });
      await expect(reconciliationInsert(randomUUID(), 'resolved_paid', null, 'authorized-ref', new Date().toISOString())).rejects.toThrow();
      await expect(reconciliationInsert(randomUUID(), 'resolved_not_paid', evidence, null, new Date().toISOString())).rejects.toThrow();
      await expect(reconciliationInsert(randomUUID(), 'resolved_paid', evidence, 'authorized-ref', null)).rejects.toThrow();
      await reconciliationInsert(randomUUID(), 'resolved_paid', evidence, 'authorized-ref', new Date().toISOString());
      runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const runtime2 = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const { createNativePaymentExecutionService } = await import('@kablet/db');
      const paymentService = createNativePaymentExecutionService(runtime.db);
      const paymentService2 = createNativePaymentExecutionService(runtime2.db);
      const paymentInput = { organizationId: org, businessId: biz, storeId: store, checkoutId: checkout, merchantPaymentAccountId: account, idempotencyKey: 'schema-payment-retry', captureMode: 'authorize_only' as const };
      const [paymentAttemptA, paymentAttemptB] = await Promise.all([paymentService.createPaymentAttempt(paymentInput), paymentService2.createPaymentAttempt(paymentInput)]);
      expect(paymentAttemptA.payment.paymentId).toBe(paymentAttemptB.payment.paymentId);
      expect(paymentAttemptA.payment.amountMinor).toBe(2400);
      expect(paymentAttemptA.payment.currency).toBe('USD');
      expect([paymentAttemptA.idempotent, paymentAttemptB.idempotent].sort()).toEqual([false, true]);
      await expect(paymentService.createPaymentAttempt({ ...paymentInput, captureMode: 'authorize_and_capture' })).rejects.toThrow('payment idempotency conflict');
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`update kablet_native_payment_accounts set can_authorize=false where id=${account}::uuid`);
      });
      await expect(paymentService.createPaymentAttempt({ ...paymentInput, idempotencyKey: 'ineligible-account' })).rejects.toThrow();
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`update kablet_native_payment_accounts set can_authorize=true where id=${account}::uuid`);
      });
      await runtime2.pool.end();
      const checks = await runtime.db.execute(sql`select current_user, has_table_privilege(current_user,'kablet_native_payment_evidence','select') as evidence_select, has_table_privilege(current_user,'kablet_native_payment_evidence','insert') as evidence_insert, (select relrowsecurity from pg_class where relname='kablet_native_payment_evidence') as rls, (select relforcerowsecurity from pg_class where relname='kablet_native_payment_evidence') as forced`);
      expect(checks.rows[0]).toMatchObject({ current_user: 'kablet_dev', evidence_select: true, evidence_insert: false, rls: true, forced: true });
      const authority = await runtime.db.execute(sql`select has_function_privilege(current_user, 'public.kablet_reconcile_unknown_reservation(uuid,uuid,uuid,uuid,uuid,character varying)', 'execute') as can_reconcile, has_function_privilege(current_user, 'public.kablet_ingest_verified_native_payment_evidence(uuid,uuid,uuid,uuid,uuid,character varying,character varying,character varying,bytea,uuid,character varying,numeric,character varying,character varying,timestamptz)', 'execute') as can_ingest, pg_has_role(current_user, 'kablet_control', 'member') as can_set_control`);
      expect(authority.rows[0].can_reconcile).toBe(false);
      expect(authority.rows[0].can_ingest).toBe(false);
      expect(authority.rows[0].can_set_control).toBe(false);
      await expect(runtime.db.execute(sql`set role kablet_control`)).rejects.toThrow();
      await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`update kablet_native_inventory_reservations set status='unknown', updated_at=now() where id=${reservation}::uuid`);
      });
      await expect(runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`update kablet_native_inventory_reservations set status='released', released_at=now() where id=${reservation}::uuid`);
      })).rejects.toThrow();
      control = createDb(`postgresql://kablet_control:${encodeURIComponent(process.env.TEST_CONTROL_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const controlIdentity = await control.db.execute(sql`select current_user, has_function_privilege(current_user, 'public.kablet_reconcile_unknown_reservation(uuid,uuid,uuid,uuid,uuid,character varying)', 'execute') as can_reconcile, has_function_privilege(current_user, 'public.kablet_ingest_verified_native_payment_evidence(uuid,uuid,uuid,uuid,uuid,character varying,character varying,character varying,bytea,uuid,character varying,numeric,character varying,character varying,timestamptz)', 'execute') as can_ingest`);
      expect(controlIdentity.rows[0]).toMatchObject({ current_user: 'kablet_control', can_reconcile: true, can_ingest: true });
      const webhookRepository = createNativeStripeWebhookRepository(runtime.db);
      const stripeIngestion = createNativeStripeIngestionRepository(control.db);
      const controlWebhookRepository = createNativeStripeWebhookRepository(control.db);
      const webhookBody = JSON.stringify({ id: 'evt-http-fixture', type: 'payment_intent.payment_failed', created: 1792200000, data: { object: { id: 'payment-2', amount: 2400, currency: 'usd', metadata: { kablet_payment_id: payment2, kablet_checkout_id: checkout2, kablet_organization_id: org, kablet_business_id: biz, kablet_store_id: store, kablet_merchant_payment_account_id: account, kablet_merchant_account_reference: 'acct_fixture' } } } });
      const webhookSignature = createHmac('sha256', 'whsec_fixture').update(`1792200000.${webhookBody}`).digest('hex');
      const webhookRequest = () => new Request('https://example.test/api/webhooks/stripe/payment-schema-store', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=1792200000,v1=${webhookSignature}` }, body: webhookBody });
      const webhookDeps = { resolveAccount: (slug: string) => webhookRepository.resolveAccount(slug), resolvePayment: webhookRepository.resolvePayment, readSecret: async () => 'whsec_fixture', ingest: stripeIngestion.ingestVerifiedEvidence, now: () => 1792200000 };
      const [acceptedWebhook, duplicateWebhook] = await Promise.all([
        processStripeWebhook(webhookRequest(), 'payment-schema-store', webhookDeps),
        processStripeWebhook(webhookRequest(), 'payment-schema-store', webhookDeps),
      ]);
      expect(acceptedWebhook.status).toBe(202);
      expect(duplicateWebhook.status).toBe(202);
      const duplicateFlags = await Promise.all([acceptedWebhook.json(), duplicateWebhook.json()]);
      expect(duplicateFlags.map(value => (value as { duplicate: boolean }).duplicate).sort()).toEqual([false, true]);
      const forgedWebhook = await processStripeWebhook(new Request('https://example.test/api/webhooks/stripe/payment-schema-store', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1792200000,v1=bad' }, body: webhookBody }), 'payment-schema-store', webhookDeps);
      expect(forgedWebhook.status).toBe(400);
       const setFixtureState = (query: ReturnType<typeof sql>) => bootstrap!.db.transaction(async tx => {
         await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
         await tx.execute(query);
       });
       const bindingPayment = await webhookRepository.resolvePayment({ organizationId: org, businessId: biz, storeId: store, paymentId: payment3 });
       expect(bindingPayment?.providerPaymentReference).toBeNull();
       expect(bindingPayment?.providerSessionReference).toBe('cs_binding');
      const bindInput = { paymentId: payment3, organizationId: org, businessId: biz, storeId: store, merchantPaymentAccountId: account, providerSessionReference: 'cs_binding', providerPaymentReference: 'pi_bound' };
      await expect(webhookRepository.bindPaymentReference(bindInput)).rejects.toThrow();
       await setFixtureState(sql`update kablet_native_payment_attempts set provider_session_reference=null where id=${payment3}::uuid`);
       await expect(controlWebhookRepository.bindPaymentReference(bindInput)).rejects.toThrow('payment session reference conflict');
       await setFixtureState(sql`update kablet_native_payment_attempts set provider_session_reference='cs_binding' where id=${payment3}::uuid`);
      const [boundA, boundB] = await Promise.all([controlWebhookRepository.bindPaymentReference(bindInput), controlWebhookRepository.bindPaymentReference(bindInput)]);
      expect([boundA?.providerPaymentReference, boundB?.providerPaymentReference]).toEqual(['pi_bound', 'pi_bound']);
      await expect(controlWebhookRepository.bindPaymentReference({ ...bindInput, providerPaymentReference: 'pi_other' })).rejects.toThrow('payment reference conflict');
      const ingest = (evidenceId: string) => control!.db.execute(sql`select * from kablet_ingest_verified_native_payment_evidence(${evidenceId}::uuid, ${org}::uuid, ${biz}::uuid, ${store}::uuid, ${account}::uuid, 'event-stripe-ingested', 'payment_intent.failed', 'pi-payment-2', ${createHash('sha256').update('stripe-payload').digest()}, ${payment2}::uuid, 'payment-2', 2400, 'USD', 'failed', now())`);
      const firstIngest = await ingest(ingestedEvidence);
      expect(firstIngest.rows[0]).toMatchObject({ inserted: true, evidence_id: ingestedEvidence });
      const duplicateIngest = await ingest(randomUUID());
      expect(duplicateIngest.rows[0]).toMatchObject({ inserted: false, evidence_id: null });
      const reconcile = (reservationId: string, evidenceId: string) => control!.db.execute(sql`select kablet_reconcile_unknown_reservation(${org}::uuid, ${biz}::uuid, ${store}::uuid, ${reservationId}::uuid, ${evidenceId}::uuid, 'verified non-payment outcome')`);
      await setFixtureState(sql`update kablet_native_payment_attempts set status='created' where id=${payment}::uuid`);
      await expect(reconcile(reservation, reconciliationEvidence)).rejects.toThrow();
      await setFixtureState(sql`update kablet_native_payment_attempts set status='unknown' where id=${payment}::uuid`);
      await expect(reconcile(reservation, reconciliationEvidence)).rejects.toThrow();
      await setFixtureState(sql`update kablet_native_payment_attempts set status='failed' where id=${payment}::uuid`);
      await reconcile(reservation, reconciliationEvidence);
      const reconciled = await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        return tx.execute(sql`select status from kablet_native_inventory_reservations where id=${reservation}::uuid`);
      });
      expect(reconciled.rows[0].status).toBe('released');
      await setFixtureState(sql`update kablet_native_inventory_reservations set status='unknown', updated_at=now() where id=${reservation2}::uuid`);
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`insert into kablet_native_payment_evidence(id,organization_id,business_id,store_id,payment_id,merchant_payment_account_id,provider_event_reference,provider_object_reference,provider_payment_reference,amount_minor,currency,payment_status,authentication_method,verification_status,provenance,observed_at,authenticated_at,verified_at) values (${successEvidence2}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${payment2}::uuid,${account}::uuid,'event-success-later','object-2','payment-2',2400,'USD','captured','signed_webhook','verified','fixture',now(),now(),now())`);
      });
      await expect(reconcile(reservation2, evidence2)).rejects.toThrow();
      await setFixtureState(sql`update kablet_native_payment_attempts set status='captured' where id=${payment2}::uuid`);
      await expect(reconcile(reservation2, evidence2)).rejects.toThrow();
      await setFixtureState(sql`update kablet_native_payment_attempts set status='authorized' where id=${payment2}::uuid`);
      await expect(reconcile(reservation2, evidence2)).rejects.toThrow();
      await expect(bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        await tx.execute(sql`insert into kablet_native_payment_evidence(id,organization_id,business_id,store_id,payment_id,merchant_payment_account_id,provider_event_reference,provider_object_reference,provider_payment_reference,amount_minor,currency,payment_status,authentication_method,verification_status,provenance,observed_at,authenticated_at,verified_at) values (${randomUUID()}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${payment2}::uuid,${account}::uuid,'event-provider-mismatch','object-2','wrong-provider-reference',2400,'USD','failed','signed_webhook','verified','fixture',now(),now(),now())`);
      })).rejects.toThrow();
      const visible = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${biz}, true)`);
        return tx.execute(sql`select id from kablet_native_payment_accounts where id=${account}::uuid`);
      });
      expect(visible.rows).toHaveLength(1);
      const hidden = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${randomUUID()}, true), set_config('kablet.business_id', ${randomUUID()}, true)`);
        return tx.execute(sql`select id from kablet_native_payment_accounts where id=${account}::uuid`);
      });
      expect(hidden.rows).toHaveLength(0);
    } finally {
      await control?.pool.end().catch(() => undefined); await runtime?.pool.end().catch(() => undefined); await bootstrap?.pool.end().catch(() => undefined);
      await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined); await managerPool.end();
    }
  }, 90000);
});
