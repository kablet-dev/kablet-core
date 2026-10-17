import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createCredentialVault, createDb, createConversionRepository } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { seedBaselineIntentPolicy } from '../../integration/intent-policy-fixture';

export const organizationId = '84000000-0000-4000-8000-000000000001';
export const businessId = '84000000-0000-4000-8000-000000000002';
const nativeStoreId = '85000000-0000-4000-8000-000000000001';
const nativeVisibleProductId = '85000000-0000-4000-8000-000000000002';
const nativeDraftProductId = '85000000-0000-4000-8000-000000000003';
const nativeSecondProductId = '85000000-0000-4000-8000-000000000004';
const nativeUnknownInventoryProductId = '85000000-0000-4000-8000-000000000007';
const isolatedBusinessId = '84000000-0000-4000-8000-000000000003';
const experimentBusinessId = '84000000-0000-4000-8000-000000000004';
const isolatedStoreId = '85000000-0000-4000-8000-000000000005';
const isolatedProductId = '85000000-0000-4000-8000-000000000006';
const nativePaymentAccountId = '86000000-0000-4000-8000-000000000001';
const nativeCheckoutPolicyId = '87000000-0000-4000-8000-000000000001';
const nativeExperimentStoreId = '85000000-0000-4000-8000-000000000008';
const nativeExperimentProductOneId = '85000000-0000-4000-8000-000000000009';
const nativeExperimentProductTwoId = '85000000-0000-4000-8000-00000000000a';
const nativeExperimentId = '88000000-0000-4000-8000-000000000001';
const cookieSecret = 'e2e-only-kablet-interaction-cookie-secret-2026';

function fixtureDatabaseError(error: unknown): Error {
  const value = error as { code?: unknown; constraint?: unknown; detail?: unknown; cause?: unknown };
  const cause = value.cause as { code?: unknown; constraint?: unknown; detail?: unknown; message?: unknown } | undefined;
  const code = String(value.code ?? cause?.code ?? 'unknown');
  const constraint = value.constraint ?? cause?.constraint;
  const detail = value.detail ?? cause?.detail;
  const safeDetail = typeof detail === 'string' ? detail.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[connection redacted]') : null;
  const message = String((value as { message?: unknown }).message ?? '');
  const safeMessage = String(message || cause?.message || '').replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[connection redacted]');
  return new Error(`browser fixture database setup failed (code=${code}${constraint ? `, constraint=${String(constraint)}` : ''}${safeDetail ? `, detail=${safeDetail}` : ''}${safeMessage ? `, message=${safeMessage}` : ''})`);
}

export type BrowserDatabase = { database: string; runtimeUrl: string; controlUrl: string; credentialKey: string; credentialKeyVersion: string; organizationId: string; businessId: string; nativeExperimentBusinessId: string; cookieSecret: string; nativeStoreId: string; nativeExperimentStoreId: string; nativeVisibleProductId: string; nativeSecondProductId: string; nativeCheckoutPolicyId: string; offeringId: string; offeringRevisionId: string; definitionId: string; seedNativeExperiment: (input: { experimentKey?: string; controlComposition?: 'entry' | 'discovery' | 'comparison'; treatmentComposition?: 'entry' | 'discovery' | 'comparison' }) => Promise<string>; setNativeExperimentState: (experimentId: string, state: 'active' | 'paused' | 'ended') => Promise<void>; clearNativeExperimentExposure: (assignmentId: string) => Promise<void>; cleanup: () => Promise<void> };

