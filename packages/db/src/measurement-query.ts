import { sql } from 'drizzle-orm';
import { conversionMeasurementQuerySchema, conversionMeasurementSchema, type ConversionMeasurement, type ConversionMeasurementQuery } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';

export function createMeasurementQueryRepository(db: Database['db'], existingTx?: DatabaseTransaction) {
  const run = async <T>(query: ConversionMeasurementQuery, fn: (tx: DatabaseTransaction) => Promise<T>) => {
    const scoped = async (tx: DatabaseTransaction) => { await tx.execute(sql`select set_config('kablet.organization_id',${query.organizationId},true),set_config('kablet.business_id',${query.businessId},true)`); return fn(tx); };
    return existingTx ? scoped(existingTx) : db.transaction(scoped);
  };
  return {
    async conversion(queryInput: ConversionMeasurementQuery): Promise<ConversionMeasurement> {
      const query = conversionMeasurementQuerySchema.parse(queryInput);
      return run(query, async tx => {
        const definition = await tx.execute(sql`select id,capability_id,capability_version from conversion_definition_revisions where id=${query.conversionDefinitionId}::uuid and organization_id=${query.organizationId}::uuid and business_id=${query.businessId}::uuid`);
        if (!definition.rows[0]) throw new Error('conversion definition not found');
        const d = definition.rows[0] as Record<string, unknown>;
        const denominator = await tx.execute(sql`select count(distinct f.action_request_id)::int as count from interaction_facts f join action_requests ar on ar.id=f.action_request_id and ar.organization_id=f.organization_id and ar.business_id=f.business_id where f.organization_id=${query.organizationId}::uuid and f.business_id=${query.businessId}::uuid and f.interaction_kind='action_confirmed' and f.action_request_id is not null and ar.capability_id=${d.capability_id}::uuid and ar.capability_version=${d.capability_version} and f.occurred_at>=${query.windowStart} and f.occurred_at<${query.windowEnd}`);
        const numerator = await tx.execute(sql`select count(distinct cf.outcome_id)::int as total,count(distinct case when oa.id is not null then cf.outcome_id end)::int as attributed from conversion_facts cf left join outcome_attributions oa on oa.organization_id=cf.organization_id and oa.business_id=cf.business_id and oa.outcome_id=cf.outcome_id where cf.organization_id=${query.organizationId}::uuid and cf.business_id=${query.businessId}::uuid and cf.conversion_definition_id=${query.conversionDefinitionId}::uuid and cf.occurred_at>=${query.windowStart} and cf.occurred_at<${query.windowEnd}`);
        const eligible = Number((denominator.rows[0] as Record<string, unknown>).count); const conversions = Number((numerator.rows[0] as Record<string, unknown>).total); const attributed = Number((numerator.rows[0] as Record<string, unknown>).attributed); const result = { contractVersion:'conversion-measurement.v1' as const, organizationId:query.organizationId, businessId:query.businessId, conversionDefinitionId:query.conversionDefinitionId, windowStart:query.windowStart, windowEnd:query.windowEnd, denominatorKind:'action_confirmation' as const, eligibleActionConfirmationCount:eligible, conversionCount:conversions, conversionRate:eligible === 0 ? 0 : conversions / eligible, attributedConversionCount:attributed, unattributedConversionCount:conversions-attributed };
        return conversionMeasurementSchema.parse(result);
      });
    },
  };
}
