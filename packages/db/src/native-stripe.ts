import { sql } from 'drizzle-orm';
import type { Database } from './index.js';

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
