import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { nativePaymentAttemptSchema, type NativePaymentAttempt } from '@kablet/domain';
import type { Database } from './index.js';

export type NativePaymentAttemptContext = {
  organizationId: string;
  businessId: string;
  storeId: string;
};

export type CreateNativePaymentAttemptInput = NativePaymentAttemptContext & {
  checkoutId: string;
  merchantPaymentAccountId: string;
  idempotencyKey: string;
  captureMode: 'authorize_only' | 'authorize_and_capture';
};

function hashKey(value: string): Buffer {
  if (!value || value.length > 200) throw new Error('payment idempotency key is invalid');
  return createHash('sha256').update(value, 'utf8').digest();
}

function isoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  throw new Error('payment attempt timestamp is invalid');
}

function mapAttempt(row: Record<string, unknown>, context: NativePaymentAttemptContext, checkoutId: string, accountId: string, operationId: string, keyHash: Buffer): NativePaymentAttempt {
  return nativePaymentAttemptSchema.parse({
    contractVersion: 'native-payment-attempt.v1',
    paymentId: row.payment_id,
    ...context,
    checkoutId,
    checkoutRevision: Number(row.checkout_revision),
    merchantPaymentAccountId: accountId,
    amountMinor: Number(row.amount_minor),
    currency: String(row.currency),
    operationId,
    idempotencyKeyHash: keyHash.toString('hex'),
    providerPaymentReference: row.provider_payment_reference == null ? null : String(row.provider_payment_reference),
    providerSessionReference: row.provider_session_reference == null ? null : String(row.provider_session_reference),
    status: row.status,
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
    unknownAt: row.unknown_at == null ? null : isoTimestamp(row.unknown_at),
    lastVerifiedAt: row.last_verified_at == null ? null : isoTimestamp(row.last_verified_at),
  });
}

export function createNativePaymentExecutionService(db: Database['db']) {
  return {
    async createPaymentAttempt(input: CreateNativePaymentAttemptInput): Promise<{ payment: NativePaymentAttempt; idempotent: boolean }> {
      const keyHash = hashKey(input.idempotencyKey);
      const operationId = `native:${input.checkoutId}:${input.merchantPaymentAccountId}:${input.captureMode}:${keyHash.toString('hex')}`;
      const paymentId = randomUUID();
      let result;
      try {
        result = await db.transaction(async tx => {
          const lockIdentity = [input.organizationId, input.businessId, input.storeId, input.checkoutId, input.merchantPaymentAccountId, keyHash.toString('hex')].join(':');
          await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))`);
          return tx.execute(sql`
          select * from kablet_create_native_payment_attempt(
            ${paymentId}::uuid, ${input.organizationId}::uuid, ${input.businessId}::uuid,
            ${input.storeId}::uuid, ${input.checkoutId}::uuid,
            ${input.merchantPaymentAccountId}::uuid, ${keyHash}, ${operationId}, ${input.captureMode}
          )
          `);
        });
      } catch (error) {
        const cause = (error as { cause?: { message?: string } }).cause?.message;
        if (cause === 'payment idempotency conflict') throw new Error('payment idempotency conflict');
        throw error;
      }
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error('payment attempt could not be created');
      const loaded = await db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
        const current = await tx.execute(sql`select id as payment_id, checkout_revision, amount_minor, currency, provider_payment_reference, provider_session_reference, status, created_at, updated_at, unknown_at, last_verified_at from kablet_native_payment_attempts where id=${String(row.payment_id)}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and store_id=${input.storeId}::uuid and merchant_payment_account_id=${input.merchantPaymentAccountId}::uuid`);
        const currentRow = current.rows[0] as Record<string, unknown> | undefined;
        if (!currentRow) throw new Error('payment attempt could not be loaded');
        return currentRow;
      });
      return {
        payment: mapAttempt(
          loaded,
          { organizationId: input.organizationId, businessId: input.businessId, storeId: input.storeId },
          input.checkoutId,
          input.merchantPaymentAccountId,
          operationId,
          keyHash,
        ),
        idempotent: Boolean(row.idempotent),
      };
    },
    async recordProviderSessionReference(input: NativePaymentAttemptContext & { paymentId: string; merchantPaymentAccountId: string; providerSessionReference: string }) {
      if (!/^cs_[A-Za-z0-9_]+$/.test(input.providerSessionReference)) throw new Error('payment session reference is invalid');
      const result = await db.execute(sql`select * from kablet_record_native_payment_session(${input.paymentId}::uuid, ${input.organizationId}::uuid, ${input.businessId}::uuid, ${input.storeId}::uuid, ${input.merchantPaymentAccountId}::uuid, ${input.providerSessionReference})`);
      const row = result.rows[0] as { provider_session_reference?: string; idempotent?: boolean } | undefined;
      if (!row) throw new Error('payment session could not be recorded');
      return { providerSessionReference: String(row.provider_session_reference), idempotent: Boolean(row.idempotent) };
    },
  };
}
