import { createCommerceRepository, createCredentialVault, createDb, createNativeVerifiedOrderWorker, createSecurityRepository } from '@kablet/db';
import { loadControlServerConfig, loadServerConfig } from '@kablet/config';
import { syncShopifyCatalog } from './shopify-catalog-sync.js';
import { processShopifyWebhook } from './shopify-worker.js';

export async function processAvailableWebhooksOnce() {
  const runtime = createDb(loadServerConfig().DATABASE_URL);
  const control = createDb(loadControlServerConfig().DATABASE_URL);
  try {
    const controlRepository = createCommerceRepository(control.db);
    const runtimeRepository = createCommerceRepository(runtime.db);
    const connections = await controlRepository.listActiveConnections();
    for (const connection of connections.rows as Array<{ id: string; organization_id: string; business_id: string; provider: string }>) {
      if (connection.provider !== 'shopify') continue;
      const event = await runtimeRepository.claimWebhook({ organizationId: connection.organization_id, businessId: connection.business_id, workerId: `worker:${process.pid}`, maxAttempts: 5 });
      if (!event) continue;
      try {
        await processShopifyWebhook({ repository: runtimeRepository, organizationId: connection.organization_id, businessId: connection.business_id, connectionId: connection.id, eventType: event.event_type, payload: event.payload });
        await runtimeRepository.completeWebhook({ organizationId: connection.organization_id, businessId: connection.business_id, eventId: event.id });
      } catch (error) {
        await runtimeRepository.failWebhook({ organizationId: connection.organization_id, businessId: connection.business_id, eventId: event.id, error: error instanceof Error ? error.message : 'webhook_processing_failed', retryable: true, maxAttempts: 5 });
      }
    }
  } finally { await control.pool.end(); await runtime.pool.end(); }
}

export async function processAvailableCatalogSyncsOnce() {
  const runtime = createDb(loadServerConfig().DATABASE_URL);
  const control = createDb(loadControlServerConfig().DATABASE_URL);
  try {
    const controlRepository = createCommerceRepository(control.db);
    const runtimeRepository = createCommerceRepository(runtime.db);
    const security = createSecurityRepository(control.db);
    const key = process.env.KABLET_CREDENTIAL_KEY;
    const keyVersion = process.env.KABLET_CREDENTIAL_KEY_VERSION;
    const apiVersion = process.env.SHOPIFY_API_VERSION;
    if (!key || !keyVersion || !apiVersion) throw new Error('catalog_worker_not_configured');
    const vault = createCredentialVault(Buffer.from(key, 'base64'), keyVersion);
    const connections = await controlRepository.listActiveConnections();
    for (const connection of connections.rows as Array<{ id: string; organization_id: string; business_id: string; provider: string; shop_domain: string }>) {
      if (connection.provider !== 'shopify') continue;
      const syncs = await runtimeRepository.listRunningCatalogSyncs({ organizationId: connection.organization_id, businessId: connection.business_id, connectionId: connection.id });
      for (const sync of syncs.rows as Array<{ id: string }>) {
        await syncShopifyCatalog({ repository: runtimeRepository, organizationId: connection.organization_id, businessId: connection.business_id, connectionId: connection.id, shopDomain: connection.shop_domain, apiVersion, workerId: `catalog-worker:${process.pid}`, syncId: sync.id, credentialReader: scopes => security.readProviderCredentialSecret({ organizationId: connection.organization_id, businessId: connection.business_id, providerKey: `shopify:${connection.shop_domain}`, requiredScopes: scopes }, vault) });
      }
    }
  } finally { await control.pool.end(); await runtime.pool.end(); }
}

/**
 * Process captured-payment order work from the durable native payment inbox.
 * This runs on the existing worker process and never exposes a public HTTP
 * worker endpoint. The control connection is required by the database claim,
 * commitment, and acknowledgement functions.
 */
export async function processAvailableNativeOrderWorkOnce() {
  const control = createDb(loadControlServerConfig().DATABASE_URL);
  try {
    const worker = createNativeVerifiedOrderWorker(control.db);
    const workerId = `native-order-worker:${process.pid}`;
    for (let processed = 0; processed < 20; processed += 1) {
      const result = await worker.processOnce(workerId);
      if (!result.claimed) break;
    }
  } finally { await control.pool.end(); }
}

let stopping = false;
let idleHandle: NodeJS.Timeout | undefined;
async function run() {
  const config = loadServerConfig();
  console.log(`Kablet worker ready on database ${new URL(config.DATABASE_URL).host}`);
  await processAvailableWebhooksOnce();
  await processAvailableCatalogSyncsOnce();
  await processAvailableNativeOrderWorkOnce();
  idleHandle = setInterval(() => {
    Promise.all([processAvailableWebhooksOnce(), processAvailableCatalogSyncsOnce(), processAvailableNativeOrderWorkOnce()]).catch(error => console.error('Worker cycle failed:', error instanceof Error ? error.message : 'unknown'));
  }, Number(process.env.WORKER_POLL_MS ?? 5000));
}
function shutdown() { if (stopping) return; stopping = true; if (idleHandle) clearInterval(idleHandle); console.log('Kablet worker stopped'); }
if (process.env.KABLET_WORKER_RUN === 'true') run().catch(error => { console.error('Worker startup failed:', error instanceof Error ? error.message : 'unknown'); process.exitCode = 1; });
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
