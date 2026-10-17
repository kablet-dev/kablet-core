import { describe, expect, it } from 'vitest';
import {
  nativeMerchantPaymentAccountSchema,
  nativePaymentAttemptSchema,
  nativePaymentEvidenceSchema,
  nativePaymentReconciliationSchema,
  nativePaymentWebhookSchema,
  assertNativePaymentCapability,
} from '@kablet/domain';

const ids = { org: '00000000-0000-4000-8000-000000000001', biz: '00000000-0000-4000-8000-000000000002', store: '00000000-0000-4000-8000-000000000003', account: '00000000-0000-4000-8000-000000000004', checkout: '00000000-0000-4000-8000-000000000005', payment: '00000000-0000-4000-8000-000000000006' };
const now = '2026-10-17T00:00:00.000Z';
const hash = 'a'.repeat(64);

describe('native payment contracts', () => {
  it('accepts strictly validated merchant account, attempt, webhook, evidence, and reconciliation records', () => {
    expect(nativeMerchantPaymentAccountSchema.parse({ contractVersion: 'native-merchant-payment-account.v1', paymentAccountId: ids.account, organizationId: ids.org, businessId: ids.biz, storeId: ids.store, providerKey: 'example', adapterVersion: 'v1', merchantAccountReference: 'acct_opaque', credentialMode: 'test', credentialReference: 'vault-ref', webhookSigningSecretReference: 'webhook-vault-ref', supportedCountries: ['US'], supportedCurrencies: ['USD'], status: 'active', capabilities: { authorize: true, capture: true, refunds: false, webhooks: true }, createdAt: now, updatedAt: now })).toBeTruthy();
    expect(nativePaymentAttemptSchema.parse({ contractVersion: 'native-payment-attempt.v1', paymentId: ids.payment, organizationId: ids.org, businessId: ids.biz, storeId: ids.store, checkoutId: ids.checkout, checkoutRevision: 1, merchantPaymentAccountId: ids.account, amountMinor: 2400, currency: 'USD', operationId: 'op-1', idempotencyKeyHash: hash, providerPaymentReference: null, providerSessionReference: null, status: 'unknown', createdAt: now, updatedAt: now, unknownAt: now, lastVerifiedAt: null })).toBeTruthy();
    expect(nativePaymentWebhookSchema.parse({ contractVersion: 'native-payment-webhook.v1', webhookId: ids.payment, organizationId: ids.org, businessId: ids.biz, storeId: ids.store, merchantPaymentAccountId: ids.account, providerEventId: 'evt-1', eventType: 'payment.updated', providerObjectReference: null, payloadDigest: hash, signatureStatus: 'unverified', processingStatus: 'received', attemptCount: 0, leaseExpiresAt: null, nextAttemptAt: null, lastErrorCode: null, occurredAt: null, createdAt: now, processedAt: null })).toBeTruthy();
    expect(nativePaymentEvidenceSchema.parse({ contractVersion: 'native-payment-evidence.v1', evidenceId: ids.payment, organizationId: ids.org, businessId: ids.biz, storeId: ids.store, paymentId: ids.payment, merchantPaymentAccountId: ids.account, providerEventReference: 'evt-1', providerObjectReference: 'obj-1', providerPaymentReference: 'pay-1', amountMinor: 2400, currency: 'USD', paymentStatus: 'unknown', authenticationMethod: 'signed_webhook', verificationStatus: 'pending', provenance: 'provider-event', observedAt: now, authenticatedAt: null, verifiedAt: null })).toBeTruthy();
    expect(nativePaymentReconciliationSchema.parse({ contractVersion: 'native-payment-reconciliation.v1', reconciliationId: ids.payment, organizationId: ids.org, businessId: ids.biz, storeId: ids.store, paymentId: ids.payment, merchantPaymentAccountId: ids.account, reconciliationKeyHash: hash, reason: 'unknown_payment', status: 'pending', resolutionEvidenceId: null, authorizedResolutionReference: null, createdAt: now, updatedAt: now, resolvedAt: null })).toBeTruthy();
    expect(nativePaymentReconciliationSchema.parse({ contractVersion: 'native-payment-reconciliation.v1', reconciliationId: ids.payment, organizationId: ids.org, businessId: ids.biz, storeId: ids.store, paymentId: ids.payment, merchantPaymentAccountId: ids.account, reconciliationKeyHash: hash, reason: 'unknown_payment', status: 'resolved_paid', resolutionEvidenceId: ids.payment, authorizedResolutionReference: 'authorized-resolution', createdAt: now, updatedAt: now, resolvedAt: now })).toBeTruthy();
  });

  it('rejects raw idempotency keys, unverified paid evidence, and unknown fields', () => {
    expect(() => nativePaymentAttemptSchema.parse({ paymentId: ids.payment, contractVersion: 'native-payment-attempt.v1', organizationId: ids.org, businessId: ids.biz, storeId: ids.store, checkoutId: ids.checkout, checkoutRevision: 1, merchantPaymentAccountId: ids.account, amountMinor: 1, currency: 'USD', operationId: 'op', idempotencyKey: 'raw-secret', idempotencyKeyHash: hash, providerPaymentReference: null, providerSessionReference: null, status: 'created', createdAt: now, updatedAt: now, unknownAt: null, lastVerifiedAt: null })).toThrow();
    expect(() => nativePaymentEvidenceSchema.parse({ contractVersion: 'native-payment-evidence.v1', evidenceId: ids.payment, organizationId: ids.org, businessId: ids.biz, storeId: ids.store, paymentId: ids.payment, merchantPaymentAccountId: ids.account, providerEventReference: 'evt', providerObjectReference: 'obj', providerPaymentReference: 'pay', amountMinor: 1, currency: 'USD', paymentStatus: 'captured', authenticationMethod: 'signed_webhook', verificationStatus: 'verified', provenance: 'redirect', observedAt: now, authenticatedAt: null, verifiedAt: null })).toThrow();
    expect(() => nativePaymentReconciliationSchema.parse({ contractVersion: 'native-payment-reconciliation.v1', reconciliationId: ids.payment, organizationId: ids.org, businessId: ids.biz, storeId: ids.store, paymentId: ids.payment, merchantPaymentAccountId: ids.account, reconciliationKeyHash: hash, reason: 'unknown_payment', status: 'resolved_not_paid', resolutionEvidenceId: null, authorizedResolutionReference: null, createdAt: now, updatedAt: now, resolvedAt: null })).toThrow();
  });

  it('fails closed when merchant account capability or currency is incompatible', () => {
    expect(() => assertNativePaymentCapability({ accountStatus: 'suspended', supportedCurrencies: ['USD'], captureModes: ['authorize_only'], currency: 'USD', captureMode: 'authorize_only' })).toThrow();
    expect(() => assertNativePaymentCapability({ accountStatus: 'active', supportedCurrencies: ['EUR'], captureModes: ['authorize_only'], currency: 'USD', captureMode: 'authorize_only' })).toThrow();
    expect(() => assertNativePaymentCapability({ accountStatus: 'active', supportedCurrencies: ['USD'], captureModes: ['authorize_only'], currency: 'USD', captureMode: 'authorize_and_capture' })).toThrow();
  });
});
