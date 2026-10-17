import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createDb: vi.fn(),
  createNativeStripeWebhookRepository: vi.fn(),
  createNativeStripeIngestionRepository: vi.fn(),
  createSecurityRepository: vi.fn(),
  loadServerConfig: vi.fn(),
  loadControlServerConfig: vi.fn(),
  loadControlCredentialVault: vi.fn(),
  createStripeAdapter: vi.fn(),
  createStripeCredentialReader: vi.fn(),
  assertStripeHostedSessionBinding: vi.fn(),
}));

vi.mock('@kablet/config', () => ({
  loadServerConfig: mocks.loadServerConfig,
  loadControlServerConfig: mocks.loadControlServerConfig,
}));
vi.mock('@kablet/db', () => ({
  createDb: mocks.createDb,
  createNativeStripeWebhookRepository: mocks.createNativeStripeWebhookRepository,
  createNativeStripeIngestionRepository: mocks.createNativeStripeIngestionRepository,
  createSecurityRepository: mocks.createSecurityRepository,
}));
vi.mock('../../apps/web/lib/control-credential-vault', () => ({ loadControlCredentialVault: mocks.loadControlCredentialVault }));
vi.mock('../../apps/web/lib/stripe-provider', () => ({
  createStripeAdapter: mocks.createStripeAdapter,
  createStripeCredentialReader: mocks.createStripeCredentialReader,
  assertStripeHostedSessionBinding: mocks.assertStripeHostedSessionBinding,
}));

import { POST } from '../../apps/web/app/api/webhooks/stripe/[storeSlug]/route';

const org = '10000000-0000-4000-8000-000000000001';
const business = '10000000-0000-4000-8000-000000000002';
const store = '10000000-0000-4000-8000-000000000003';
const accountId = '10000000-0000-4000-8000-000000000004';
const paymentId = '10000000-0000-4000-8000-000000000005';
const checkoutId = '10000000-0000-4000-8000-000000000006';
const account = { paymentAccountId: accountId, organizationId: org, businessId: business, storeId: store, merchantAccountReference: 'acct_route', status: 'active', capabilities: { authorize: true, capture: true, refunds: false, webhooks: true } };
const payment = { paymentId, organizationId: org, businessId: business, storeId: store, checkoutId, merchantPaymentAccountId: accountId, amountMinor: 2400, currency: 'USD', providerPaymentReference: null, providerSessionReference: 'cs_route' };

const event = {
  evidence: { evidenceId: '20000000-0000-4000-8000-000000000001', providerEventReference: 'evt_route', providerObjectReference: 'pi_route', providerPaymentReference: 'pi_route', organizationId: org, businessId: business, storeId: store, paymentId, merchantPaymentAccountId: accountId, amountMinor: 2400, currency: 'USD', paymentStatus: 'captured', observedAt: new Date().toISOString() },
  eventType: 'payment_intent.succeeded',
  checkoutId,
};

