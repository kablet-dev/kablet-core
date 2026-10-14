import { createCommerceRepository, createDb } from '@kablet/db';
import { loadControlServerConfig, loadServerConfig } from '@kablet/config';
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

let stopping = false;
let idleHandle: NodeJS.Timeout | undefined;
async function run() {
  const config = loadServerConfig();
  console.log(`Kablet worker ready on database ${new URL(config.DATABASE_URL).host}`);
  await processAvailableWebhooksOnce();
  idleHandle = setInterval(() => { processAvailableWebhooksOnce().catch(error => console.error('Webhook worker cycle failed:', error instanceof Error ? error.message : 'unknown')); }, Number(process.env.WORKER_POLL_MS ?? 5000));
}
function shutdown() { if (stopping) return; stopping = true; if (idleHandle) clearInterval(idleHandle); console.log('Kablet worker stopped'); }
if (process.env.KABLET_WORKER_RUN === 'true') run().catch(error => { console.error('Worker startup failed:', error instanceof Error ? error.message : 'unknown'); process.exitCode = 1; });
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
