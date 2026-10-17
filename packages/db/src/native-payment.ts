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
    providerPaymentReference: null,
    providerSessionReference: null,
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
        result = await db.execute(sql`
          select * from kablet_create_native_payment_attempt(
            ${paymentId}::uuid, ${input.organizationId}::uuid, ${input.businessId}::uuid,
            ${input.storeId}::uuid, ${input.checkoutId}::uuid,
            ${input.merchantPaymentAccountId}::uuid, ${keyHash}, ${operationId}, ${input.captureMode}
          )
        `);
      } catch (error) {
        const cause = (error as { cause?: { message?: string } }).cause?.message;
        if (cause === 'payment idempotency conflict') throw new Error('payment idempotency conflict');
        throw error;
      }
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error('payment attempt could not be created');
      return {
        payment: mapAttempt(
          row,
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
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
        const result = await tx.execute(sql`select provider_session_reference from kablet_native_payment_attempts where id=${input.paymentId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and store_id=${input.storeId}::uuid and merchant_payment_account_id=${input.merchantPaymentAccountId}::uuid for update`);
        const row = result.rows[0] as { provider_session_reference?: string | null } | undefined;
        if (!row) throw new Error('payment attempt not found');
        if (row.provider_session_reference && row.provider_session_reference !== input.providerSessionReference) throw new Error('payment session reference conflict');
        if (!row.provider_session_reference) await tx.execute(sql`update kablet_native_payment_attempts set provider_session_reference=${input.providerSessionReference}, status=case when status='created' then 'session_created' else status end, updated_at=now() where id=${input.paymentId}::uuid and provider_session_reference is null`);
        return { providerSessionReference: input.providerSessionReference, idempotent: Boolean(row.provider_session_reference) };
      });
    },
  };
}