function request() {
  const body = JSON.stringify({ id: 'evt_route', type: 'payment_intent.succeeded' });
  const signature = createHmac('sha256', 'whsec_route').update(`1792200000.${body}`).digest('hex');
  return new Request('https://example.test/api/webhooks/stripe/route-store', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=1792200000,v1=${signature}` }, body });
}

describe('Stripe webhook Next route', () => {
  const runtime = { db: {}, pool: { end: vi.fn().mockResolvedValue(undefined) } };
  const control = { db: {}, pool: { end: vi.fn().mockResolvedValue(undefined) } };
  const runtimeWebhook = { resolveAccount: vi.fn(), resolvePayment: vi.fn() };
  const controlWebhook = { bindPaymentReference: vi.fn() };
  const ingestion = { ingestVerifiedEvidence: vi.fn() };
  const adapter = { verifyWebhook: vi.fn(), retrieveHostedSession: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadServerConfig.mockReturnValue({ DATABASE_URL: 'postgres://runtime' });
    mocks.loadControlServerConfig.mockReturnValue({ DATABASE_URL: 'postgres://control' });
    mocks.loadControlCredentialVault.mockReturnValue({});
    mocks.createDb.mockReturnValueOnce(runtime).mockReturnValueOnce(control);
    mocks.createNativeStripeWebhookRepository.mockReturnValueOnce(runtimeWebhook).mockReturnValueOnce(controlWebhook);
    mocks.createNativeStripeIngestionRepository.mockReturnValue(ingestion);
    mocks.createSecurityRepository.mockReturnValue({ readProviderCredentialSecret: vi.fn().mockResolvedValue('whsec_route') });
    mocks.createStripeCredentialReader.mockReturnValue(vi.fn());
    mocks.createStripeAdapter.mockReturnValue(adapter);
    mocks.assertStripeHostedSessionBinding.mockReturnValue('pi_route');
    runtimeWebhook.resolveAccount.mockResolvedValue(account);
    runtimeWebhook.resolvePayment.mockResolvedValue(payment);
    controlWebhook.bindPaymentReference.mockResolvedValue({ ...payment, providerPaymentReference: 'pi_route' });
    ingestion.ingestVerifiedEvidence.mockResolvedValue({ inserted: true, evidenceId: event.evidence.evidenceId });
    adapter.verifyWebhook.mockResolvedValue(event);
    adapter.retrieveHostedSession.mockResolvedValue({ id: 'cs_route' });
  });

  it('runs the exported route through stored-session retrieval, binding, and ingestion', async () => {
    const response = await POST(request(), { params: Promise.resolve({ storeSlug: 'route-store' }) });
    expect(response.status).toBe(202);
    expect(runtimeWebhook.resolveAccount).toHaveBeenCalledWith('route-store');
    expect(adapter.retrieveHostedSession).toHaveBeenCalledWith('cs_route');
    expect(controlWebhook.bindPaymentReference).toHaveBeenCalledWith(expect.objectContaining({ providerSessionReference: 'cs_route', providerPaymentReference: 'pi_route' }));
    expect(ingestion.ingestVerifiedEvidence).toHaveBeenCalledOnce();
    expect(JSON.stringify(await response.json())).not.toContain('whsec_route');
  });

  it('fails closed for an unbound payment without privileged binding or ingestion', async () => {
    runtimeWebhook.resolvePayment.mockResolvedValue({ ...payment, providerSessionReference: null });
    const response = await POST(request(), { params: Promise.resolve({ storeSlug: 'route-store' }) });
    expect(response.status).toBe(409);
    expect(adapter.retrieveHostedSession).not.toHaveBeenCalled();
    expect(controlWebhook.bindPaymentReference).not.toHaveBeenCalled();
    expect(ingestion.ingestVerifiedEvidence).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature before binding or ingestion', async () => {
    adapter.verifyWebhook.mockRejectedValue(Object.assign(new Error('bad signature'), { code: 'signature_invalid' }));
    const response = await POST(request(), { params: Promise.resolve({ storeSlug: 'route-store' }) });
    expect(response.status).toBe(400);
    expect(adapter.retrieveHostedSession).not.toHaveBeenCalled();
    expect(controlWebhook.bindPaymentReference).not.toHaveBeenCalled();
    expect(ingestion.ingestVerifiedEvidence).not.toHaveBeenCalled();
  });

  it('returns retryable failure when authoritative database resolution is unavailable', async () => {
    runtimeWebhook.resolveAccount.mockRejectedValue(new Error('database unavailable'));
    const response = await POST(request(), { params: Promise.resolve({ storeSlug: 'route-store' }) });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: 'webhook_unavailable' });
  });

  it('returns retryable failure when stored-session provider retrieval is unavailable', async () => {
    adapter.retrieveHostedSession.mockRejectedValue(new Error('provider unavailable'));
    const response = await POST(request(), { params: Promise.resolve({ storeSlug: 'route-store' }) });
    expect(response.status).toBe(503);
    expect(ingestion.ingestVerifiedEvidence).not.toHaveBeenCalled();
  });
});
