import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { processStripeWebhook } from '../../apps/web/lib/stripe-webhook';
import type { NativeMerchantPaymentAccount } from '@kablet/domain';

const account: NativeMerchantPaymentAccount = {
  contractVersion: 'native-merchant-payment-account.v1', paymentAccountId: '11111111-1111-4111-8111-111111111111', organizationId: '22222222-2222-4222-8222-222222222222', businessId: '33333333-3333-4333-8333-333333333333', storeId: '44444444-4444-4444-8444-444444444444', providerKey: 'stripe', adapterVersion: 'v1', merchantAccountReference: 'acct_fixture', credentialMode: 'test', credentialReference: 'stripe:test:api', webhookSigningSecretReference: 'stripe:test:webhook', supportedCountries: ['US'], supportedCurrencies: ['USD'], status: 'active', capabilities: { authorize: true, capture: true, refunds: false, webhooks: true }, createdAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z',
};
const payment = { paymentId: '55555555-5555-4555-8555-555555555555', organizationId: account.organizationId, businessId: account.businessId, storeId: account.storeId, checkoutId: '66666666-6666-4666-8666-666666666666', merchantPaymentAccountId: account.paymentAccountId, amountMinor: 2400, currency: 'USD', providerPaymentReference: 'pi_fixture', providerSessionReference: 'cs_fixture' };
const now = 1_792_200_000;

function event(type = 'payment_intent.payment_failed') {
  return JSON.stringify({ id: 'evt_fixture', type, created: now, data: { object: { id: 'pi_fixture', amount: 2400, currency: 'usd', metadata: { kablet_payment_id: payment.paymentId, kablet_checkout_id: payment.checkoutId, kablet_organization_id: payment.organizationId, kablet_business_id: payment.businessId, kablet_store_id: payment.storeId, kablet_merchant_payment_account_id: account.paymentAccountId, kablet_merchant_account_reference: account.merchantAccountReference } } } });
}
function request(body: string, signatureSecret = 'whsec_fixture') {
  const signature = createHmac('sha256', signatureSecret).update(`${now}.${body}`).digest('hex');
  return new Request('https://example.test/api/webhooks/stripe/store', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${now},v1=${signature}` }, body });
}
function streamed(chunks: Uint8Array[], contentLength?: string) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); },
  });
  return new Request('https://example.test/api/webhooks/stripe/store', { method: 'POST', headers: { 'content-type': 'application/json', ...(contentLength ? { 'content-length': contentLength } : {}) }, body: stream, duplex: 'half' } as RequestInit & { duplex: 'half' });
}
function deps(overrides: Partial<Parameters<typeof processStripeWebhook>[2]> = {}) {
  return { resolveAccount: vi.fn().mockResolvedValue(account), resolvePayment: vi.fn().mockResolvedValue(payment), readSecret: vi.fn().mockResolvedValue('whsec_fixture'), ingest: vi.fn().mockResolvedValue({ inserted: true, evidenceId: '77777777-7777-4777-8777-777777777777' }), now: () => now, ...overrides };
}

describe('Stripe webhook HTTP orchestration', () => {
  it('verifies raw signed bytes, matches authoritative payment state, and ingests once', async () => {
    const body = event(); const dependencies = deps();
    const result = await processStripeWebhook(request(body), 'browser-native-store', dependencies);
    expect(result.status).toBe(202);
    expect(dependencies.ingest).toHaveBeenCalledOnce();
    expect(dependencies.readSecret).toHaveBeenCalledWith('stripe:test:webhook', 'stripe_webhook_signing_secret', ['webhooks.verify']);
  });

  it('rejects forged, stale, malformed, oversized, and mismatched requests without ingestion', async () => {
    const invalid = await processStripeWebhook(new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=bad' }, body: event() }), 'store', deps());
    expect(invalid.status).toBe(400);
    const malformed = await processStripeWebhook(request('{not-json'), 'store', deps());
    expect(malformed.status).toBe(400);
    const tooLarge = await processStripeWebhook(new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '262145' }, body: '{}' }), 'store', deps());
    expect(tooLarge.status).toBe(413);
    const mismatch = await processStripeWebhook(request(event()), 'store', deps({ resolvePayment: vi.fn().mockResolvedValue({ ...payment, amountMinor: 2500 }) }));
    expect(mismatch.status).toBe(409);
    const unbound = await processStripeWebhook(request(event()), 'store', deps({ resolvePayment: vi.fn().mockResolvedValue({ ...payment, providerPaymentReference: null }) }));
    expect(unbound.status).toBe(409);
    const bound = await processStripeWebhook(request(event()), 'store', deps({ resolvePayment: vi.fn().mockResolvedValue({ ...payment, providerPaymentReference: null }), bindFromStoredSession: vi.fn().mockResolvedValue(payment) }));
    expect(bound.status).toBe(202);
    const wrongReference = await processStripeWebhook(request(event()), 'store', deps({ resolvePayment: vi.fn().mockResolvedValue({ ...payment, providerPaymentReference: 'pi_other' }) }));
    expect(wrongReference.status).toBe(409);
    const ignoredDependencies = deps();
    const ignored = await processStripeWebhook(request(event('checkout.session.completed')), 'store', ignoredDependencies);
    expect(ignored.status).toBe(202);
    expect(ignoredDependencies.ingest).not.toHaveBeenCalled();
    const unsupported = await processStripeWebhook(request(event('customer.created')), 'store', deps());
    expect(unsupported.status).toBe(400);
  });

  it('bounds streamed bodies and returns retryable errors for ingestion infrastructure failures', async () => {
    const exact = await processStripeWebhook(streamed([new Uint8Array(256 * 1024)]), 'store', deps());
    expect(exact.status).not.toBe(413);
    const firstChunkTooLarge = await processStripeWebhook(streamed([new Uint8Array(256 * 1024 + 1)]), 'store', deps());
    expect(firstChunkTooLarge.status).toBe(413);
    const multipleChunksTooLarge = await processStripeWebhook(streamed([new Uint8Array(200 * 1024), new Uint8Array(56 * 1024 + 1)]), 'store', deps());
    expect(multipleChunksTooLarge.status).toBe(413);
    const falsifiedLength = await processStripeWebhook(streamed([new Uint8Array(256 * 1024 + 1)], '1'), 'store', deps());
    expect(falsifiedLength.status).toBe(413);
    const unavailable = await processStripeWebhook(request(event()), 'store', deps({ ingest: vi.fn().mockRejectedValue(new Error('database unavailable')) }));
    expect(unavailable.status).toBe(503);
  });
});
