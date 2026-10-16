import { z } from 'zod';

const uuid = z.string().uuid();
const isoCurrency = z.string().regex(/^[A-Z]{3}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const ref = z.string().trim().min(1).max(300);
const timestamp = z.string().datetime({ offset: true });

export const nativePaymentContractVersions = {
  merchantAccount: 'native-merchant-payment-account.v1',
  attempt: 'native-payment-attempt.v1',
  evidence: 'native-payment-evidence.v1',
  webhook: 'native-payment-webhook.v1',
  reconciliation: 'native-payment-reconciliation.v1',
} as const;

const tenant = { organizationId: uuid, businessId: uuid, storeId: uuid };

export const nativeMerchantPaymentAccountSchema = z.object({
  contractVersion: z.literal(nativePaymentContractVersions.merchantAccount),
  paymentAccountId: uuid, ...tenant,
  providerKey: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
  adapterVersion: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
  merchantAccountReference: ref,
  credentialReference: z.string().trim().min(1).max(300).nullable(),
  supportedCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(250),
  supportedCurrencies: z.array(isoCurrency).min(1).max(100),
  status: z.enum(['pending', 'onboarding', 'active', 'suspended', 'revoked']),
  capabilities: z.object({ authorize: z.boolean(), capture: z.boolean(), refunds: z.boolean(), webhooks: z.boolean() }).strict(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

export type NativeMerchantPaymentAccount = z.infer<typeof nativeMerchantPaymentAccountSchema>;

export const nativePaymentAttemptSchema = z.object({
  contractVersion: z.literal(nativePaymentContractVersions.attempt),
  paymentId: uuid, ...tenant,
  checkoutId: uuid,
  checkoutRevision: z.number().int().positive(),
  merchantPaymentAccountId: uuid,
  amountMinor: z.number().int().nonnegative(),
  currency: isoCurrency,
  operationId: ref,
  idempotencyKeyHash: hash,
  providerPaymentReference: ref.nullable(),
  providerSessionReference: ref.nullable(),
  status: z.enum(['created', 'session_created', 'customer_action_required', 'authorized', 'captured', 'failed', 'cancelled', 'unknown', 'reconciled']),
  createdAt: timestamp,
  updatedAt: timestamp,
  unknownAt: timestamp.nullable(),
  lastVerifiedAt: timestamp.nullable(),
}).strict();

export type NativePaymentAttempt = z.infer<typeof nativePaymentAttemptSchema>;

export const nativePaymentEvidenceSchema = z.object({
  contractVersion: z.literal(nativePaymentContractVersions.evidence),
  evidenceId: uuid, ...tenant,
  paymentId: uuid,
  merchantPaymentAccountId: uuid,
  providerEventReference: ref,
  providerObjectReference: ref,
  providerPaymentReference: ref,
  amountMinor: z.number().int().nonnegative(),
  currency: isoCurrency,
  paymentStatus: z.enum(['authorized', 'captured', 'failed', 'cancelled', 'refunded', 'unknown']),
  authenticationMethod: z.enum(['signed_webhook', 'server_retrieval', 'authorized_reconciliation']),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']),
  provenance: z.string().trim().min(1).max(300).refine((value) => !/redirect/i.test(value), 'browser redirects are not payment evidence'),
  observedAt: timestamp,
  authenticatedAt: timestamp.nullable(),
  verifiedAt: timestamp.nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.verificationStatus === 'verified' && (!value.authenticatedAt || !value.verifiedAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['authenticatedAt'], message: 'verified evidence requires authenticated and verified timestamps' });
  }
});

export type NativePaymentEvidence = z.infer<typeof nativePaymentEvidenceSchema>;

export const nativePaymentWebhookSchema = z.object({
  contractVersion: z.literal(nativePaymentContractVersions.webhook),
  webhookId: uuid, ...tenant,
  merchantPaymentAccountId: uuid,
  providerEventId: ref,
  eventType: ref,
  providerObjectReference: ref.nullable(),
  payloadDigest: hash,
  signatureStatus: z.enum(['unverified', 'verified', 'rejected']),
  processingStatus: z.enum(['received', 'accepted', 'processing', 'processed', 'retryable', 'dead_letter', 'ignored']),
  attemptCount: z.number().int().nonnegative(),
  leaseExpiresAt: timestamp.nullable(),
  nextAttemptAt: timestamp.nullable(),
  lastErrorCode: z.string().trim().max(100).nullable(),
  occurredAt: timestamp.nullable(),
  createdAt: timestamp,
  processedAt: timestamp.nullable(),
}).strict();

export type NativePaymentWebhook = z.infer<typeof nativePaymentWebhookSchema>;

export const nativePaymentReconciliationSchema = z.object({
  contractVersion: z.literal(nativePaymentContractVersions.reconciliation),
  reconciliationId: uuid, ...tenant,
  paymentId: uuid,
  merchantPaymentAccountId: uuid,
  reconciliationKeyHash: hash,
  reason: z.enum(['unknown_payment', 'conflicting_evidence', 'late_payment', 'webhook_gap']),
  status: z.enum(['pending', 'in_progress', 'still_unknown', 'resolved_paid', 'resolved_not_paid', 'escalated']),
  resolutionEvidenceId: uuid.nullable(),
  authorizedResolutionReference: ref.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  resolvedAt: timestamp.nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.status === 'resolved_paid' || value.status === 'resolved_not_paid') {
    if (!value.resolutionEvidenceId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['resolutionEvidenceId'], message: 'terminal reconciliation requires resolution evidence' });
    if (!value.authorizedResolutionReference) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['authorizedResolutionReference'], message: 'terminal reconciliation requires authorization reference' });
    if (!value.resolvedAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['resolvedAt'], message: 'terminal reconciliation requires resolution timestamp' });
  }
});

export type NativePaymentReconciliation = z.infer<typeof nativePaymentReconciliationSchema>;

export const nativePaymentEvidenceTransitions = {
  pending: ['verified', 'rejected'],
  verified: [],
  rejected: [],
} as const;

export const nativePaymentReconciliationTransitions = {
  pending: ['in_progress', 'still_unknown', 'resolved_paid', 'resolved_not_paid', 'escalated'],
  in_progress: ['still_unknown', 'resolved_paid', 'resolved_not_paid', 'escalated'],
  still_unknown: ['in_progress', 'resolved_paid', 'resolved_not_paid', 'escalated'],
  resolved_paid: [], resolved_not_paid: [], escalated: [],
} as const;
