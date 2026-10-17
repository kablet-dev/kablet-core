import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  NativeMerchantPaymentAccount,
  NativePaymentAttempt,
  NativePaymentEvidence,
} from '@kablet/domain';
import type {
  NativePaymentAdapter,
  NativePaymentSessionRequest,
  NativePaymentSessionResult,
  NativePaymentStatusResult,
  NativeVerifiedProviderEvent,
} from '@kablet/domain';

export const STRIPE_PROVIDER_KEY = 'stripe';
export const STRIPE_ADAPTER_VERSION = 'v1';
export const STRIPE_REQUIRED_CREDENTIAL_SCOPES = [
  'checkout_sessions.create',
  'checkout_sessions.read',
  'payment_intents.read',
  'account.read',
  'webhooks.verify',
] as const;
export const STRIPE_API_KEY_PURPOSE = 'stripe_api_key' as const;
export const STRIPE_WEBHOOK_SECRET_PURPOSE = 'stripe_webhook_signing_secret' as const;
export type StripeCredentialPurpose = typeof STRIPE_API_KEY_PURPOSE | typeof STRIPE_WEBHOOK_SECRET_PURPOSE;

export type StripeCredentialMode = 'test' | 'live';

export class StripeProviderError extends Error {
  readonly code:
    | 'credential_unavailable'
    | 'invalid_credential'
    | 'insufficient_permission'
    | 'account_mismatch'
    | 'account_ineligible'
    | 'invalid_request'
    | 'provider_unavailable'
    | 'signature_invalid'
    | 'event_invalid'
    | 'payment_mismatch';
  readonly retryable: boolean;

