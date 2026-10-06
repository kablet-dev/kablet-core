import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { capabilitySchema, evaluateActionEligibility, stableExternalOperationId, transitionAction, type ActionAdapter, type Capability } from '@kablet/domain';
import { createActionOutcomeRepository, createAttributionRepository, createMeasurementRepository, type Database } from '@kablet/db';
import { controlledLeadAdapter, type ControlledLeadInput } from './lead-adapter';

export function createControlledLeadCapability(organizationId: string, businessId: string): Capability { return capabilitySchema.parse({ contractVersion: 'capability.v1', capabilityId: '91000000-0000-4000-8000-000000000001', capabilityVersion: '1', organizationId, businessId, actionType: 'lead.delivery', adapterKey: controlledLeadAdapter.adapterKey, status: 'active', inputSchemaVersion: '1', outputSchemaVersion: '1', authorization: { visitorInitiated: true, requiresBusinessAuthorization: true, requiresConfirmation: true } }); }
export function assertCapabilityTenantOwnership(capability: Capability, organizationId: string, businessId: string): void { if (capability.organizationId !== organizationId || capability.businessId !== businessId) throw new Error('capability_not_authorized'); }
type Options = { adapter?: ActionAdapter<ControlledLeadInput>; capability?: Capability };

export function createActionService(db: Database['db'], organizationId: string, businessId: string, options: Options = {}) {
  const adapter = options.adapter ?? controlledLeadAdapter;
  const capability = options.capability ?? createControlledLeadCapability(organizationId, businessId);
  return { async confirm(input: { handle: string; decisionId: string; idempotencyKey: string; visitorConfirmed: boolean }) {
    if (!input.visitorConfirmed) throw new Error('confirmation required');
    const prepared = await db.transaction(async tx => {
      await tx.execute(sql`select set_config('kablet.organization_id',${organizationId},true),set_config('kablet.business_id',${businessId},true)`);
      const hash = createHash('sha256').update(input.handle).digest('hex');
      const result = await tx.execute(sql`select d.id,d.visitor_identity_id,d.session_id,d.visitor_state_revision_id,s.current_revision_id,c.id as contact_record_id,c.name,c.email,co.purpose,co.version,i.id as interaction_session_id,(select e.id from experience_exposures e where e.organization_id=d.organization_id and e.business_id=d.business_id and e.interaction_session_id=i.id order by e.exposure_sequence desc limit 1) as exposure_id from visitor_decisions d join visitor_states s on s.visitor_identity_id=d.visitor_identity_id and s.business_id=d.business_id join visitor_contact_records c on c.visitor_identity_id=d.visitor_identity_id and c.business_id=d.business_id join visitor_consents co on co.visitor_identity_id=d.visitor_identity_id and co.business_id=d.business_id and co.status='granted' join interaction_sessions i on i.visitor_identity_id=d.visitor_identity_id and i.visitor_session_id=d.session_id where d.id=${input.decisionId}::uuid and d.organization_id=${organizationId}::uuid and d.business_id=${businessId}::uuid and d.decision_type='offer_next_step' and i.handle_hash=decode(${hash},'hex') and i.status='active' and i.expires_at>now() and co.purpose='follow_up' and co.version='1'`);
      if (!result.rows[0]) throw new Error('action is not eligible');
      const current = result.rows[0];
      assertCapabilityTenantOwnership(capability, organizationId, businessId);
      const eligible = evaluateActionEligibility({ decisionStateRevisionId: String(current.visitor_state_revision_id), currentStateRevisionId: String(current.current_revision_id), capability, authorizedCapabilityId: capability.capabilityId, authorizedCapabilityVersion: capability.capabilityVersion, decisionExpiresAt: null, now: new Date(), visitorConfirmed: true });
      if (!eligible.eligible) throw new Error(eligible.reason);
      const repository = createActionOutcomeRepository(db, tx);
      const request = await repository.createRequest({ organizationId, businessId, visitorIdentityId: String(current.visitor_identity_id), sessionId: String(current.session_id), decisionId: String(current.id), capabilityId: capability.capabilityId, capabilityVersion: capability.capabilityVersion, idempotencyKey: input.idempotencyKey, input: { contactRecordId: String(current.contact_record_id) }, status: 'execution_pending' });
      if (!current.exposure_id) throw new Error('interaction exposure not found');
      await createMeasurementRepository(db, tx).insertFact({ contractVersion: 'interaction-fact.v1', id: randomUUID(), organizationId, businessId, visitorIdentityId: String(current.visitor_identity_id), visitorSessionId: String(current.session_id), interactionSessionId: String(current.interaction_session_id), decisionId: String(current.id), exposureId: String(current.exposure_id), interactionKind: 'action_confirmed', occurredAt: new Date(), idempotencyKey: input.idempotencyKey, actionRequestId: request.request.requestId });
      if (!request.created) {
        const existing = await tx.execute(sql`select o.id as outcome_id,o.status as outcome_status,e.status as attempt_status,e.external_operation_id from execution_attempts e left join action_outcomes o on o.execution_id=e.id where e.action_request_id=${request.request.requestId}::uuid order by e.attempt_number desc limit 1`);
        const row = existing.rows[0];
        if (row?.outcome_status === 'verified') return { status: 'verified' as const, actionRequestId: request.request.requestId, outcomeId: String(row.outcome_id) };
        if (row?.attempt_status === 'unknown') return { status: 'unknown' as const, actionRequestId: request.request.requestId, externalOperationId: String(row.external_operation_id) };
        if (row?.attempt_status === 'failed') return { status: 'failed' as const, actionRequestId: request.request.requestId };
        return { status: 'replayed' as const, actionRequestId: request.request.requestId };
      }
      const operationId = stableExternalOperationId(request.request.requestId, capability.capabilityId, capability.capabilityVersion);
      const attempt = await repository.createAttempt({ organizationId, businessId, actionRequestId: request.request.requestId, attemptNumber: 1, externalOperationId: operationId }, tx);
      return { status: 'prepared' as const, request: request.request, attempt, operationId, contact: { name: String(current.name), email: String(current.email), consentPurpose: String(current.purpose), consentVersion: String(current.version) } };
    });
    if (prepared.status !== 'prepared') {
      if (prepared.status === 'verified') { try { await createAttributionRepository(db).attributeVerifiedOutcome(organizationId, businessId, prepared.outcomeId); } catch { /* attribution is derived and retryable */ } }
      return prepared;
    }
    const request = prepared.request;
    const attempt = prepared.attempt;
    const repository = createActionOutcomeRepository(db);
    const claimed = await repository.claimExecution({ organizationId, businessId, requestId: request.requestId });
    if (!claimed) return { status: 'replayed' as const, actionRequestId: request.requestId };
    try {
      const receipt = await adapter.execute(prepared.contact, { organizationId, businessId, actionRequestId: request.requestId, executionId: attempt.executionId, externalOperationId: prepared.operationId });
      if (receipt.externalOperationId !== prepared.operationId) throw new Error('receipt operation mismatch');
      const verification = await adapter.verify(receipt);
      if (verification.status !== 'verified') { await repository.updateAttempt({ organizationId, businessId, executionId: attempt.executionId, status: 'failed', adapterRequestId: receipt.receiptReference, failureCode: 'verification_rejected' }); transitionAction('executing', 'failed'); await repository.updateRequest({ organizationId, businessId, requestId: request.requestId, status: 'failed' }); return { status: 'failed' as const, actionRequestId: request.requestId }; }
      await repository.updateAttempt({ organizationId, businessId, executionId: attempt.executionId, status: 'succeeded', adapterRequestId: receipt.receiptReference, failureCode: null });
      transitionAction('executing', 'succeeded');
      await repository.updateRequest({ organizationId, businessId, requestId: request.requestId, status: 'succeeded' });
      const outcome = await repository.createOutcome({ organizationId, businessId, visitorIdentityId: request.visitorIdentityId, sessionId: request.sessionId, decisionId: request.decisionId, actionRequestId: request.requestId, executionId: attempt.executionId, outcomeType: 'lead.delivered', status: 'verified', evidenceType: verification.evidenceType, evidenceReference: verification.evidenceReference, value: null, occurredAt: new Date() });
      try { await createAttributionRepository(db).attributeVerifiedOutcome(organizationId, businessId, outcome.outcomeId); } catch { /* attribution is derived and retryable */ }
      return { status: 'verified' as const, actionRequestId: request.requestId, outcomeId: outcome.outcomeId, outcome };
    } catch (error) { await repository.updateAttempt({ organizationId, businessId, executionId: attempt.executionId, status: 'unknown', adapterRequestId: null, failureCode: error instanceof Error ? error.name : 'external_unknown' }); return { status: 'unknown' as const, actionRequestId: request.requestId, externalOperationId: prepared.operationId }; }
  } };
}
