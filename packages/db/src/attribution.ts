import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { attributionSchema, type Attribution } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';

export function createAttributionRepository(db: Database['db'], existingTx?: DatabaseTransaction) {
  const run = async <T>(organizationId: string, businessId: string, fn: (tx: DatabaseTransaction) => Promise<T>) => {
    const scoped = async (tx: DatabaseTransaction) => {
      await tx.execute(sql`select set_config('kablet.organization_id',${organizationId},true),set_config('kablet.business_id',${businessId},true)`);
      return fn(tx);
    };
    return existingTx ? scoped(existingTx) : db.transaction(scoped);
  };
  const map = (row: Record<string, unknown>): Attribution => attributionSchema.parse({
    contractVersion: 'attribution.v1', id: row.id, organizationId: row.organization_id, businessId: row.business_id,
    outcomeId: row.outcome_id, acquisitionContextId: row.acquisition_context_id, interactionSessionId: row.interaction_session_id,
    rule: row.rule, attributedAt: row.attributed_at,
  });
  return {
    async attributeVerifiedOutcome(organizationId: string, businessId: string, outcomeId: string): Promise<Attribution | null> {
      return run(organizationId, businessId, async tx => {
        const lineage = await tx.execute(sql`select o.id as outcome_id, ac.id as acquisition_context_id, e.interaction_session_id
          from action_outcomes o
          join action_requests ar on ar.id=o.action_request_id and ar.organization_id=o.organization_id and ar.business_id=o.business_id
          join interaction_facts f on f.action_request_id=ar.id and f.organization_id=ar.organization_id and f.business_id=ar.business_id and f.interaction_kind='action_confirmed'
          join experience_exposures e on e.id=f.exposure_id and e.organization_id=f.organization_id and e.business_id=f.business_id and e.interaction_session_id=f.interaction_session_id
          join acquisition_contexts ac on ac.organization_id=e.organization_id and ac.business_id=e.business_id and ac.interaction_session_id=e.interaction_session_id
          where o.id=${outcomeId}::uuid and o.organization_id=${organizationId}::uuid and o.business_id=${businessId}::uuid and o.status='verified'
          order by f.occurred_at asc limit 1`);
        if (!lineage.rows[0]) return null;
        const row = lineage.rows[0] as Record<string, unknown>;
        const id = randomUUID();
        const inserted = await tx.execute(sql`insert into outcome_attributions (id,organization_id,business_id,outcome_id,acquisition_context_id,interaction_session_id,rule,attributed_at)
          values (${id}::uuid,${organizationId}::uuid,${businessId}::uuid,${row.outcome_id}::uuid,${row.acquisition_context_id}::uuid,${row.interaction_session_id}::uuid,'same_interaction_acquisition.v1',now())
          on conflict (organization_id,business_id,outcome_id) do nothing returning *`);
        if (inserted.rows[0]) return map(inserted.rows[0] as Record<string, unknown>);
        const existing = await tx.execute(sql`select * from outcome_attributions where organization_id=${organizationId}::uuid and business_id=${businessId}::uuid and outcome_id=${outcomeId}::uuid`);
        return existing.rows[0] ? map(existing.rows[0] as Record<string, unknown>) : null;
      });
    },
    async getByOutcome(organizationId: string, businessId: string, outcomeId: string): Promise<Attribution | null> {
      return run(organizationId, businessId, async tx => {
        const result = await tx.execute(sql`select * from outcome_attributions where organization_id=${organizationId}::uuid and business_id=${businessId}::uuid and outcome_id=${outcomeId}::uuid`);
        return result.rows[0] ? map(result.rows[0] as Record<string, unknown>) : null;
      });
    },
  };
}
