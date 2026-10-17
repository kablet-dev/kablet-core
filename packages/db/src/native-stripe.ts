import { sql } from 'drizzle-orm';
import type { Database } from './index.js';
import { nativeMerchantPaymentAccountSchema, type NativeMerchantPaymentAccount } from '@kablet/domain';

export type NativeStripePaymentContext = {
  paymentId: string;
  organizationId: string;
  businessId: string;
  storeId: string;
  checkoutId: string;
  merchantPaymentAccountId: string;
  amountMinor: number;
  currency: string;
  providerPaymentReference: string | null;
  providerSessionReference: string | null;
};

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function mapAccount(row: Record<string, unknown>): NativeMerchantPaymentAccount {
  return nativeMerchantPaymentAccountSchema.parse({
    contractVersion: 'native-merchant-payment-account.v1',
    paymentAccountId: row.id,
    organizationId: row.organization_id,
    businessId: row.business_id,
    storeId: row.store_id,
    providerKey: row.provider_key,
    adapterVersion: row.adapter_version,
    merchantAccountReference: row.merchant_account_reference,
    credentialMode: row.credential_mode,
    credentialReference: row.credential_reference,
    webhookSigningSecretReference: row.webhook_signing_secret_reference,
    supportedCountries: row.supported_countries,
    supportedCurrencies: row.supported_currencies,
    status: row.status,
    capabilities: { authorize: row.can_authorize === true, capture: row.can_capture === true, refunds: row.can_refund === true, webhooks: row.can_receive_webhooks === true },
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

export type NativeStripeVerifiedEvidenceInput = {
  evidenceId: string;
  organizationId: string;
  businessId: string;
  storeId: string;
  merchantPaymentAccountId: string;
  providerEventId: string;
  eventType: string;
  providerObjectReference: string;
  payloadDigest: Buffer;
  paymentId: string;
  providerPaymentReference: string;
  amountMinor: number;
  currency: string;
  paymentStatus: 'authorized' | 'captured' | 'failed' | 'cancelled' | 'refunded' | 'unknown';
  observedAt: Date;
};

/**
 * This repository must run on the restricted control connection. The database
 * function rejects all other session users and persists only verified event
 * metadata plus an immutable evidence record.
 */
export function createNativeStripeIngestionRepository(db: Database['db']) {
  return {
    async ingestVerifiedEvidence(input: NativeStripeVerifiedEvidenceInput) {
      const result = await db.execute(sql`
        select * from kablet_ingest_verified_native_payment_evidence(
          ${input.evidenceId}::uuid, ${input.organizationId}::uuid, ${input.businessId}::uuid,
          ${input.storeId}::uuid, ${input.merchantPaymentAccountId}::uuid,
          ${input.providerEventId}, ${input.eventType}, ${input.providerObjectReference},
          ${input.payloadDigest}, ${input.paymentId}::uuid, ${input.providerPaymentReference},
          ${input.amountMinor}, ${input.currency}, ${input.paymentStatus}, ${input.observedAt}
        )
      `);
      const row = result.rows[0] as { inserted?: boolean; evidence_id?: string | null } | undefined;
      if (!row) throw new Error('Stripe evidence ingestion returned no result');
      return { inserted: row.inserted === true, evidenceId: row.evidence_id ?? null };
    },
  };
}

/** Runtime reads are tenant-scoped; only the control repository may ingest evidence. */
export function createNativeStripeWebhookRepository(db: Database['db']) {
  return {
    async resolveAccount(publicSlug: string): Promise<NativeMerchantPaymentAccount | null> {
      return db.transaction(async tx => {
        const stores = await tx.execute(sql`select id, organization_id, business_id from kablet_native_stores where public_slug=${publicSlug} and status='published' limit 1`);
        const store = stores.rows[0] as Record<string, unknown> | undefined;
        if (!store) return null;
        await tx.execute(sql`select set_config('kablet.organization_id', ${String(store.organization_id)}, true), set_config('kablet.business_id', ${String(store.business_id)}, true)`);
        const accounts = await tx.execute(sql`select id, organization_id, business_id, store_id, provider_key, adapter_version, merchant_account_reference, credential_mode, credential_reference, webhook_signing_secret_reference, supported_countries, supported_currencies, status, can_authorize, can_capture, can_refund, can_receive_webhooks, created_at, updated_at from kablet_native_payment_accounts where organization_id=${String(store.organization_id)}::uuid and business_id=${String(store.business_id)}::uuid and store_id=${String(store.id)}::uuid and provider_key='stripe' and status='active' and can_receive_webhooks=true`);
        if (accounts.rows.length !== 1) return null;
        return mapAccount(accounts.rows[0] as Record<string, unknown>);
      });
    },
    async resolvePayment(input: { organizationId: string; businessId: string; storeId: string; paymentId: string }): Promise<NativeStripePaymentContext | null> {
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
        const result = await tx.execute(sql`select id, organization_id, business_id, store_id, checkout_id, merchant_payment_account_id, amount_minor, currency, provider_payment_reference, provider_session_reference from kablet_native_payment_attempts where id=${input.paymentId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and store_id=${input.storeId}::uuid`);
        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        return { paymentId: String(row.id), organizationId: String(row.organization_id), businessId: String(row.business_id), storeId: String(row.store_id), checkoutId: String(row.checkout_id), merchantPaymentAccountId: String(row.merchant_payment_account_id), amountMinor: Number(row.amount_minor), currency: String(row.currency), providerPaymentReference: row.provider_payment_reference == null ? null : String(row.provider_payment_reference), providerSessionReference: row.provider_session_reference == null ? null : String(row.provider_session_reference) };
      });
    },
    async bindPaymentReference(input: { paymentId: string; organizationId: string; businessId: string; storeId: string; merchantPaymentAccountId: string; providerSessionReference: string; providerPaymentReference: string }): Promise<NativeStripePaymentContext | null> {
      if (!/^pi_[A-Za-z0-9_]+$/.test(input.providerPaymentReference)) throw new Error('payment reference is invalid');
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
        let result;
        try {
          result = await tx.execute(sql`select * from kablet_bind_native_payment_reference(${input.paymentId}::uuid, ${input.organizationId}::uuid, ${input.businessId}::uuid, ${input.storeId}::uuid, ${input.merchantPaymentAccountId}::uuid, ${input.providerSessionReference}, ${input.providerPaymentReference})`);
        } catch (error) {
          const message = (error as { cause?: { message?: string }; message?: string }).cause?.message ?? (error as { message?: string }).message ?? '';
          if (message.includes('payment reference conflict') || message.includes('payment session reference conflict')) throw new Error(message);
          throw error;
        }
        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        return { paymentId: String(row.payment_id), organizationId: input.organizationId, businessId: input.businessId, storeId: input.storeId, checkoutId: String(row.checkout_id), merchantPaymentAccountId: input.merchantPaymentAccountId, amountMinor: Number(row.amount_minor), currency: String(row.currency), providerPaymentReference: String(row.provider_payment_reference), providerSessionReference: String(row.provider_session_reference) };
      });
    },
  };
}
