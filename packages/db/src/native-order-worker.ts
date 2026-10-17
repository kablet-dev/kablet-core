import { sql } from 'drizzle-orm';
import type { NativeOrderCommitResult } from '@kablet/domain';
import type { Database } from './index.js';
import { createNativeVerifiedOrderService } from './native-order.js';

export type NativeOrderWorkClaim = {
  evidenceId: string;
  organizationId: string;
  businessId: string;
  storeId: string;
  paymentId: string;
  attemptCount: number;
};

export type NativeOrderWorkerOptions = {
  leaseSeconds?: number;
  maxAttempts?: number;
  /** Test/infrastructure hook used only to model a process dying before ack. */
  beforeAcknowledgement?: (result: NativeOrderCommitResult) => Promise<void>;
};

export type NativeOrderWorkResult =
  | { claimed: false }
  | { claimed: true; claim: NativeOrderWorkClaim; result: NativeOrderCommitResult }
  | { claimed: true; claim: NativeOrderWorkClaim; failed: true; status: 'retryable' | 'recovery' | 'dead_letter' };

function rowValue(row: Record<string, unknown>, key: string): unknown {
  return row[key] ?? row[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)];
}
function isTransient(error: unknown): boolean {
  const value = error as { code?: string; cause?: { code?: string; message?: string }; message?: string };
  const code = value.code ?? value.cause?.code ?? '';
  if (['40001', '40P01', '53300', '57P01', '08000', '08001', '08003', '08004', '08006'].includes(code)) return true;
  const message = `${value.message ?? ''} ${value.cause?.message ?? ''}`.toLowerCase();
  return /timeout|connection|temporar|unavailable|deadlock|serialization|network|econn|reset/.test(message);
}

function safeErrorCode(error: unknown): string {
  if (isTransient(error)) return 'order_commit_transient';
  const message = String((error as { message?: string }).message ?? '').toLowerCase();
  if (message.includes('not found') || message.includes('mismatch') || message.includes('eligible') || message.includes('evidence')) return 'order_commit_validation';
  return 'order_commit_unexpected';
}

export function retryDelaySeconds(attemptCount: number): number {
  return Math.min(300, Math.max(1, 2 ** Math.max(0, attemptCount - 1) * 5));
}

export function createNativeVerifiedOrderWorker(db: Database['db'], options: NativeOrderWorkerOptions = {}) {
  const leaseSeconds = options.leaseSeconds ?? 60;
  const maxAttempts = options.maxAttempts ?? 5;
  const orderService = createNativeVerifiedOrderService(db);

  return {
    async processOnce(workerId: string): Promise<NativeOrderWorkResult> {
      const claimResult = await db.execute(sql`
        select * from kablet_claim_native_verified_order_work(${workerId}, ${leaseSeconds}, ${maxAttempts})
      `);
      const row = claimResult.rows[0] as Record<string, unknown> | undefined;
      if (!row) return { claimed: false };
      const claim: NativeOrderWorkClaim = {
        evidenceId: String(rowValue(row, 'evidence_id')),
        organizationId: String(rowValue(row, 'organization_id')),
        businessId: String(rowValue(row, 'business_id')),
        storeId: String(rowValue(row, 'store_id')),
        paymentId: String(rowValue(row, 'payment_id')),
        attemptCount: Number(rowValue(row, 'attempt_count')),
      };

      try {
        const result = await orderService.commitCapturedPayment({
          organizationId: claim.organizationId,
          businessId: claim.businessId,
          storeId: claim.storeId,
          paymentId: claim.paymentId,
          evidenceId: claim.evidenceId,
          commitmentKey: `native-order-work-${claim.evidenceId}`,
        });
        await options.beforeAcknowledgement?.(result);
        const status = result.recoveryRequired ? 'recovery' : 'processed';
        await db.execute(sql`
          select * from kablet_complete_native_verified_order_work(
            ${claim.evidenceId}::uuid, ${workerId}, ${status}, ${result.recoveryReason}, null
          )
        `);
        return { claimed: true, claim, result };
      } catch (error) {
        const transient = isTransient(error);
        const terminal = claim.attemptCount >= maxAttempts;
        const status = transient && !terminal ? 'retryable' : (transient ? 'dead_letter' : 'recovery');
        const errorCode = safeErrorCode(error);
        await db.execute(sql`
          select * from kablet_complete_native_verified_order_work(
            ${claim.evidenceId}::uuid, ${workerId}, ${status}, ${errorCode},
            ${status === 'retryable' ? retryDelaySeconds(claim.attemptCount) : null}
          )
        `);
        return { claimed: true, claim, failed: true, status };
      }
    },
  };
}
