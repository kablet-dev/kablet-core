import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDb } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');

describe.skipIf(!enabled)('native payment schema', () => {
  it('applies payment foundation with tenant RLS, dedupe constraints, and no app evidence writes', async () => {
    const manager = loadTestManagerConfig();
    const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
    const database = `kablet_payment_${randomBytes(12).toString('hex')}`;
    const org = randomUUID(); const biz = randomUUID(); const store = randomUUID(); const account = randomUUID(); const cart = randomUUID(); const checkout = randomUUID(); const payment = randomUUID(); const evidence = randomUUID();
    const reconciliationKeyHash = createHash('sha256').update('native-payment-reconciliation-fixture').digest();
    const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
    let bootstrap: ReturnType<typeof createDb> | undefined; let runtime: ReturnType<typeof createDb> | undefined;
    try {
      await managerPool.query(`create database "${database}" owner "${manager.TEST_MANAGER_USER}"`);
      await managerPool.query(`grant connect, create on database "${database}" to "${process.env.TEST_BOOTSTRAP_USER}"`);
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
        await tx.execute(sql`insert into kablet_native_carts(id,organization_id,business_id,store_id,token_hash,currency,expires_at) values (${cart}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${Buffer.alloc(32, 3)},'USD',now()+interval '30 days')`);
        await tx.execute(sql`insert into kablet_native_checkout_sessions(id,organization_id,business_id,store_id,cart_id,cart_version,checkout_revision,fulfillment_type,status,currency,shipping_eligibility,shipping_charge_state,tax_state,server_total_state,expires_at) values (${checkout}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${cart}::uuid,0,1,'physical','created','USD','pending','not_calculated','not_calculated','not_calculated',now()+interval '15 minutes')`);
        await tx.execute(sql`insert into kablet_native_payment_accounts(id,organization_id,business_id,store_id,provider_key,adapter_version,merchant_account_reference,credential_reference,supported_countries,supported_currencies,status,can_authorize,can_capture,can_refund,can_receive_webhooks) values (${account}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,'provider-neutral','v1','opaque-account','vault-ref',array['US'],array['USD'],'pending',false,false,false,false)`);
        await tx.execute(sql`insert into kablet_native_payment_attempts(id,organization_id,business_id,store_id,checkout_id,checkout_revision,merchant_payment_account_id,amount_minor,currency,operation_id,idempotency_key_hash,status) values (${payment}::uuid,${org}::uuid,${biz}::uuid,${store}::uuid,${checkout}::uuid,1,${account}::uuid,2400,'USD','operation-1',${Buffer.alloc(32, 4)},'unknown')`);
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
      const checks = await runtime.db.execute(sql`select current_user, has_table_privilege(current_user,'kablet_native_payment_evidence','select') as evidence_select, has_table_privilege(current_user,'kablet_native_payment_evidence','insert') as evidence_insert, (select relrowsecurity from pg_class where relname='kablet_native_payment_evidence') as rls, (select relforcerowsecurity from pg_class where relname='kablet_native_payment_evidence') as forced`);
      expect(checks.rows[0]).toMatchObject({ current_user: 'kablet_dev', evidence_select: true, evidence_insert: false, rls: true, forced: true });
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
      await runtime?.pool.end().catch(() => undefined); await bootstrap?.pool.end().catch(() => undefined);
      await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined); await managerPool.end();
    }
  }, 90000);
});
