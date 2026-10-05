import { describe, expect, it } from 'vitest';
import { actionRequestSchema, capabilitySchema, canRetryUnknownExecution, evaluateActionEligibility, stableExternalOperationId, transitionAction } from '@kablet/domain';

const capability = capabilitySchema.parse({ contractVersion: 'capability.v1', capabilityId: '81000000-0000-4000-8000-000000000001', capabilityVersion: '1', organizationId: '81000000-0000-4000-8000-000000000002', businessId: '81000000-0000-4000-8000-000000000003', actionType: 'request.next_step', adapterKey: 'controlled.test', status: 'active', inputSchemaVersion: '1', outputSchemaVersion: '1', authorization: { visitorInitiated: true, requiresBusinessAuthorization: true, requiresConfirmation: true } });
const now = new Date('2026-10-01T00:00:00Z');

describe('Slice 07A Action and Outcome contracts', () => {
  it('accepts versioned vertical-agnostic capability and action contracts', () => {
    expect(capability.contractVersion).toBe('capability.v1');
    expect(actionRequestSchema.parse({ contractVersion: 'action-request.v1', requestId: '81000000-0000-4000-8000-000000000004', organizationId: capability.organizationId, businessId: capability.businessId, visitorIdentityId: '81000000-0000-4000-8000-000000000005', sessionId: '81000000-0000-4000-8000-000000000006', decisionId: '81000000-0000-4000-8000-000000000007', capabilityId: capability.capabilityId, capabilityVersion: '1', input: { bounded: true }, idempotencyKey: 'action-1', requestedAt: now, status: 'requested' }).status).toBe('requested');
  });
  it('requires current state, authorization, freshness and confirmation', () => {
    const base = { decisionStateRevisionId: '82000000-0000-4000-8000-000000000001', currentStateRevisionId: '82000000-0000-4000-8000-000000000001', capability, authorizedCapabilityId: capability.capabilityId, authorizedCapabilityVersion: '1', decisionExpiresAt: new Date('2026-10-02T00:00:00Z'), now, visitorConfirmed: true };
    expect(evaluateActionEligibility(base)).toEqual({ eligible: true });
    expect(evaluateActionEligibility({ ...base, currentStateRevisionId: '82000000-0000-4000-8000-000000000002' })).toEqual({ eligible: false, reason: 'stale_decision' });
    expect(evaluateActionEligibility({ ...base, visitorConfirmed: false })).toEqual({ eligible: false, reason: 'confirmation_required' });
    expect(evaluateActionEligibility({ ...base, decisionExpiresAt: new Date('2026-09-30T00:00:00Z') })).toEqual({ eligible: false, reason: 'decision_expired' });
    expect(evaluateActionEligibility({ ...base, capability: { ...capability, status: 'disabled' } })).toEqual({ eligible: false, reason: 'capability_not_authorized' });
  });
  it('enforces the closed action lifecycle', () => { expect(transitionAction('requested', 'validated')).toBe('validated'); expect(transitionAction('executing', 'succeeded')).toBe('succeeded'); expect(() => transitionAction('succeeded', 'executing')).toThrow(); });
  it('keeps one stable external operation identity and gates unknown retries on reconciliation', () => { expect(stableExternalOperationId('a', 'b', '1')).toBe(stableExternalOperationId('a', 'b', '1')); expect(canRetryUnknownExecution('unknown', false)).toBe(false); expect(canRetryUnknownExecution('unknown', true)).toBe(true); });
});
