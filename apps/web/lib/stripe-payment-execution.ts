import type { NativePaymentAdapter, NativePaymentAttempt, NativePaymentCaptureMode, NativePaymentSessionResult } from '@kablet/domain';

export async function createAndBindStripeHostedSession(input: {
  payment: NativePaymentAttempt;
  captureMode: NativePaymentCaptureMode;
  returnReference: string;
  adapter: NativePaymentAdapter;
  recordSession: (input: { paymentId: string; organizationId: string; businessId: string; storeId: string; merchantPaymentAccountId: string; providerSessionReference: string }) => Promise<{ providerSessionReference: string; idempotent: boolean }>;
}): Promise<{ payment: NativePaymentAttempt; session: NativePaymentSessionResult }> {
  const session = await input.adapter.createHostedSession({ payment: input.payment, captureMode: input.captureMode, returnReference: input.returnReference });
  await input.recordSession({ paymentId: input.payment.paymentId, organizationId: input.payment.organizationId, businessId: input.payment.businessId, storeId: input.payment.storeId, merchantPaymentAccountId: input.payment.merchantPaymentAccountId, providerSessionReference: session.providerSessionReference });
  return { payment: { ...input.payment, providerSessionReference: session.providerSessionReference, status: input.payment.status === 'created' ? 'session_created' : input.payment.status }, session };
}
