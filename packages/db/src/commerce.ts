import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database, DatabaseTransaction } from './index.js';
import type { CatalogSyncStatus, CommerceProduct, CommerceVariant, ProviderEvent } from '@kablet/domain';

async function tenant<T>(db: Database['db'], organizationId: string, businessId: string, work: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${businessId}, true)`);
    return work(tx);
  });
}

function normalizeShopDomain(value: string): string {
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) throw new Error('invalid_shop_domain');
  return domain;
}

export function createCommerceRepository(db: Database['db']) {
  return {
    async createOAuthState(input: { organizationId: string; businessId: string; requestedBy: string; provider: 'shopify'; shopDomain: string; stateHash: string; expiresAt: Date }) {
      const shopDomain = normalizeShopDomain(input.shopDomain);
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`insert into kablet_provider_oauth_states(state_hash,requested_by,organization_id,business_id,provider,shop_domain,expires_at) values (${input.stateHash},${input.requestedBy}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.provider},${shopDomain},${input.expiresAt}) returning state_hash,expires_at`));
    },
    async consumeOAuthState(input: { stateHash: string; provider: 'shopify'; shopDomain: string }) {
      const shopDomain = normalizeShopDomain(input.shopDomain);
      return db.transaction(async tx => tx.execute(sql`update kablet_provider_oauth_states set consumed_at=now() where state_hash=${input.stateHash} and provider=${input.provider} and shop_domain=${shopDomain} and consumed_at is null and expires_at>now() returning requested_by,organization_id,business_id,provider,shop_domain`));
    },
    async upsertConnection(input: { organizationId: string; businessId: string; provider: 'shopify'; shopDomain: string; externalShopId: string; credentialProviderKey: string; scopes: string[] }) {
      const shopDomain = normalizeShopDomain(input.shopDomain);
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`insert into kablet_provider_connections(id,organization_id,business_id,provider,shop_domain,external_shop_id,credential_provider_key,scopes,status,health_status,last_verified_at) values (${randomUUID()}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.provider},${shopDomain},${input.externalShopId},${input.credentialProviderKey},${JSON.stringify(input.scopes)}::jsonb,'active','healthy',now()) on conflict (provider,shop_domain) do update set external_shop_id=excluded.external_shop_id,credential_provider_key=excluded.credential_provider_key,scopes=excluded.scopes,status='active',health_status='healthy',last_error=null,last_verified_at=now(),updated_at=now() returning id,shop_domain,status,health_status`));
    },
    async resolveConnectionForWebhook(input: { provider: 'shopify'; shopDomain: string }) {
      const shopDomain = normalizeShopDomain(input.shopDomain);
      return db.execute(sql`select id,organization_id,business_id,provider,shop_domain,credential_provider_key,scopes,status from kablet_provider_connections where provider=${input.provider} and shop_domain=${shopDomain} and status='active' limit 1`);
    },
    async listActiveConnections() {
      return db.execute(sql`select id,organization_id,business_id,provider,shop_domain from kablet_provider_connections where status='active'`);
    },
    async acceptVerifiedWebhook(input: { connectionId: string; organizationId: string; businessId: string; event: ProviderEvent }) {
      const e = input.event;
      return db.execute(sql`insert into kablet_provider_webhook_inbox(id,connection_id,organization_id,business_id,provider,provider_event_id,event_type,occurred_at,payload,signature_verified) values (${randomUUID()}::uuid,${input.connectionId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${e.provider},${e.eventId},${e.eventType},${e.occurredAt},${JSON.stringify(e.payload)}::jsonb,true) on conflict (organization_id,business_id,provider,provider_event_id) do nothing returning id,status`);
    },
    async disconnectConnection(input: { organizationId: string; businessId: string; connectionId: string }) {
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`update kablet_provider_connections set status='disconnected',health_status='unknown',updated_at=now() where id=${input.connectionId}::uuid returning id,status`));
    },
    async beginCatalogSync(input: { organizationId: string; businessId: string; connectionId: string; syncKind: 'initial' | 'incremental' | 'reconciliation' }) {
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`insert into kablet_catalog_syncs(id,connection_id,organization_id,business_id,sync_kind,status) values (${randomUUID()}::uuid,${input.connectionId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.syncKind},'running') returning id,status,cursor`));
    },
    async checkpointCatalogSync(input: { organizationId: string; businessId: string; syncId: string; cursor: string | null; recordsSeen: number; recordsApplied: number }) {
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`update kablet_catalog_syncs set cursor=${input.cursor},records_seen=${input.recordsSeen},records_applied=${input.recordsApplied} where id=${input.syncId}::uuid and status='running' returning id,cursor`));
    },
    async finishCatalogSync(input: { organizationId: string; businessId: string; syncId: string; status: CatalogSyncStatus; errorMessage?: string | null }) {
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`update kablet_catalog_syncs set status=${input.status},error_message=${input.errorMessage ?? null},completed_at=now() where id=${input.syncId}::uuid returning id,status,completed_at`));
    },
    async upsertProduct(input: { organizationId: string; businessId: string; connectionId: string; product: CommerceProduct }) {
      const p = input.product;
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`insert into kablet_catalog_products(id,connection_id,organization_id,business_id,provider,external_id,title,description,status,availability,image_urls,source_updated_at,observed_at,source_event_occurred_at,revision) values (${randomUUID()}::uuid,${input.connectionId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${p.provider},${p.externalId},${p.title},${p.description},${p.status},${p.availability},${JSON.stringify(p.imageUrls)}::jsonb,${p.sourceUpdatedAt},${p.observedAt},${p.sourceUpdatedAt},${p.revision}) on conflict (organization_id,business_id,provider,external_id) do update set title=excluded.title,description=excluded.description,status=excluded.status,availability=excluded.availability,image_urls=excluded.image_urls,source_updated_at=excluded.source_updated_at,observed_at=excluded.observed_at,source_event_occurred_at=excluded.source_event_occurred_at,revision=greatest(kablet_catalog_products.revision,excluded.revision),updated_at=now() where excluded.revision >= kablet_catalog_products.revision and (excluded.source_event_occurred_at is null or kablet_catalog_products.source_event_occurred_at is null or excluded.source_event_occurred_at >= kablet_catalog_products.source_event_occurred_at) returning id,revision`));
    },
    async upsertVariant(input: { organizationId: string; businessId: string; connectionId: string; productId: string; variant: CommerceVariant }) {
      const v = input.variant;
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`insert into kablet_catalog_variants(id,product_id,connection_id,organization_id,business_id,provider,external_id,title,amount_minor,currency,available_quantity,availability,source_updated_at,observed_at,source_event_occurred_at,revision) values (${randomUUID()}::uuid,${input.productId}::uuid,${input.connectionId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${v.provider},${v.externalId},${v.title},${v.price?.amountMinor ?? null},${v.price?.currency ?? null},${v.availableQuantity},${v.availability},${v.sourceUpdatedAt},${v.observedAt},${v.sourceUpdatedAt},${v.revision}) on conflict (organization_id,business_id,provider,external_id) do update set title=excluded.title,amount_minor=excluded.amount_minor,currency=excluded.currency,available_quantity=excluded.available_quantity,availability=excluded.availability,source_updated_at=excluded.source_updated_at,observed_at=excluded.observed_at,source_event_occurred_at=excluded.source_event_occurred_at,revision=greatest(kablet_catalog_variants.revision,excluded.revision),updated_at=now() where excluded.revision >= kablet_catalog_variants.revision and (excluded.source_event_occurred_at is null or kablet_catalog_variants.source_event_occurred_at is null or excluded.source_event_occurred_at >= kablet_catalog_variants.source_event_occurred_at) returning id,revision`));
    },
    async acceptWebhook(input: { organizationId: string; businessId: string; connectionId: string; event: ProviderEvent; signatureVerified: boolean }) {
      if (!input.signatureVerified) throw new Error('webhook_signature_invalid');
      const e = input.event;
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`insert into kablet_provider_webhook_inbox(id,connection_id,organization_id,business_id,provider,provider_event_id,event_type,occurred_at,payload,signature_verified) values (${randomUUID()}::uuid,${input.connectionId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${e.provider},${e.eventId},${e.eventType},${e.occurredAt},${JSON.stringify(e.payload)}::jsonb,true) on conflict (organization_id,business_id,provider,provider_event_id) do nothing returning id,status`));
    },
    async claimWebhook(input: { organizationId: string; businessId: string; workerId: string; maxAttempts: number }) {
      return tenant(db, input.organizationId, input.businessId, async tx => {
        const result = await tx.execute(sql`select id,connection_id,event_type,payload,attempts from kablet_provider_webhook_inbox where status in ('accepted','retryable') and next_attempt_at<=now() and attempts<${input.maxAttempts} for update skip locked limit 1`);
        const row = result.rows[0] as { id: string; connection_id: string; event_type: string; payload: unknown; attempts: number } | undefined;
        if (!row) return null;
        await tx.execute(sql`update kablet_provider_webhook_inbox set status='processing',attempts=attempts+1,claimed_at=now(),claimed_by=${input.workerId} where id=${row.id}::uuid`);
        return { ...row, attempts: row.attempts + 1 };
      });
    },
    async completeWebhook(input: { organizationId: string; businessId: string; eventId: string }) {
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`update kablet_provider_webhook_inbox set status='processed',processed_at=now(),last_error=null where id=${input.eventId}::uuid and status='processing' returning id,status`));
    },
    async failWebhook(input: { organizationId: string; businessId: string; eventId: string; error: string; retryable: boolean; maxAttempts: number }) {
      return tenant(db, input.organizationId, input.businessId, tx => tx.execute(sql`update kablet_provider_webhook_inbox set status=case when ${input.retryable} and attempts < ${input.maxAttempts} then 'retryable' else 'dead_letter' end,last_error=${input.error.slice(0,500)},next_attempt_at=now()+case when ${input.retryable} and attempts < ${input.maxAttempts} then interval '30 seconds' else interval '365 days' end where id=${input.eventId}::uuid and status='processing' returning id,status`));
    },
  };
}