  constructor(code: StripeProviderError['code'], message: string, retryable = false) {
    super(message);
    this.name = 'StripeProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

type StripeObject = Record<string, unknown>;

type StripeCredentialReader = (
  account: NativeMerchantPaymentAccount,
  purpose: StripeCredentialPurpose,
  requiredScopes: readonly string[],
) => Promise<string>;

type StripeAdapterInput = {
  account: NativeMerchantPaymentAccount;
  credentialReader: StripeCredentialReader;
  fetcher?: typeof fetch;
  now?: () => number;
  webhookToleranceSeconds?: number;
};

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new StripeProviderError('event_invalid', `Stripe response field ${field} is invalid.`);
  return value;
}

function asUuid(value: unknown, field: string): string {
  const result = asString(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new StripeProviderError('event_invalid', `Stripe metadata field ${field} is invalid.`);
  return result;
}

function asAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new StripeProviderError('event_invalid', 'Stripe amount is invalid.');
  return value;
}

function asCurrency(value: unknown): string {
  const currency = asString(value, 'currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new StripeProviderError('event_invalid', 'Stripe currency is invalid.');
  return currency;
}

function apiCredentialMode(reference: string): StripeCredentialMode {
  const match = /^stripe:(test|live):[A-Za-z0-9._:-]{1,260}$/.exec(reference);
  if (!match) throw new StripeProviderError('credential_unavailable', 'Stripe credentials are not configured for this merchant account.');
  return match[1] as StripeCredentialMode;
}

function assertRestrictedKey(secret: string, mode: StripeCredentialMode): void {
  if (!new RegExp(`^rk_${mode}_`).test(secret)) throw new StripeProviderError('invalid_credential', 'The configured Stripe credential must be a restricted key for the configured mode.');
}

function metadataFor(payment: NativePaymentAttempt, account: NativeMerchantPaymentAccount): Record<string, string> {
  return {
    kablet_payment_id: payment.paymentId,
    kablet_checkout_id: payment.checkoutId,
    kablet_organization_id: payment.organizationId,
    kablet_business_id: payment.businessId,
    kablet_store_id: payment.storeId,
    kablet_merchant_payment_account_id: payment.merchantPaymentAccountId,
    kablet_merchant_account_reference: account.merchantAccountReference,
  };
}

function addMetadata(body: URLSearchParams, prefix: string, metadata: Record<string, string>): void {
  for (const [key, value] of Object.entries(metadata)) body.set(`${prefix}[${key}]`, value);
}

function mapPaymentStatus(status: string, paymentReference: string | null): NativePaymentStatusResult {
  if (status === 'succeeded') {
    if (!paymentReference) throw new StripeProviderError('payment_mismatch', 'Stripe did not return a payment reference.');
    return { kind: 'captured', providerPaymentReference: paymentReference };
  }
  if (status === 'requires_capture') {
    if (!paymentReference) throw new StripeProviderError('payment_mismatch', 'Stripe did not return a payment reference.');
    return { kind: 'authorized', providerPaymentReference: paymentReference };
  }
  if (status === 'canceled') return { kind: 'cancelled', providerPaymentReference: paymentReference };
  if (status === 'requires_payment_method') return { kind: 'failed', providerPaymentReference: paymentReference, reasonCode: 'requires_payment_method' };
  return { kind: 'unknown', providerPaymentReference: paymentReference, reasonCode: status || 'unknown' };
}

function eventMetadata(object: StripeObject): Record<string, unknown> {
  return object.metadata && typeof object.metadata === 'object' && !Array.isArray(object.metadata) ? object.metadata as Record<string, unknown> : {};
}

function buildEvidence(event: StripeObject, object: StripeObject, account: NativeMerchantPaymentAccount, paymentStatus: NativePaymentEvidence['paymentStatus'], observedAt: string): NativeVerifiedProviderEvent {
  const metadata = eventMetadata(object);
  const paymentId = asUuid(metadata.kablet_payment_id, 'kablet_payment_id');
  const checkoutId = asUuid(metadata.kablet_checkout_id, 'kablet_checkout_id');
  const organizationId = asUuid(metadata.kablet_organization_id, 'kablet_organization_id');
  const businessId = asUuid(metadata.kablet_business_id, 'kablet_business_id');
  const storeId = asUuid(metadata.kablet_store_id, 'kablet_store_id');
  const accountId = asUuid(metadata.kablet_merchant_payment_account_id, 'kablet_merchant_payment_account_id');
  if (accountId !== account.paymentAccountId || metadata.kablet_merchant_account_reference !== account.merchantAccountReference) throw new StripeProviderError('account_mismatch', 'Stripe event merchant account does not match the configured account.');
  const providerReference = asString(object.id, 'id');
  const amount = asAmount(object.amount_received ?? object.amount ?? object.amount_refunded);
  const currency = asCurrency(object.currency);
  const evidence: NativePaymentEvidence = {
    contractVersion: 'native-payment-evidence.v1',
    evidenceId: randomUUID(),
    organizationId,
    businessId,
    storeId,
    paymentId,
    merchantPaymentAccountId: accountId,
    providerEventReference: asString(event.id, 'event.id'),
    providerObjectReference: providerReference,
    providerPaymentReference: providerReference,
    amountMinor: amount,
    currency,
    paymentStatus,
    authenticationMethod: 'signed_webhook',
    verificationStatus: 'verified',
    provenance: 'stripe.signed_webhook',
    observedAt,
    authenticatedAt: observedAt,
    verifiedAt: observedAt,
  };
  return { evidence, authenticatedProviderEventReference: evidence.providerEventReference, eventType: asString(event.type, 'type'), checkoutId };
}

export function verifyStripeWebhookSignature(rawBody: Uint8Array, signature: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): boolean {
  if (!signature || !secret) return false;
  const parts = signature.split(',').map(part => part.split('='));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts.filter(([key, value]) => key === 'v1' && value).map(([, value]) => value);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds || signatures.length === 0) return false;
  const expected = createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), Buffer.from(rawBody)])).digest('hex');
  return signatures.some(value => safeEqual(expected, value));
}

