import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createCommerceRepository, createDb } from '@kablet/db';
import { processShopifyWebhook } from '../../apps/worker/src/shopify-worker';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const manager = loadTestManagerConfig();
const enabled = Boolean(process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD && process.env.TEST_CONTROL_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');
const org = '73000000-0000-4000-8000-000000000001';
const business = '74000000-0000-4000-8000-000000000001';
const otherOrg = '73000000-0000-4000-8000-000000000002';
const otherBusiness = '74000000-0000-4000-8000-000000000002';

describe.skipIf(!enabled)('commerce provider foundation', () => {
  it('migrates tenant-safe provider/catalog/webhook state with durable deduplication', async () => {
    const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
    const database = `kablet_commerce_${randomBytes(12).toString('hex')}`;
    const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
    let runtime: ReturnType<typeof createDb> | undefined;
    let control: ReturnType<typeof createDb> | undefined;
    let bootstrap: ReturnType<typeof createDb> | undefined;
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
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Commerce Foundation')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'Commerce Business')`);
        await tx.execute(sql`select set_config('kablet.organization_id',${otherOrg},true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${otherOrg}::uuid,'Other Commerce Foundation')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${otherBusiness}::uuid,${otherOrg}::uuid,'Other Commerce Business')`);
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`insert into kablet_users(id,auth_provider,provider_subject) values ('75000000-0000-4000-8000-000000000001','test','commerce-foundation-user')`);
      });
      runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      control = createDb(`postgresql://kablet_control:${encodeURIComponent(process.env.TEST_CONTROL_PASSWORD ?? '')}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const repository = createCommerceRepository(runtime.db);
      const controlRepository = createCommerceRepository(control.db);
      const connection = await repository.upsertConnection({ organizationId: org, businessId: business, provider: 'shopify', shopDomain: 'commerce-foundation.myshopify.com', externalShopId: 'shop-1', credentialProviderKey: 'shopify:commerce-foundation.myshopify.com', scopes: ['read_products', 'read_inventory'] });
      expect(connection.rows).toHaveLength(1);
      await expect(runtime.db.execute(sql`insert into kablet_provider_webhook_inbox(id,connection_id,organization_id,business_id,provider,provider_event_id,event_type,payload,signature_verified) values (${randomUUID()}::uuid,${String(connection.rows[0].id)}::uuid,${org}::uuid,${business}::uuid,'shopify','forged-event','products/update','{}'::jsonb,true)`)).rejects.toThrow();
      await expect(repository.upsertConnection({ organizationId: otherOrg, businessId: otherBusiness, provider: 'shopify', shopDomain: 'commerce-foundation.myshopify.com', externalShopId: 'shop-1', credentialProviderKey: 'shopify:commerce-foundation.myshopify.com', scopes: ['read_products', 'read_inventory'] })).rejects.toThrow();
      const product = { contractVersion: 'commerce.v1' as const, provider: 'shopify' as const, externalId: 'product-1', title: 'Foundation product', description: '', status: 'active' as const, availability: 'available' as const, sourceUpdatedAt: new Date('2026-01-02T00:00:00Z'), observedAt: new Date('2026-01-02T00:00:00Z'), ingestionRevision: 1, sourceEvidence: { providerRevision: '2026-01-02T00:00:00Z', state: 'authoritative' as const }, imageUrls: [] };
      const productResult = await repository.upsertProduct({ organizationId: org, businessId: business, connectionId: String(connection.rows[0].id), product });
      expect(productResult.rows).toHaveLength(1);
      const duplicate = await repository.upsertProduct({ organizationId: org, businessId: business, connectionId: String(connection.rows[0].id), product: { ...product, title: 'Older product', sourceUpdatedAt: new Date('2026-01-01T00:00:00Z'), sourceEvidence: { providerRevision: '2026-01-01T00:00:00Z', state: 'stale' as const } } });
      expect(duplicate.rows).toHaveLength(0);
      const event = { contractVersion: 'commerce.v1' as const, provider: 'shopify' as const, eventId: 'webhook-1', eventType: 'products/update', occurredAt: new Date(), sourceVersion: '2026-01', payload: { id: 'product-2', title: 'Event product', status: 'active', updated_at: '2026-01-03T00:00:00Z', variants: [{ id: 'variant-2', title: 'Default', inventory_quantity: 3, updated_at: '2026-01-03T00:00:00Z' }] } };
      const resolvedForWebhook = await controlRepository.resolveConnectionForWebhook({ provider: 'shopify', shopDomain: 'commerce-foundation.myshopify.com' });
      expect(resolvedForWebhook.rows).toHaveLength(1);
      await controlRepository.createOAuthState({ organizationId: org, businessId: business, requestedBy: '75000000-0000-4000-8000-000000000001', provider: 'shopify', shopDomain: 'commerce-foundation.myshopify.com', stateHash: 'oauth-state-hash', expiresAt: new Date(Date.now() + 60_000) });
      const consumedState = await controlRepository.consumeOAuthState({ stateHash: 'oauth-state-hash', provider: 'shopify', shopDomain: 'commerce-foundation.myshopify.com' });
      expect(consumedState.rows).toHaveLength(1);
      const replayedState = await controlRepository.consumeOAuthState({ stateHash: 'oauth-state-hash', provider: 'shopify', shopDomain: 'commerce-foundation.myshopify.com' });
      expect(replayedState.rows).toHaveLength(0);
      const accepted = await controlRepository.acceptVerifiedWebhook({ organizationId: org, businessId: business, connectionId: String(connection.rows[0].id), event });
      expect(accepted.rows).toHaveLength(1);
      const duplicateEvent = await controlRepository.acceptVerifiedWebhook({ organizationId: org, businessId: business, connectionId: String(connection.rows[0].id), event });
      expect(duplicateEvent.rows).toHaveLength(0);
      const claimed = await repository.claimWebhook({ organizationId: org, businessId: business, workerId: 'test-worker', maxAttempts: 3 });
      expect(claimed).toMatchObject({ event_type: 'products/update', attempts: 1 });
      await processShopifyWebhook({ eventType: claimed!.event_type, payload: claimed!.payload, organizationId: org, businessId: business, connectionId: String(connection.rows[0].id), repository });
      await repository.completeWebhook({ organizationId: org, businessId: business, eventId: String(claimed!.id) });
      await expect(repository.claimWebhook({ organizationId: '73000000-0000-4000-8000-000000000099', businessId: business, workerId: 'other-worker', maxAttempts: 3 })).resolves.toBeNull();
      const policies = await bootstrap.db.execute(sql`select relname,relforcerowsecurity from pg_class where relname in ('kablet_provider_connections','kablet_catalog_products','kablet_catalog_variants','kablet_catalog_syncs','kablet_provider_webhook_inbox') order by relname`);
      expect(policies.rows).toHaveLength(5);
      for (const row of policies.rows) expect(row).toMatchObject({ relforcerowsecurity: true });
      const runtimePrivileges = await bootstrap.db.execute(sql`select has_table_privilege('kablet_dev','kablet_provider_webhook_inbox','INSERT') as can_insert, has_table_privilege('kablet_dev','kablet_provider_webhook_inbox','UPDATE') as can_update`);
      expect(runtimePrivileges.rows[0]).toMatchObject({ can_insert: false, can_update: true });
      const controlPrivileges = await bootstrap.db.execute(sql`select has_table_privilege('kablet_control','kablet_provider_oauth_states','INSERT') as oauth_insert, has_table_privilege('kablet_control','kablet_provider_oauth_states','UPDATE') as oauth_update, has_table_privilege('kablet_control','kablet_provider_webhook_inbox','INSERT') as webhook_insert`);
      expect(controlPrivileges.rows[0]).toMatchObject({ oauth_insert: true, oauth_update: true, webhook_insert: true });
    } finally {
      await runtime?.pool.end().catch(() => undefined);
      await control?.pool.end().catch(() => undefined);
      await bootstrap?.pool.end().catch(() => undefined);
      await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
      await managerPool.end();
    }
  }, 90000);
});
