import { z } from 'zod';

const uuidSchema = z.string().uuid();
const versionSchema = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/);
const keySchema = z.string().trim().min(1).max(200);

export const capabilityStatusSchema = z.enum(['active', 'disabled']);
export const capabilitySchema = z.object({
  contractVersion: z.literal('capability.v1'),
  capabilityId: uuidSchema,
  capabilityVersion: versionSchema,
  organizationId: uuidSchema,
  businessId: uuidSchema,
  actionType: z.string().trim().min(1).max(100).regex(/^[a-z0-9._-]+$/),
  adapterKey: z.string().trim().min(1).max(100).regex(/^[a-z0-9._-]+$/),
  status: capabilityStatusSchema,
  inputSchemaVersion: versionSchema,
  outputSchemaVersion: versionSchema,
  authorization: z.object({ visitorInitiated: z.boolean(), requiresBusinessAuthorization: z.literal(true), requiresConfirmation: z.boolean() }).strict(),
}).strict();
export type Capability = z.infer<typeof capabilitySchema>;

export const actionRequestStatusSchema = z.enum(['requested', 'validated', 'execution_pending', 'executing', 'succeeded', 'failed', 'timed_out', 'cancelled']);
export const actionRequestSchema = z.object({
  contractVersion: z.literal('action-request.v1'),
  requestId: uuidSchema,
  organizationId: uuidSchema,
  businessId: uuidSchema,
  visitorIdentityId: uuidSchema,
  sessionId: uuidSchema,
  decisionId: uuidSchema,
  capabilityId: uuidSchema,
  capabilityVersion: versionSchema,
  input: z.unknown(),
  idempotencyKey: keySchema,
  requestedAt: z.coerce.date(),
  status: actionRequestStatusSchema,
}).strict();
export type ActionRequest = z.infer<typeof actionRequestSchema>;

export const executionAttemptStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'timed_out', 'unknown', 'reconciled']);
export const executionAttemptSchema = z.object({
  contractVersion: z.literal('execution-attempt.v1'),
  executionId: uuidSchema,
  actionRequestId: uuidSchema,
  attemptNumber: z.number().int().positive(),
  status: executionAttemptStatusSchema,
  externalOperationId: z.string().trim().min(1).max(300),
  adapterRequestId: z.string().trim().min(1).max(300).nullable(),
  failureCode: z.string().trim().min(1).max(100).nullable(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
}).strict();
export type ExecutionAttempt = z.infer<typeof executionAttemptSchema>;

export const outcomeStatusSchema = z.enum(['pending', 'verified', 'rejected']);
export const outcomeSchema = z.object({
  contractVersion: z.literal('outcome.v1'),
  outcomeId: uuidSchema,
  organizationId: uuidSchema,
  businessId: uuidSchema,
  visitorIdentityId: uuidSchema.nullable(),
  sessionId: uuidSchema.nullable(),
  decisionId: uuidSchema.nullable(),
  actionRequestId: uuidSchema,
  executionId: uuidSchema,
  outcomeType: z.string().trim().min(1).max(100).regex(/^[a-z0-9._-]+$/),
  status: outcomeStatusSchema,
  evidenceType: z.string().trim().min(1).max(100),
  evidenceReference: z.string().trim().min(1).max(500),
  value: z.unknown().nullable(),
  occurredAt: z.coerce.date(),
  recordedAt: z.coerce.date(),
}).strict();
export type Outcome = z.infer<typeof outcomeSchema>;

export const adapterReceiptSchema = z.object({
  externalOperationId: z.string().trim().min(1).max(300),
  receiptReference: z.string().trim().min(1).max(500),
}).strict();
export type AdapterReceipt = z.infer<typeof adapterReceiptSchema>;

export interface ActionAdapter<TInput, TReceipt extends AdapterReceipt = AdapterReceipt> {
  readonly adapterKey: string;
  readonly capabilityVersion: string;
  validateInput(input: unknown): TInput;
  execute(input: TInput, context: { organizationId: string; businessId: string; actionRequestId: string; executionId: string; externalOperationId: string }): Promise<TReceipt>;
  verify(receipt: TReceipt): Promise<{ status: 'verified' | 'rejected' | 'pending'; evidenceType: string; evidenceReference: string }>;
}

export type ActionLifecycleState = z.infer<typeof actionRequestStatusSchema>;
const transitions: Record<ActionLifecycleState, readonly ActionLifecycleState[]> = {
  requested: ['validated', 'cancelled'], validated: ['execution_pending', 'cancelled'], execution_pending: ['executing', 'cancelled'], executing: ['succeeded', 'failed', 'timed_out'], succeeded: [], failed: [], timed_out: [], cancelled: [],
};
export function transitionAction(current: ActionLifecycleState, next: ActionLifecycleState): ActionLifecycleState {
  if (!transitions[current].includes(next)) throw new Error(`invalid action transition: ${current} -> ${next}`);
  return next;
}

export function stableExternalOperationId(requestId: string, capabilityId: string, capabilityVersion: string): string {
  return `kablet:${requestId}:${capabilityId}:${capabilityVersion}`;
}

export type ActionEligibilityInput = {
  decisionStateRevisionId: string;
  currentStateRevisionId: string;
  capability: Capability;
  authorizedCapabilityId: string;
  authorizedCapabilityVersion: string;
  decisionExpiresAt: Date | null;
  now: Date;
  visitorConfirmed: boolean;
};
export type ActionEligibilityResult = { eligible: true } | { eligible: false; reason: 'stale_decision' | 'capability_not_authorized' | 'decision_expired' | 'confirmation_required' };
export function evaluateActionEligibility(input: ActionEligibilityInput): ActionEligibilityResult {
  if (input.decisionStateRevisionId !== input.currentStateRevisionId) return { eligible: false, reason: 'stale_decision' };
  if (input.capability.status !== 'active' || input.capability.capabilityId !== input.authorizedCapabilityId || input.capability.capabilityVersion !== input.authorizedCapabilityVersion) return { eligible: false, reason: 'capability_not_authorized' };
  if (input.decisionExpiresAt !== null && input.decisionExpiresAt.getTime() <= input.now.getTime()) return { eligible: false, reason: 'decision_expired' };
  if (input.capability.authorization.requiresConfirmation && !input.visitorConfirmed) return { eligible: false, reason: 'confirmation_required' };
  return { eligible: true };
}

export function canRetryUnknownExecution(status: ExecutionAttempt['status'], reconciled: boolean): boolean {
  return status === 'unknown' && reconciled;
}
