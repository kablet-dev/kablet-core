import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { nativeEvidenceEventSchema, nativeEvidenceInputSchema, type NativeEvidenceEvent, type NativeEvidenceInput } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';

type Scope = { organizationId: string; businessId: string; storeId: string };
type Lineage = Scope & { visitorIdentityId: string; visitorSessionId: string; interactionSessionId: string; visitorStateRevisionId?: string | null; decisionId?: string | null; exposureId?: string | null; ruleKey?: string | null; ruleVersion?: number | null; decisionReason?: string | null };
type Row = Record<string, unknown>;

function scoped<T>(db: Database['db'], scope: { organizationId: string; businessId: string }, transaction: DatabaseTransaction | undefined, work: (tx: DatabaseTransaction) => Promise<T>) {
  const run = async (tx: DatabaseTransaction) => { await tx.execute(sql`select set_config('kablet.organization_id',${scope.organizationId},true),set_config('kablet.business_id',${scope.businessId},true)`); return work(tx); };
  return transaction ? run(transaction) : db.transaction(run);
}

function mapEvent(row: Row): NativeEvidenceEvent {
  return nativeEvidenceEventSchema.parse({
    contractVersion: 'native-evidence-event.v1', id: row.id, organizationId: row.organization_id, businessId: row.business_id, storeId: row.store_id,
    visitorIdentityId: row.visitor_identity_id, visitorSessionId: row.visitor_session_id, interactionSessionId: row.interaction_session_id,
    visitorStateRevisionId: row.visitor_state_revision_id, decisionId: row.decision_id, exposureId: row.exposure_id,
    ruleKey: row.rule_key, ruleVersion: row.rule_version === null ? null : Number(row.rule_version), decisionReason: row.decision_reason,
    eventKind: row.event_kind, occurredAt: row.occurred_at, idempotencyKey: row.idempotency_key, metadata: row.metadata,
  });
}

export function createNativeEvidenceRepository(db: Database['db']) {
  return {
    async append(lineage: Lineage, input: NativeEvidenceInput, transaction?: DatabaseTransaction): Promise<{ id: string; inserted: boolean }> {
      const parsed = nativeEvidenceInputSchema.parse(input);
      return scoped(db, lineage, transaction, async tx => {
        const result = await tx.execute(sql`insert into native_evidence_events(id,organization_id,business_id,store_id,visitor_identity_id,visitor_session_id,interaction_session_id,visitor_state_revision_id,decision_id,exposure_id,rule_key,rule_version,decision_reason,event_kind,occurred_at,idempotency_key,metadata) values (${randomUUID()}::uuid,${lineage.organizationId}::uuid,${lineage.businessId}::uuid,${lineage.storeId}::uuid,${lineage.visitorIdentityId}::uuid,${lineage.visitorSessionId}::uuid,${lineage.interactionSessionId}::uuid,${lineage.visitorStateRevisionId ?? null}::uuid,${lineage.decisionId ?? null}::uuid,${lineage.exposureId ?? null}::uuid,${lineage.ruleKey ?? null},${lineage.ruleVersion ?? null},${lineage.decisionReason ?? null},${parsed.eventKind},now(),${parsed.idempotencyKey},${JSON.stringify(parsed.metadata)}::jsonb) on conflict (organization_id,business_id,interaction_session_id,event_kind,idempotency_key) do nothing returning id`);
        return { id: String(result.rows[0]?.id ?? ''), inserted: result.rows.length > 0 };
      });
    },
    async getTimeline(scope: Scope, visitorSessionId: string, limit = 100, before?: { occurredAt: Date; id: string }) {
      const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
      return scoped(db, scope, undefined, async tx => {
        const events = await tx.execute(sql`select e.*,
          d.decision_type, d.native_rule_id, d.native_rule_version, d.native_rule_reason,
          r.rule_key as selected_rule_key,
          x.composition_id as exposed_composition_id, x.composition_version as exposed_composition_version
          from native_evidence_events e
          left join visitor_decisions d on d.organization_id=e.organization_id and d.business_id=e.business_id and d.id=e.decision_id
          left join kablet_native_rules r on r.organization_id=e.organization_id and r.business_id=e.business_id and r.store_id=e.store_id and r.id=d.native_rule_id
          left join experience_exposures x on x.organization_id=e.organization_id and x.business_id=e.business_id and x.id=e.exposure_id
          where e.organization_id=${scope.organizationId}::uuid and e.business_id=${scope.businessId}::uuid and e.store_id=${scope.storeId}::uuid and e.visitor_session_id=${visitorSessionId}::uuid
            and (${before ? sql`(e.occurred_at,e.id) < (${before.occurredAt},${before.id}::uuid)` : sql`true`})
          order by e.occurred_at desc,e.id desc limit ${boundedLimit}`);
        const outcomes = await tx.execute(sql`select a.order_id,a.status,a.rule,a.currency,a.revenue_amount_minor::text,a.purchase_at,o.public_reference
          from kablet_native_order_attributions a join kablet_native_orders o on o.organization_id=a.organization_id and o.business_id=a.business_id and o.store_id=a.store_id and o.id=a.order_id
          where a.organization_id=${scope.organizationId}::uuid and a.business_id=${scope.businessId}::uuid and a.store_id=${scope.storeId}::uuid and a.visitor_session_id=${visitorSessionId}::uuid
          order by a.purchase_at desc`);
        return { events: events.rows.map(row => ({ event: mapEvent(row as Row), lineage: { decisionType: row.decision_type ?? null, selectedRuleKey: row.selected_rule_key ?? null, exposedCompositionId: row.exposed_composition_id ?? null, exposedCompositionVersion: row.exposed_composition_version ?? null } })), verifiedOutcomes: outcomes.rows, nextCursor: events.rows.length === boundedLimit ? { occurredAt: events.rows[events.rows.length - 1].occurred_at, id: events.rows[events.rows.length - 1].id } : null };
      });
    },
  };
}