export async function provisionBrowserDatabase(): Promise<BrowserDatabase> {
  const manager = loadTestManagerConfig();
  const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
  const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
  const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;
  const appPassword = process.env.TEST_APP_PASSWORD;
  const controlPassword = process.env.TEST_CONTROL_PASSWORD;
  if (!bootstrapUser || !bootstrapPassword || !roleAdminUrl || !appPassword || !controlPassword) throw new Error('Browser PostgreSQL test credentials are required');
  const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
  const database = `kablet_e2e_${randomBytes(12).toString('hex')}`;
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  const offeringId = randomUUID(); const offeringRevisionId = randomUUID(); const definitionId = randomUUID(); const credentialKey = randomBytes(32); const credentialKeyVersion = `browser-e2e-${randomBytes(8).toString('hex')}`; const createdBy = randomUUID();
  let runtime: ReturnType<typeof createDb> | undefined;
  let target: pg.Pool | undefined;
  let bootstrap: ReturnType<typeof createDb> | undefined;
  let admin: pg.Pool | undefined;
  try {
    await managerPool.query(`create database "${database}" owner "${manager.TEST_MANAGER_USER}"`);
    await managerPool.query(`grant connect, create on database "${database}" to "${bootstrapUser}"`);
    await managerPool.query(`grant connect on database "${database}" to kablet_control`);
    target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
    await target.query(`grant usage, create on schema public to "${bootstrapUser}"`);
    await target.query('grant usage, create on schema public to kablet_privacy_owner');
    await target.end();
    target = undefined;
    bootstrap = createDb(`postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
    admin = new pg.Pool({ connectionString: roleAdminUrl, max: 1 });
    await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
    try { await migrate(bootstrap.db, { migrationsFolder: resolve(process.cwd(), 'packages/db/drizzle') }); } finally { await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await admin.end(); admin = undefined; }
    await bootstrap.db.execute(sql`grant usage on schema public to kablet_dev`);
    await bootstrap.db.execute(sql`grant select, insert, update, delete on organizations, businesses, visitor_identities, visitor_sessions, visitor_observations, visitor_state_revisions, visitor_states, visitor_decisions, visitor_decision_business_truth_refs, interaction_sessions, business_offerings, business_offering_revisions, offering_publications, visitor_contact_records, visitor_consents, acquisition_contexts, experience_exposures, interaction_facts, action_requests, execution_attempts, action_outcomes, outcome_attributions, conversion_definition_revisions, conversion_facts to kablet_dev`);
    try {
      await bootstrap.db.transaction(async tx => {
      await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${businessId}, true)`);
      await tx.execute(sql`insert into organizations(id,name) values (${organizationId}::uuid,'Browser E2E Organization')`);
      await tx.execute(sql`insert into businesses(id,organization_id,name) values (${businessId}::uuid,${organizationId}::uuid,'Browser E2E Business')`);
      await tx.execute(sql`insert into businesses(id,organization_id,name) values (${isolatedBusinessId}::uuid,${organizationId}::uuid,'Browser E2E Isolated Business')`);
      await tx.execute(sql`insert into businesses(id,organization_id,name) values (${experimentBusinessId}::uuid,${organizationId}::uuid,'Browser E2E Experiment Business')`);
      await tx.execute(sql`insert into kablet_users(id,auth_provider,provider_subject) values (${createdBy}::uuid,'test','browser-e2e-checkout')`);
      await tx.execute(sql`insert into business_offerings(id,business_id,name) values (${offeringId}::uuid,${businessId}::uuid,'Browser E2E Offering')`);
      await tx.execute(sql`insert into business_offering_revisions(id,offering_id,revision_number,name,description,pricing_kind,visibility,approval_status,provenance_source_type,provenance_source_reference,provenance_captured_at,provenance_captured_by) values (${offeringRevisionId}::uuid,${offeringId}::uuid,1,'Browser E2E Offering','A published browser proof offering','unknown','public','approved','owner_input','browser-e2e',now(),'test')`);
      await tx.execute(sql`insert into offering_publications(offering_id,revision_id) values (${offeringId}::uuid,${offeringRevisionId}::uuid)`);
      await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${nativeStoreId}::uuid,${organizationId}::uuid,${businessId}::uuid,'browser-native-store','Native Store Collection','USD','published')`);
      await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${nativeVisibleProductId}::uuid,${nativeStoreId}::uuid,${organizationId}::uuid,${businessId}::uuid,'browser-native-product','NATIVE-VISIBLE-001','Browser Native Product','A product rendered from the native catalog.','2400','USD',12,1,'published','available')`);
      await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${nativeSecondProductId}::uuid,${nativeStoreId}::uuid,${organizationId}::uuid,${businessId}::uuid,'browser-native-alternate','NATIVE-ALTERNATE-001','Browser Native Alternate','A second published product for comparison coverage.','3600','USD',0,1,'published','stale')`);
      await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${nativeUnknownInventoryProductId}::uuid,${nativeStoreId}::uuid,${organizationId}::uuid,${businessId}::uuid,'browser-native-unknown-stock','NATIVE-UNKNOWN-001','Browser Native Unknown Stock','A published product whose inventory is not available to the storefront.','4200','USD',null,1,'published','available')`);
      await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${nativeDraftProductId}::uuid,${nativeStoreId}::uuid,${organizationId}::uuid,${businessId}::uuid,'private-draft-product','NATIVE-DRAFT-001','Private Draft Product','This must never render publicly.','9900','USD',3,1,'draft','available')`);
      await tx.execute(sql`insert into kablet_native_checkout_policies(id,organization_id,business_id,store_id,revision,status,currency,eligible_countries,shipping_amount_minor,tax_rate_bps) values (${nativeCheckoutPolicyId}::uuid,${organizationId}::uuid,${businessId}::uuid,${nativeStoreId}::uuid,1,'active','USD',array['US'],500,875)`);
      const encrypted = createCredentialVault(credentialKey, credentialKeyVersion).encrypt('rk_test_browser_fixture');
      await tx.execute(sql`insert into kablet_provider_credentials(id,organization_id,business_id,provider_key,encrypted_secret,key_version,scopes,created_by) values (${randomUUID()}::uuid,${organizationId}::uuid,${businessId}::uuid,'stripe:test:api',${encrypted.ciphertext},${encrypted.keyVersion},${JSON.stringify(['checkout_sessions.create','checkout_sessions.read','payment_intents.read','account.read','webhooks.verify'])}::jsonb,${createdBy}::uuid)`);
      const webhookEncrypted = createCredentialVault(credentialKey, credentialKeyVersion).encrypt('whsec_browserfixture');
      await tx.execute(sql`insert into kablet_provider_credentials(id,organization_id,business_id,provider_key,encrypted_secret,key_version,scopes,created_by) values (${randomUUID()}::uuid,${organizationId}::uuid,${businessId}::uuid,'stripe:test:webhook',${webhookEncrypted.ciphertext},${webhookEncrypted.keyVersion},${JSON.stringify(['webhooks.verify'])}::jsonb,${createdBy}::uuid)`);
      await tx.execute(sql`insert into kablet_native_payment_accounts(id,organization_id,business_id,store_id,provider_key,adapter_version,merchant_account_reference,credential_mode,credential_reference,webhook_signing_secret_reference,supported_countries,supported_currencies,status,can_authorize,can_capture,can_refund,can_receive_webhooks) values (${nativePaymentAccountId}::uuid,${organizationId}::uuid,${businessId}::uuid,${nativeStoreId}::uuid,'stripe','v1','acct_browser_fixture','test','stripe:test:api','stripe:test:webhook',array['US'],array['USD'],'active',true,true,false,true)`);
        await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${isolatedBusinessId}, true)`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${isolatedStoreId}::uuid,${organizationId}::uuid,${isolatedBusinessId}::uuid,'browser-isolated-store','Isolated Native Store','USD','published')`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${isolatedProductId}::uuid,${isolatedStoreId}::uuid,${organizationId}::uuid,${isolatedBusinessId}::uuid,'isolated-native-product','NATIVE-ISOLATED-001','Isolated Native Product','A product belonging only to the second browser store.','1800','USD',8,1,'published','available')`);
        await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${experimentBusinessId}, true)`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${nativeExperimentStoreId}::uuid,${organizationId}::uuid,${experimentBusinessId}::uuid,'browser-experiment-store','Native Experiment Store','USD','published')`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${nativeExperimentProductOneId}::uuid,${nativeExperimentStoreId}::uuid,${organizationId}::uuid,${experimentBusinessId}::uuid,'experiment-product-one','EXPERIMENT-001','Experiment Product One','A product for the controlled native canvas experiment.','2400','USD',12,1,'published','available')`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${nativeExperimentProductTwoId}::uuid,${nativeExperimentStoreId}::uuid,${organizationId}::uuid,${experimentBusinessId}::uuid,'experiment-product-two','EXPERIMENT-002','Experiment Product Two','A second product for the controlled native canvas experiment.','3600','USD',12,1,'published','available')`);
        await tx.execute(sql`insert into kablet_native_experiments(id,organization_id,business_id,store_id,experiment_key,version,state,eligibility,control_composition,treatment_composition,control_allocation_bps,treatment_allocation_bps,starts_at,attribution_window_days,attribution_rule,primary_metric,guardrail_metrics,created_by,approved_by,approved_at) values (${nativeExperimentId}::uuid,${organizationId}::uuid,${experimentBusinessId}::uuid,${nativeExperimentStoreId}::uuid,'native-browser-proof',1,'active',${JSON.stringify({ minPublishedProducts: 2 })}::jsonb,'entry','discovery',5000,5000,now()-interval '1 minute',30,'last_native_exposure.v1',${JSON.stringify({ key: 'verified_purchase', direction: 'maximize' })}::jsonb,'[]'::jsonb,${createdBy}::uuid,${createdBy}::uuid,now())`);
      });
    } catch (error) {
      throw fixtureDatabaseError(error);
    }
    await bootstrap.pool.end();
    bootstrap = undefined;
    runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(appPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
    await seedBaselineIntentPolicy(runtime.db, organizationId, businessId);
    await createConversionRepository(runtime.db).createDefinition({ id: definitionId, organizationId, businessId, definitionKey: 'lead', definitionVersion: 'v1', capabilityId: '91000000-0000-4000-8000-000000000001', capabilityVersion: '1', outcomeType: 'lead.delivered', active: true });
    const bootstrapUrl = `postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`;
    return { database, runtimeUrl: `postgresql://kablet_dev:${encodeURIComponent(appPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`, controlUrl: `postgresql://kablet_control:${encodeURIComponent(controlPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`, credentialKey: credentialKey.toString('base64'), credentialKeyVersion, organizationId, businessId, nativeExperimentBusinessId: experimentBusinessId, cookieSecret, nativeStoreId, nativeExperimentStoreId, nativeVisibleProductId, nativeSecondProductId, nativeCheckoutPolicyId, offeringId, offeringRevisionId, definitionId, seedNativeExperiment: async input => { const adminDb = createDb(bootstrapUrl); const id = randomUUID(); try { await adminDb.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${experimentBusinessId}, true)`); await tx.execute(sql`insert into kablet_native_experiments(id,organization_id,business_id,store_id,experiment_key,version,state,eligibility,control_composition,treatment_composition,control_allocation_bps,treatment_allocation_bps,starts_at,attribution_window_days,attribution_rule,primary_metric,guardrail_metrics,created_by,approved_by,approved_at) values (${id}::uuid,${organizationId}::uuid,${experimentBusinessId}::uuid,${nativeExperimentStoreId}::uuid,${input.experimentKey ?? 'native-proof'},1,'active',${JSON.stringify({ minPublishedProducts: 1 })}::jsonb,${input.controlComposition ?? 'entry'},${input.treatmentComposition ?? 'discovery'},5000,5000,now()-interval '1 minute',30,'last_native_exposure.v1',${JSON.stringify({ key: 'verified_purchase', direction: 'maximize' })}::jsonb,'[]'::jsonb,${randomUUID()}::uuid,${randomUUID()}::uuid,now())`); }); return id; } finally { await adminDb.pool.end(); } }, setNativeExperimentState: async (experimentId, state) => { const adminDb = createDb(bootstrapUrl); try { await adminDb.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${experimentBusinessId}, true)`); await tx.execute(sql`update kablet_native_experiments set state=${state} where organization_id=${organizationId}::uuid and business_id=${experimentBusinessId}::uuid and store_id=${nativeExperimentStoreId}::uuid and id=${experimentId}::uuid`); }); } finally { await adminDb.pool.end(); } }, clearNativeExperimentExposure: async assignmentId => { const adminDb = createDb(bootstrapUrl); try { await adminDb.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${experimentBusinessId}, true)`); await tx.execute(sql`delete from kablet_native_experiment_exposures where assignment_id=${assignmentId}::uuid`); }); } finally { await adminDb.pool.end(); } }, cleanup: async () => { try { await runtime?.pool.end(); } finally { await managerPool.query(`drop database if exists "${database}"`); await managerPool.end(); } } };
  } catch (error) {
    await target?.end().catch(() => undefined);
    await bootstrap?.pool.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await runtime?.pool.end().catch(() => undefined);
    await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
    await managerPool.end().catch(() => undefined);
    throw error;
  }
}

function testDatabaseUrl(): string {
  const runtime = process.env.TEST_DATABASE_URL;
  const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
  const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
  if (!runtime || !bootstrapUser || !bootstrapPassword) throw new Error('Disposable native fixture credentials are required');
  const url = new URL(runtime);
  url.username = bootstrapUser;
  url.password = bootstrapPassword;
  return url.toString();
}

export async function updateDisposableNativeProductPrice(input: { amountMinor: number; priceRevision: number }): Promise<void> {
  const pool = new pg.Pool({ connectionString: testDatabaseUrl(), max: 1 });
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('kablet.organization_id', $1, true), set_config('kablet.business_id', $2, true)`, [organizationId, businessId]);
    await client.query(`update kablet_native_products set amount_minor = $1, price_revision = $2, updated_at = now() where id = $3 and store_id = $4 and organization_id = $5 and business_id = $6`, [input.amountMinor, input.priceRevision, nativeVisibleProductId, nativeStoreId, organizationId, businessId]);
    await client.query('commit');
  } catch (error) { await client.query('rollback').catch(() => undefined); throw error; }
  finally { client.release(); await pool.end(); }
}

export async function expireDisposableNativeCarts(): Promise<void> {
  const pool = new pg.Pool({ connectionString: testDatabaseUrl(), max: 1 });
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('kablet.organization_id', $1, true), set_config('kablet.business_id', $2, true)`, [organizationId, businessId]);
    await client.query(`update kablet_native_carts set expires_at = now() - interval '1 minute', status = 'active' where organization_id = $1 and business_id = $2 and store_id = $3`, [organizationId, businessId, nativeStoreId]);
    await client.query('commit');
  } catch (error) { await client.query('rollback').catch(() => undefined); throw error; }
  finally { client.release(); await pool.end(); }
}
