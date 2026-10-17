import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { assertStripeHostedSessionBinding, createStripeAdapter, verifyStripeWebhookSignature } from '../../apps/web/lib/stripe-provider';
import type { NativeMerchantPaymentAccount, NativePaymentAttempt } from '@kablet/domain';

const account: NativeMerchantPaymentAccount = {
  contractVersion: 'native-merchant-payment-account.v1',
  paymentAccountId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  businessId: '33333333-3333-4333-8333-333333333333',
  storeId: '44444444-4444-4444-8444-444444444444',
  providerKey: 'stripe',
  adapterVersion: 'v1',
  merchantAccountReference: 'acct_fixture',
  credentialMode: 'test',
  credentialReference: 'stripe:test:store-fixture',
  webhookSigningSecretReference: 'stripe_webhook_signing_secret:store-fixture',
  supportedCountries: ['US'],
  supportedCurrencies: ['USD'],
  status: 'active',
  capabilities: { authorize: true, capture: true, refunds: false, webhooks: true },
  createdAt: '2026-10-17T00:00:00.000Z',
  updatedAt: '2026-10-17T00:00:00.000Z',
};

const payment: NativePaymentAttempt = {
  contractVersion: 'native-payment-attempt.v1',
  paymentId: '55555555-5555-4555-8555-555555555555',
  organizationId: account.organizationId,
  businessId: account.businessId,
  storeId: account.storeId,
  checkoutId: '66666666-6666-4666-8666-666666666666',
  checkoutRevision: 2,
  merchantPaymentAccountId: account.paymentAccountId,
  amountMinor: 2400,
  currency: 'USD',
  operationId: 'native:payment-operation-1',
  idempotencyKeyHash: 'a'.repeat(64),
  providerPaymentReference: null,
  providerSessionReference: null,
  status: 'created',
  createdAt: '2026-10-17T00:00:00.000Z',
  updatedAt: '2026-10-17T00:00:00.000Z',
  unknownAt: null,
  lastVerifiedAt: null,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function signed(body: string, secret = 'whsec_fixture', timestamp = 1_792_200_000): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

describe('Stripe BYOP provider boundary', () => {
  it('validates the merchant account and creates a server-authoritative hosted session', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ id: 'acct_fixture', charges_enabled: true, payouts_enabled: true }))
      .mockResolvedValueOnce(response({ id: 'cs_test_fixture', url: 'https://checkout.stripe.com/c/pay/cs_test_fixture', expires_at: 1_792_200_600 }));
    const adapter = createStripeAdapter({ account, credentialReader: vi.fn().mockResolvedValue('rk_test_fixture'), fetcher });
    const session = await adapter.createHostedSession({ payment, captureMode: 'authorize_and_capture', returnReference: 'https://store.example/checkout/return' });
    expect(session.providerSessionReference).toBe('cs_test_fixture');
    expect(session.url).toContain('checkout.stripe.com');
    const request = fetcher.mock.calls[1][1] as RequestInit;
    expect((request.headers as Record<string, string>)['Idempotency-Key']).toBe(payment.operationId);
    const body = new URLSearchParams(String(request.body));
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('2400');
    expect(body.get('line_items[0][price_data][currency]')).toBe('usd');
    expect(String(request.body)).not.toContain('rk_test_fixture');
  });

  it('fails closed for live/test credential confusion and insufficient provider permissions', async () => {
    const reader = vi.fn().mockResolvedValue('sk_test_unrestricted_fixture');
    const adapter = createStripeAdapter({ account, credentialReader: reader, fetcher: vi.fn() });
    await expect(adapter.validateMerchantAccount()).rejects.toMatchObject({ code: 'invalid_credential' });
    const permissionAdapter = createStripeAdapter({ account, credentialReader: vi.fn().mockResolvedValue('rk_test_fixture'), fetcher: vi.fn().mockResolvedValue(response({}, 403)) });
    await expect(permissionAdapter.validateMerchantAccount()).rejects.toMatchObject({ code: 'insufficient_permission' });
  });

  it('uses independent vault references and purposes for API calls and webhook verification', async () => {
    const reader = vi.fn(async (_account: NativeMerchantPaymentAccount, purpose: string) => purpose === 'stripe_api_key' ? 'rk_test_fixture' : 'whsec_fixture');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ id: 'acct_fixture', charges_enabled: true, payouts_enabled: true }))
      .mockResolvedValueOnce(response({ id: 'cs_test_fixture', url: 'https://checkout.stripe.com/c/pay/cs_test_fixture' }));
    const adapter = createStripeAdapter({ account, credentialReader: reader, fetcher, now: () => 1_792_200_000 });
    await adapter.createHostedSession({ payment, captureMode: 'authorize_and_capture', returnReference: 'https://store.example/checkout/return' });
    const body = JSON.stringify({ id: 'evt_separation', type: 'payment_intent.processing', created: 1_792_200_000, data: { object: { id: 'pi_fixture', amount: 2400, currency: 'usd', metadata: { kablet_payment_id: payment.paymentId, kablet_checkout_id: payment.checkoutId, kablet_organization_id: payment.organizationId, kablet_business_id: payment.businessId, kablet_store_id: payment.storeId, kablet_merchant_payment_account_id: account.paymentAccountId, kablet_merchant_account_reference: account.merchantAccountReference } } } });
    await adapter.verifyWebhook({ rawBody: new TextEncoder().encode(body), signature: signed(body), receivedAt: new Date().toISOString() });
    expect(reader.mock.calls.map(([, purpose]) => purpose)).toEqual(['stripe_api_key', 'stripe_api_key', 'stripe_webhook_signing_secret']);
    const authorization = String((fetcher.mock.calls[0][1] as RequestInit).headers && ((fetcher.mock.calls[0][1] as RequestInit).headers as Record<string, string>).authorization);
    expect(Buffer.from(authorization.replace(/^Basic /, ''), 'base64').toString('utf8')).toBe('rk_test_fixture:');
  });

  it('rejects swapped, missing, cross-mode, and cross-account credential configuration', async () => {
    const swappedApi = createStripeAdapter({ account, credentialReader: vi.fn().mockResolvedValue('whsec_fixture'), fetcher: vi.fn() });
    await expect(swappedApi.validateMerchantAccount()).rejects.toMatchObject({ code: 'invalid_credential' });
    const swappedWebhook = createStripeAdapter({ account, credentialReader: vi.fn().mockResolvedValue('rk_test_fixture'), now: () => 1_792_200_000 });
    const event = JSON.stringify({ id: 'evt_swapped', type: 'payment_intent.processing', data: { object: { id: 'pi_fixture', amount: 2400, currency: 'usd', metadata: { kablet_payment_id: payment.paymentId, kablet_checkout_id: payment.checkoutId, kablet_organization_id: payment.organizationId, kablet_business_id: payment.businessId, kablet_store_id: payment.storeId, kablet_merchant_payment_account_id: account.paymentAccountId, kablet_merchant_account_reference: account.merchantAccountReference } } } });
    await expect(swappedWebhook.verifyWebhook({ rawBody: new TextEncoder().encode(event), signature: signed(event), receivedAt: new Date().toISOString() })).rejects.toMatchObject({ code: 'invalid_credential' });
    expect(() => createStripeAdapter({ account: { ...account, credentialReference: null }, credentialReader: vi.fn() })).toThrow('API credentials');
    const missingWebhook = createStripeAdapter({ account: { ...account, webhookSigningSecretReference: null }, credentialReader: vi.fn() });
    await expect(missingWebhook.verifyWebhook({ rawBody: new Uint8Array(), signature: '', receivedAt: new Date().toISOString() })).rejects.toMatchObject({ code: 'credential_unavailable' });
    expect(() => createStripeAdapter({ account: { ...account, credentialReference: 'stripe:live:store-fixture' }, credentialReader: vi.fn() })).toThrow('mode');
    const mismatch = createStripeAdapter({ account, credentialReader: vi.fn().mockResolvedValue('rk_test_fixture'), fetcher: vi.fn().mockResolvedValue(response({ id: 'acct_other', charges_enabled: true, payouts_enabled: true })) });
    await expect(mismatch.validateMerchantAccount()).rejects.toMatchObject({ code: 'account_mismatch' });
  });

  it('retrieves authoritative PaymentIntent state and rejects mismatched totals', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ id: 'acct_fixture', charges_enabled: true, payouts_enabled: true }))
      .mockResolvedValueOnce(response({ id: 'pi_fixture', amount: 2400, currency: 'usd', status: 'succeeded' }));
    const adapter = createStripeAdapter({ account, credentialReader: vi.fn().mockResolvedValue('rk_test_fixture'), fetcher });
    await expect(adapter.retrieveStatus({ payment, providerPaymentReference: 'pi_fixture' })).resolves.toEqual({ kind: 'captured', providerPaymentReference: 'pi_fixture' });
    const mismatch = createStripeAdapter({ account, credentialReader: vi.fn().mockResolvedValue('rk_test_fixture'), fetcher: vi.fn()
      .mockResolvedValueOnce(response({ id: 'acct_fixture', charges_enabled: true, payouts_enabled: true }))
      .mockResolvedValueOnce(response({ id: 'pi_fixture', amount: 1, currency: 'usd', status: 'succeeded' })) });
    await expect(mismatch.retrieveStatus({ payment, providerPaymentReference: 'pi_fixture' })).rejects.toMatchObject({ code: 'payment_mismatch' });
  });

  it('verifies raw Stripe signatures, maps authenticated PaymentIntent events, and ignores checkout redirects', async () => {
    const body = JSON.stringify({ id: 'evt_fixture', type: 'payment_intent.succeeded', created: 1_792_200_000, data: { object: { id: 'pi_fixture', amount_received: 2400, currency: 'usd', metadata: { kablet_payment_id: payment.paymentId, kablet_checkout_id: payment.checkoutId, kablet_organization_id: payment.organizationId, kablet_business_id: payment.businessId, kablet_store_id: payment.storeId, kablet_merchant_payment_account_id: account.paymentAccountId, kablet_merchant_account_reference: account.merchantAccountReference } } } });
    expect(verifyStripeWebhookSignature(new TextEncoder().encode(body), signed(body), 'whsec_fixture', 1_792_200_000)).toBe(true);
    expect(verifyStripeWebhookSignature(new TextEncoder().encode(body), signed(body, 'wrong'), 'whsec_fixture', 1_792_200_000)).toBe(false);
    const adapter = createStripeAdapter({ account, credentialReader: vi.fn().mockResolvedValue('whsec_fixture'), now: () => 1_792_200_000 });
    await expect(adapter.verifyWebhook({ rawBody: new TextEncoder().encode(body), signature: signed(body), receivedAt: new Date().toISOString() })).resolves.toMatchObject({ evidence: { paymentStatus: 'captured', providerPaymentReference: 'pi_fixture', verificationStatus: 'verified' } });
    const redirect = JSON.stringify({ id: 'evt_redirect', type: 'checkout.session.completed', data: { object: { id: 'cs_test_fixture' } } });
    await expect(adapter.verifyWebhook({ rawBody: new TextEncoder().encode(redirect), signature: signed(redirect), receivedAt: new Date().toISOString() })).resolves.toBeNull();
  });

  it('rejects forged or cross-account evidence and preserves unknown asynchronous outcomes', async () => {
    const event = JSON.stringify({ id: 'evt_processing', type: 'payment_intent.processing', data: { object: { id: 'pi_processing', amount: 2400, currency: 'usd', metadata: { kablet_payment_id: payment.paymentId, kablet_checkout_id: payment.checkoutId, kablet_organization_id: payment.organizationId, kablet_business_id: payment.businessId, kablet_store_id: payment.storeId, kablet_merchant_payment_account_id: account.paymentAccountId, kablet_merchant_account_reference: 'acct_other' } } } });
    const adapter = createStripeAdapter({ account, credentialReader: vi.fn().mockResolvedValue('whsec_fixture'), now: () => 1_792_200_000 });
    await expect(adapter.verifyWebhook({ rawBody: new TextEncoder().encode(event), signature: signed(event), receivedAt: new Date().toISOString() })).rejects.toMatchObject({ code: 'account_mismatch' });
    await expect(adapter.verifyWebhook({ rawBody: new TextEncoder().encode(event), signature: 't=1,v1=forged', receivedAt: new Date().toISOString() })).rejects.toMatchObject({ code: 'signature_invalid' });
  });

  it('binds a retrieved Checkout Session only when its identity and PaymentIntent match', () => {
    const session = { id: 'cs_fixture', client_reference_id: payment.paymentId, amount_total: 2400, currency: 'usd', payment_intent: 'pi_fixture', metadata: { kablet_payment_id: payment.paymentId, kablet_checkout_id: payment.checkoutId, kablet_organization_id: payment.organizationId, kablet_business_id: payment.businessId, kablet_store_id: payment.storeId, kablet_merchant_payment_account_id: account.paymentAccountId, kablet_merchant_account_reference: account.merchantAccountReference } };
    expect(assertStripeHostedSessionBinding({ session, account, payment: { ...payment, providerSessionReference: 'cs_fixture' } })).toBe('pi_fixture');
    expect(() => assertStripeHostedSessionBinding({ session: { ...session, payment_intent: null }, account, payment: { ...payment, providerSessionReference: 'cs_fixture' } })).toThrow();
    expect(() => assertStripeHostedSessionBinding({ session: { ...session, amount_total: 2500 }, account, payment: { ...payment, providerSessionReference: 'cs_fixture' } })).toThrow();
  });
});
