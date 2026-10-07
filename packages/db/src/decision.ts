import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database, DatabaseTransaction } from './index.js';
import { decisionPolicyOutputSchema, evaluateBaselineDecision, visitorStateSchema } from '@kablet/domain';
import type { DecisionPolicyInput } from '@kablet/domain';
import { z } from 'zod';

type Tx = DatabaseTransaction;
const uuid = /^[0-9a-f-]{36}$/i;
const offeringReferenceRowSchema = z.object({ offering_id: z.string().uuid(), revision_id: z.string().uuid() });
const safeIntegerSchema = z.union([z.string(), z.number()]).transform(value => {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(numberValue) || numberValue < 0) throw new Error('BIGINT exceeds JavaScript safe integer range');
  return numberValue;
});
const currentStateRowSchema = z.object({ version: safeIntegerSchema, current_revision_id: z.string().uuid(), state: z.unknown() });

export type PersistedDecisionRow = Record<string, unknown> & {
  visitor_state_version: number;
  intent_policy_revision_id: string | null;
};

function normalizeDecisionRow(row: unknown): PersistedDecisionRow {
  const record = z.record(z.string(), z.unknown()).parse(row);
  return { ...record, visitor_state_version: safeIntegerSchema.parse(record.visitor_state_version), intent_policy_revision_id: record.intent_policy_revision_id === null || record.intent_policy_revision_id === undefined ? null : z.string().uuid().parse(record.intent_policy_revision_id) };
}

async function tenant<T>(db: Database['db'], organizationId: string, businessId: string, fn: (tx: Tx) => Promise<T>, existingTx?: Tx) {
  if (!uuid.test(organizationId) || !uuid.test(businessId)) throw new Error('invalid tenant context');
  const run = async (tx: Tx) => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true)`);
    const business = await tx.execute(sql`select 1 from businesses where id=${businessId}::uuid and organization_id=${organizationId}::uuid and active`);
    if (!business.rows[0]) throw new Error('business does not belong to organization');
    await tx.execute(sql`select set_config('kablet.business_id', ${businessId}, true)`);
    return fn(tx);
  };
  return existingTx ? run(existingTx) : db.transaction(run);
}

export function createDecisionRepository(db: Database['db'], existingTx?: Tx) {
  return {
    async create(input: { organizationId: string; businessId: string; visitorIdentityId: string; sessionId: string; idempotencyKey: string; policyId: string; policyVersion: string; intentPolicyRevisionId?: string; contractVersion?: 'decision.v1'; policyInput: DecisionPolicyInput }) {
      return tenant(db, input.organizationId, input.businessId, async tx => {
        const current = await tx.execute(sql`select s.version, s.current_revision_id, r.state from visitor_states s join visitor_state_revisions r on r.id=s.current_revision_id where s.visitor_identity_id=${input.visitorIdentityId}::uuid and s.business_id=${input.businessId}::uuid for update`);
        if (!current.rows[0]) throw new Error('current visitor state not found');
        const currentRow = currentStateRowSchema.parse(current.rows[0]);
        const currentState = visitorStateSchema.parse(currentRow.state);
        const stateVersion = currentRow.version;
        const fingerprint = createHash('sha256').update(JSON.stringify({ policyInput: input.policyInput, stateVersion, policyId: input.policyId, policyVersion: input.policyVersion, intentPolicyRevisionId: input.intentPolicyRevisionId ?? null })).digest('hex');
        const existing = await tx.execute(sql`select * from visitor_decisions where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and visitor_identity_id=${input.visitorIdentityId}::uuid and idempotency_key=${input.idempotencyKey}`);
        if (existing.rows[0]) {
          if (existing.rows[0].input_fingerprint !== fingerprint) throw new Error('decision idempotency key conflicts with a different input');
          return { idempotent: true, decision: normalizeDecisionRow(existing.rows[0]) };
        }
        const session = await tx.execute(sql`select 1 from visitor_sessions where id=${input.sessionId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and visitor_identity_id=${input.visitorIdentityId}::uuid and status='active'`);
        if (!session.rows[0]) throw new Error('session does not belong to visitor and business');
        const refs = await tx.execute(sql`select p.offering_id, p.revision_id from offering_publications p join business_offerings o on o.id=p.offering_id and o.business_id=${input.businessId}::uuid and o.active join business_offering_revisions r on r.id=p.revision_id and r.approval_status='approved' and r.visibility='public'`);
        const eligibleOfferingRefs = refs.rows.map(row => {
          const parsed = offeringReferenceRowSchema.parse(row);
          return { offeringId: parsed.offering_id, offeringRevisionId: parsed.revision_id };
        });
        const result = decisionPolicyOutputSchema.parse(evaluateBaselineDecision({ ...input.policyInput, state: currentState, eligibleOfferingRefs }));
        const decisionId = randomUUID();
        const inserted = await tx.execute(sql`insert into visitor_decisions (id,organization_id,business_id,visitor_identity_id,session_id,decision_type,status,contract_version,policy_id,policy_version,intent_policy_revision_id,visitor_state_revision_id,visitor_state_version,idempotency_key,input_fingerprint,qualification_question_key,qualification_question_prompt,qualification_question_options) values (${decisionId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.visitorIdentityId}::uuid,${input.sessionId}::uuid,${result.type},'accepted',${input.contractVersion ?? 'decision.v1'},${input.policyId},${input.policyVersion},${input.intentPolicyRevisionId ?? null}::uuid,${currentRow.current_revision_id}::uuid,${stateVersion},${input.idempotencyKey},${fingerprint},${result.qualificationQuestion?.key ?? null},${result.qualificationQuestion?.prompt ?? null},${result.qualificationQuestion ? JSON.stringify(result.qualificationQuestion.options) : null}::jsonb) returning *`);
        const relevantRefs = result.type === 'present_offering'
          ? eligibleOfferingRefs
          : result.type === 'request_time_window' && currentState.selectedOffering
            ? eligibleOfferingRefs.filter(ref => ref.offeringId === currentState.selectedOffering?.offeringId && ref.offeringRevisionId === currentState.selectedOffering?.publishedRevisionId)
            : [];
        for (const ref of relevantRefs) await tx.execute(sql`insert into visitor_decision_business_truth_refs (decision_id,organization_id,business_id,offering_id,offering_revision_id) values (${decisionId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${ref.offeringId}::uuid,${ref.offeringRevisionId}::uuid)`);
        return { idempotent: false, decision: { ...normalizeDecisionRow(inserted.rows[0]), rationale: result.rationale } };
      }, existingTx);
    },
    async getById(organizationId: string, businessId: string, decisionId: string) {
      return tenant(db, organizationId, businessId, async tx => {
        const result = await tx.execute(sql`select * from visitor_decisions where organization_id=${organizationId}::uuid and business_id=${businessId}::uuid and id=${decisionId}::uuid`);
        return result.rows[0] ? normalizeDecisionRow(result.rows[0]) : null;
      });
    },
  };
}