export function createStripeAdapter(input: StripeAdapterInput): NativePaymentAdapter & {
  validateMerchantAccount(): Promise<{ id: string; chargesEnabled: boolean; payoutsEnabled: boolean }>;
  retrieveHostedSession(sessionReference: string): Promise<StripeObject>;
} {
  const fetcher = input.fetcher ?? fetch;
  const now = input.now ?? (() => Math.floor(Date.now() / 1000));
  const tolerance = input.webhookToleranceSeconds ?? 300;
  const account = input.account;
  if (account.providerKey !== STRIPE_PROVIDER_KEY || account.adapterVersion !== STRIPE_ADAPTER_VERSION) throw new StripeProviderError('account_ineligible', 'The merchant payment account is not configured for this Stripe adapter.');
  if (!account.credentialMode) throw new StripeProviderError('credential_unavailable', 'Stripe credential mode is not configured for this merchant account.');
  const mode = account.credentialMode;
  if (!account.credentialReference) throw new StripeProviderError('credential_unavailable', 'Stripe API credentials are not configured for this merchant account.');
  if (apiCredentialMode(account.credentialReference) !== mode) throw new StripeProviderError('credential_unavailable', 'Stripe API credential mode does not match the merchant account.');
  let accountValidation: Promise<{ id: string; chargesEnabled: boolean; payoutsEnabled: boolean }> | undefined;

  async function validateAccount(): Promise<{ id: string; chargesEnabled: boolean; payoutsEnabled: boolean }> {
    if (account.status !== 'active' || !account.capabilities.authorize || !account.capabilities.webhooks) throw new StripeProviderError('account_ineligible', 'The merchant Stripe account is not enabled for payment execution.');
    const body = await request('/v1/account');
    const id = asString(body.id, 'id');
    if (id !== account.merchantAccountReference) throw new StripeProviderError('account_mismatch', 'The Stripe account does not match the merchant payment account.');
    const chargesEnabled = body.charges_enabled === true;
    const payoutsEnabled = body.payouts_enabled === true;
    if (!chargesEnabled) throw new StripeProviderError('account_ineligible', 'The Stripe account cannot accept charges.');
    return { id, chargesEnabled, payoutsEnabled };
  }

  const ensureAccount = async (): Promise<{ id: string; chargesEnabled: boolean; payoutsEnabled: boolean }> => {
    accountValidation ??= validateAccount();
    return accountValidation;
  };

  async function request(path: string, init: RequestInit = {}): Promise<StripeObject> {
    const secret = await input.credentialReader(account, STRIPE_API_KEY_PURPOSE, STRIPE_REQUIRED_CREDENTIAL_SCOPES);
    assertRestrictedKey(secret, mode);
    let response: Response;
    try {
      response = await fetcher(`https://api.stripe.com${path}`, {
        ...init,
        headers: {
          authorization: `Basic ${Buffer.from(`${secret}:`, 'utf8').toString('base64')}`,
          accept: 'application/json',
          ...(init.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw new StripeProviderError('provider_unavailable', 'Stripe could not be reached.', true);
    }
    const body = await response.json().catch(() => ({})) as StripeObject;
    if (!response.ok) {
      if (response.status === 401) throw new StripeProviderError('invalid_credential', 'Stripe rejected the configured credential.');
      if (response.status === 403) throw new StripeProviderError('insufficient_permission', 'The Stripe credential lacks a required permission.');
      if (response.status === 429 || response.status >= 500) throw new StripeProviderError('provider_unavailable', 'Stripe is temporarily unavailable.', true);
      throw new StripeProviderError('invalid_request', 'Stripe rejected the payment request.');
    }
    return body;
  }

  return {
    providerKey: STRIPE_PROVIDER_KEY,
    adapterVersion: STRIPE_ADAPTER_VERSION,
    capabilities: {
      currencies: account.supportedCurrencies,
      captureModes: [
        ...(account.capabilities.authorize ? ['authorize_only' as const] : []),
        ...(account.capabilities.capture ? ['authorize_and_capture' as const] : []),
      ],
      supportsHostedSession: true,
      supportsStatusRetrieval: true,
      supportsSignedWebhooks: account.capabilities.webhooks,
    },
    async validateMerchantAccount() {
      return validateAccount();
    },
    async createHostedSession(requestInput: NativePaymentSessionRequest): Promise<NativePaymentSessionResult> {
      await ensureAccount();
      const payment = requestInput.payment;
      if (payment.merchantPaymentAccountId !== account.paymentAccountId) throw new StripeProviderError('account_mismatch', 'The payment attempt is bound to another merchant account.');
      if (requestInput.captureMode === 'authorize_only' && !account.capabilities.authorize) throw new StripeProviderError('account_ineligible', 'The merchant Stripe account is not enabled for authorization-only payments.');
      if (requestInput.captureMode === 'authorize_and_capture' && !account.capabilities.capture) throw new StripeProviderError('account_ineligible', 'The merchant Stripe account is not enabled for capture.');
      if (payment.amountMinor < 0 || !Number.isSafeInteger(payment.amountMinor) || !account.supportedCurrencies.includes(payment.currency)) throw new StripeProviderError('invalid_request', 'The checkout total is not eligible for this Stripe account.');
      if (!requestInput.returnReference.startsWith('https://')) throw new StripeProviderError('invalid_request', 'Stripe return URLs must use HTTPS.');
      const metadata = metadataFor(payment, account);
      const body = new URLSearchParams();
      body.set('mode', 'payment');
      body.set('line_items[0][price_data][currency]', payment.currency.toLowerCase());
      body.set('line_items[0][price_data][product_data][name]', 'Kablet checkout item');
      body.set('line_items[0][price_data][unit_amount]', String(payment.amountMinor));
      body.set('line_items[0][quantity]', '1');
      body.set('success_url', requestInput.returnReference);
      body.set('cancel_url', requestInput.returnReference);
      body.set('client_reference_id', payment.paymentId);
      body.set('payment_intent_data[capture_method]', requestInput.captureMode === 'authorize_only' ? 'manual' : 'automatic');
      addMetadata(body, 'metadata', metadata);
      addMetadata(body, 'payment_intent_data[metadata]', metadata);
      const response = await request('/v1/checkout/sessions', { method: 'POST', body: body.toString(), headers: { 'Idempotency-Key': payment.operationId } });
      const sessionReference = asString(response.id, 'id');
      const url = asString(response.url, 'url');
      return { providerSessionReference: sessionReference, customerActionRequired: true, expiresAt: typeof response.expires_at === 'number' ? new Date(response.expires_at * 1000).toISOString() : null, url };
    },
    async retrieveHostedSession(sessionReference: string): Promise<StripeObject> {
      await ensureAccount();
      if (!/^cs_[A-Za-z0-9_]+$/.test(sessionReference)) throw new StripeProviderError('invalid_request', 'The Stripe Checkout Session reference is invalid.');
      return request(`/v1/checkout/sessions/${encodeURIComponent(sessionReference)}`);
    },
    async retrieveStatus(statusInput: { payment: NativePaymentAttempt; providerPaymentReference: string }): Promise<NativePaymentStatusResult> {
      await ensureAccount();
      if (statusInput.payment.merchantPaymentAccountId !== account.paymentAccountId) throw new StripeProviderError('account_mismatch', 'The payment attempt is bound to another merchant account.');
      if (!/^pi_[A-Za-z0-9_]+$/.test(statusInput.providerPaymentReference)) throw new StripeProviderError('invalid_request', 'The Stripe PaymentIntent reference is invalid.');
      const body = await request(`/v1/payment_intents/${encodeURIComponent(statusInput.providerPaymentReference)}`);
      if (body.id !== statusInput.providerPaymentReference || asAmount(body.amount) !== statusInput.payment.amountMinor || asCurrency(body.currency) !== statusInput.payment.currency) throw new StripeProviderError('payment_mismatch', 'Stripe payment details do not match the authoritative checkout.');
      return mapPaymentStatus(asString(body.status, 'status'), statusInput.providerPaymentReference);
    },
    async verifyWebhook(webhookInput: { rawBody: Uint8Array; signature: string; receivedAt: string }): Promise<NativeVerifiedProviderEvent | null> {
      if (account.status !== 'active' || !account.capabilities.webhooks) throw new StripeProviderError('account_ineligible', 'The merchant Stripe account is not enabled for webhook verification.');
      if (!account.webhookSigningSecretReference) throw new StripeProviderError('credential_unavailable', 'Stripe webhook signing secret is not configured for this merchant account.');
      const secret = await input.credentialReader(account, STRIPE_WEBHOOK_SECRET_PURPOSE, ['webhooks.verify']);
      if (!/^whsec_[A-Za-z0-9]+$/.test(secret)) throw new StripeProviderError('invalid_credential', 'The configured Stripe webhook credential is invalid.');
      if (!verifyStripeWebhookSignature(webhookInput.rawBody, webhookInput.signature, secret, now(), tolerance)) throw new StripeProviderError('signature_invalid', 'The Stripe webhook signature is invalid.');
      let event: StripeObject;
      try { event = JSON.parse(Buffer.from(webhookInput.rawBody).toString('utf8')) as StripeObject; } catch { throw new StripeProviderError('event_invalid', 'The Stripe webhook payload is invalid.'); }
      const eventType = asString(event.type, 'type');
      const object = event.data && typeof event.data === 'object' && !Array.isArray(event.data) && (event.data as StripeObject).object && typeof (event.data as StripeObject).object === 'object' ? (event.data as StripeObject).object as StripeObject : null;
      if (!object || !event.id) throw new StripeProviderError('event_invalid', 'The Stripe webhook event is invalid.');
      const created = typeof event.created === 'number' ? new Date(event.created * 1000).toISOString() : new Date().toISOString();
      if (eventType === 'checkout.session.completed') return null;
      const status = eventType === 'payment_intent.succeeded' ? 'captured' : eventType === 'payment_intent.payment_failed' ? 'failed' : eventType === 'payment_intent.canceled' ? 'cancelled' : eventType === 'payment_intent.processing' ? 'unknown' : eventType === 'charge.refunded' ? 'refunded' : null;
      if (!status) return null;
      return buildEvidence(event, object, account, status, created);
    },
  };
}

export function createStripeCredentialReader(input: { readSecret: (credentialReference: string, purpose: StripeCredentialPurpose, requiredScopes: readonly string[]) => Promise<string> }): StripeCredentialReader {
  return async (account, purpose, requiredScopes) => {
    const credentialReference = purpose === STRIPE_API_KEY_PURPOSE ? account.credentialReference : account.webhookSigningSecretReference;
    if (!credentialReference) throw new StripeProviderError('credential_unavailable', `Stripe ${purpose === STRIPE_API_KEY_PURPOSE ? 'API' : 'webhook'} credential is not configured for this merchant account.`);
    return input.readSecret(credentialReference, purpose, requiredScopes);
  };
}

export function assertStripeHostedSessionBinding(input: { session: StripeObject; account: NativeMerchantPaymentAccount; payment: Pick<NativePaymentAttempt, 'paymentId' | 'organizationId' | 'businessId' | 'storeId' | 'checkoutId' | 'merchantPaymentAccountId' | 'amountMinor' | 'currency' | 'providerSessionReference'> }): string {
  if (input.session.id !== input.payment.providerSessionReference) throw new StripeProviderError('payment_mismatch', 'The Stripe Checkout Session does not match the payment attempt.');
  if (input.session.client_reference_id !== input.payment.paymentId) throw new StripeProviderError('payment_mismatch', 'The Stripe Checkout Session is not bound to the payment attempt.');
  const metadata = eventMetadata(input.session);
  if (metadata.kablet_payment_id !== input.payment.paymentId || metadata.kablet_checkout_id !== input.payment.checkoutId || metadata.kablet_organization_id !== input.payment.organizationId || metadata.kablet_business_id !== input.payment.businessId || metadata.kablet_store_id !== input.payment.storeId || metadata.kablet_merchant_payment_account_id !== input.payment.merchantPaymentAccountId || metadata.kablet_merchant_account_reference !== input.account.merchantAccountReference) throw new StripeProviderError('payment_mismatch', 'The Stripe Checkout Session metadata does not match the payment attempt.');
  if (asAmount(input.session.amount_total) !== input.payment.amountMinor || asCurrency(input.session.currency) !== input.payment.currency) throw new StripeProviderError('payment_mismatch', 'The Stripe Checkout Session total does not match the payment attempt.');
  const paymentIntent = input.session.payment_intent;
  if (paymentIntent == null) throw new StripeProviderError('provider_unavailable', 'Stripe has not assigned a PaymentIntent to the Checkout Session yet.', true);
  if (typeof paymentIntent !== 'string' || !/^pi_[A-Za-z0-9_]+$/.test(paymentIntent)) throw new StripeProviderError('payment_mismatch', 'The Stripe Checkout Session PaymentIntent reference is invalid.');
  return paymentIntent;
}
