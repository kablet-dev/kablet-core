import { createDb, createNativeStripeIngestionRepository, createNativeStripeWebhookRepository, createSecurityRepository } from '@kablet/db';
import { loadControlCredentialVault } from '../../../../../lib/control-credential-vault';
import { loadControlServerConfig, loadServerConfig } from '@kablet/config';
import { processStripeWebhook } from '../../../../../lib/stripe-webhook';
import { assertStripeHostedSessionBinding, createStripeAdapter, createStripeCredentialReader, type StripeCredentialPurpose } from '../../../../../lib/stripe-provider';

type Params = { params: Promise<{ storeSlug: string }> };

export async function POST(request: Request, { params }: Params) {
  const { storeSlug } = await params;
  let runtime: ReturnType<typeof createDb> | undefined;
  let control: ReturnType<typeof createDb> | undefined;
  try {
    runtime = createDb(loadServerConfig().DATABASE_URL);
    const webhook = createNativeStripeWebhookRepository(runtime.db);
    const account = await webhook.resolveAccount(storeSlug);
    const controlConfig = loadControlServerConfig();
    control = createDb(controlConfig.DATABASE_URL);
    const controlWebhook = createNativeStripeWebhookRepository(control.db);
    const security = createSecurityRepository(runtime.db);
    const vault = loadControlCredentialVault();
    const ingestion = createNativeStripeIngestionRepository(control.db);
    const readSecret = (reference: string, _purpose: StripeCredentialPurpose, scopes: readonly string[]) => security.readProviderCredentialSecret({ organizationId: account!.organizationId, businessId: account!.businessId, providerKey: reference, requiredScopes: [...scopes] }, vault);
    const adapter = account ? createStripeAdapter({ account, credentialReader: createStripeCredentialReader({ readSecret }) }) : null;
    return await processStripeWebhook(request, storeSlug, {
      resolveAccount: async () => account,
      resolvePayment: webhook.resolvePayment,
      readSecret,
      ingest: ingestion.ingestVerifiedEvidence,
      bindFromStoredSession: async payment => {
        if (!adapter || !account || !payment.providerSessionReference) throw new Error('payment binding unavailable');
        const session = await adapter.retrieveHostedSession(payment.providerSessionReference);
        const providerPaymentReference = assertStripeHostedSessionBinding({ session, account, payment });
        const bound = await controlWebhook.bindPaymentReference({ ...payment, providerSessionReference: payment.providerSessionReference, providerPaymentReference });
        if (!bound) throw new Error('payment binding unavailable');
        return bound;
      },
    });
  } catch {
    return new Response(JSON.stringify({ code: 'webhook_unavailable' }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } finally {
    await control?.pool.end().catch(() => undefined);
    await runtime?.pool.end().catch(() => undefined);
  }
}
