import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createStripeAdapter, createStripeCredentialReader, type StripeCredentialPurpose } from './stripe-provider';
import type { NativeMerchantPaymentAccount } from '@kablet/domain';
import type { NativeStripePaymentContext, NativeStripeVerifiedEvidenceInput } from '@kablet/db';

export const stripeWebhookMaxBodyBytes = 256 * 1024;

export type StripeWebhookDependencies = {
  resolveAccount: (storeSlug: string) => Promise<NativeMerchantPaymentAccount | null>;
  resolvePayment: (input: { organizationId: string; businessId: string; storeId: string; paymentId: string }) => Promise<NativeStripePaymentContext | null>;
  bindFromStoredSession?: (payment: NativeStripePaymentContext) => Promise<NativeStripePaymentContext>;
  readSecret: (reference: string, purpose: StripeCredentialPurpose, scopes: readonly string[]) => Promise<string>;
  ingest: (input: NativeStripeVerifiedEvidenceInput) => Promise<{ inserted: boolean; evidenceId: string | null }>;
  now?: () => number;
};

function response(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

class StripeWebhookBodyTooLargeError extends Error {}
class StripeWebhookBodyReadError extends Error {}

async function rawBody(request: Request): Promise<Uint8Array> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > stripeWebhookMaxBodyBytes)) throw new StripeWebhookBodyTooLargeError();
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = next.value;
      if (!chunk) continue;
      total += chunk.byteLength;
      if (total > stripeWebhookMaxBodyBytes) {
        await reader.cancel('stripe webhook body exceeds limit').catch(() => undefined);
        throw new StripeWebhookBodyTooLargeError();
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof StripeWebhookBodyTooLargeError) throw error;
    throw new StripeWebhookBodyReadError();
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function processStripeWebhook(request: Request, storeSlug: string, dependencies: StripeWebhookDependencies): Promise<NextResponse> {
  if (request.method !== 'POST') return response({ code: 'method_not_allowed' }, 405);
  if ((request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase() !== 'application/json') return response({ code: 'invalid_request' }, 415);
  let body: Uint8Array;
  try { body = await rawBody(request); } catch (error) {
    return error instanceof StripeWebhookBodyTooLargeError ? response({ code: 'request_too_large' }, 413) : response({ code: 'invalid_request' }, 400);
  }
  const account = await dependencies.resolveAccount(storeSlug).catch(() => null);
  if (!account) return response({ code: 'webhook_unavailable' }, 503);
  try {
    const adapter = createStripeAdapter({ account, credentialReader: createStripeCredentialReader({ readSecret: dependencies.readSecret }), now: dependencies.now });
    const event = await adapter.verifyWebhook({ rawBody: body, signature: request.headers.get('stripe-signature') ?? '', receivedAt: new Date().toISOString() });
    if (!event) {
      const parsed = JSON.parse(Buffer.from(body).toString('utf8')) as { type?: unknown };
      return parsed.type === 'checkout.session.completed' ? response({ accepted: true, ignored: true }, 202) : response({ code: 'unsupported_event' }, 400);
    }
    let payment: NativeStripePaymentContext | null;
    try {
      payment = await dependencies.resolvePayment({ organizationId: event.evidence.organizationId, businessId: event.evidence.businessId, storeId: event.evidence.storeId, paymentId: event.evidence.paymentId });
    } catch {
      return response({ code: 'webhook_unavailable' }, 503);
    }
    if (!payment) return response({ code: 'payment_mismatch' }, 409);
    if (!payment.providerPaymentReference) {
      if (!payment.providerSessionReference || !dependencies.bindFromStoredSession) return response({ code: 'payment_unbound' }, 409);
      try {
        payment = await dependencies.bindFromStoredSession(payment);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'payment_mismatch') return response({ code: 'payment_mismatch' }, 409);
        if (code === 'provider_unavailable') return response({ code: 'webhook_unavailable' }, 503);
        return response({ code: 'webhook_unavailable' }, 503);
      }
    }
    if (!payment.providerPaymentReference || payment.providerPaymentReference !== event.evidence.providerPaymentReference || payment.organizationId !== account.organizationId || payment.businessId !== account.businessId || payment.storeId !== account.storeId || payment.merchantPaymentAccountId !== account.paymentAccountId || payment.checkoutId !== event.checkoutId || payment.amountMinor !== event.evidence.amountMinor || payment.currency !== event.evidence.currency) return response({ code: 'payment_mismatch' }, 409);
    const payloadDigest = createHash('sha256').update(body).digest();
    let result: Awaited<ReturnType<StripeWebhookDependencies['ingest']>>;
    try {
      result = await dependencies.ingest({ evidenceId: event.evidence.evidenceId, organizationId: event.evidence.organizationId, businessId: event.evidence.businessId, storeId: event.evidence.storeId, merchantPaymentAccountId: event.evidence.merchantPaymentAccountId, providerEventId: event.evidence.providerEventReference, eventType: event.eventType, providerObjectReference: event.evidence.providerObjectReference, payloadDigest, paymentId: event.evidence.paymentId, providerPaymentReference: event.evidence.providerPaymentReference, amountMinor: event.evidence.amountMinor, currency: event.evidence.currency, paymentStatus: event.evidence.paymentStatus, observedAt: new Date(event.evidence.observedAt) });
    } catch {
      return response({ code: 'webhook_unavailable' }, 503);
    }
    return response({ accepted: true, duplicate: !result.inserted }, 202);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'signature_invalid' || code === 'invalid_credential' || code === 'event_invalid') return response({ code: code === 'signature_invalid' ? 'signature_invalid' : 'invalid_webhook' }, 400);
    if (code === 'account_ineligible' || code === 'credential_unavailable' || code === 'provider_unavailable') return response({ code: 'webhook_unavailable' }, 503);
    return response({ code: 'webhook_rejected' }, 409);
  }
}
