import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { nativeExperimentAssignmentSchema, nativeExperimentCompositionSchema, nativeExperimentExposureSchema, nativeExperimentSchema, type NativeExperiment, type NativeExperimentAssignment, type NativeExperimentComposition, type NativeExperimentExposure } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';
export type { NativeExperiment, NativeExperimentAssignment } from '@kablet/domain';

type Context = { organizationId: string; businessId: string; storeId: string };

function mapExperiment(row: Record<string, unknown>): NativeExperiment {
  return nativeExperimentSchema.parse({
    contractVersion: 'native-experiment.v1', experimentId: row.id, organizationId: row.organization_id, businessId: row.business_id, storeId: row.store_id,
    experimentKey: row.experiment_key, version: row.version, state: row.state, eligibility: row.eligibility,
    controlComposition: row.control_composition, treatmentComposition: row.treatment_composition,
    controlAllocationBps: row.control_allocation_bps, treatmentAllocationBps: row.treatment_allocation_bps,
    startsAt: row.starts_at, endsAt: row.ends_at, attributionWindowDays: row.attribution_window_days,
    attributionRule: row.attribution_rule, primaryMetric: row.primary_metric, guardrailMetrics: row.guardrail_metrics,
    createdBy: row.created_by, approvedBy: row.approved_by, approvedAt: row.approved_at,
  });
}

function mapAssignment(row: Record<string, unknown>): NativeExperimentAssignment {
  return nativeExperimentAssignmentSchema.parse({
    contractVersion: 'native-experiment-assignment.v1', assignmentId: row.id, experimentId: row.experiment_id, visitorIdentityId: row.visitor_identity_id,
    arm: row.arm, hashVersion: row.hash_version, bucket: row.bucket, status: row.status, exclusionReason: row.exclusion_reason, assignedAt: row.assigned_at,
  });
}

function bucketFor(input: Context & { experimentId: string; visitorIdentityId: string }): number {
  const digest = createHash('sha256').update(`native-assignment.v1:${input.organizationId}:${input.businessId}:${input.storeId}:${input.experimentId}:${input.visitorIdentityId}`, 'utf8').digest();
  return digest.readUInt32BE(0) % 10000;
}

async function scoped<T>(db: Database['db'], context: Context, work: (tx: DatabaseTransaction) => Promise<T>, existingTx?: DatabaseTransaction): Promise<T> {
  if (existingTx) {
    await existingTx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
    return work(existingTx);
  }
  return db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
    return work(tx);
  });
}

export function createNativeExperimentRepository(db: Database['db']) {
  return {
    async getActive(context: Context, now = new Date(), existingTx?: DatabaseTransaction): Promise<NativeExperiment | null> {
      return scoped(db, context, async tx => {
        const candidate = await tx.execute(sql`select id from kablet_native_experiments where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid and state='active' and starts_at <= ${now} and (ends_at is null or ends_at > ${now}) order by version desc, id desc limit 1`);
        if (!candidate.rows[0]) return null;
        const experimentId = String((candidate.rows[0] as Record<string, unknown>).id);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${context.organizationId}:${context.businessId}:${context.storeId}:${experimentId}`}, 0))`);
        const result = await tx.execute(sql`select * from kablet_native_experiments where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid and id=${experimentId}::uuid and state='active' and starts_at <= ${now} and (ends_at is null or ends_at > ${now})`);
        return result.rows[0] ? mapExperiment(result.rows[0] as Record<string, unknown>) : null;
      }, existingTx);
    },
    async assign(context: Context, experiment: NativeExperiment, visitorIdentityId: string, existingTx?: DatabaseTransaction): Promise<NativeExperimentAssignment> {
      return scoped(db, context, async tx => {
        const existing = await tx.execute(sql`select * from kablet_native_experiment_assignments where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid and experiment_id=${experiment.experimentId}::uuid and visitor_identity_id=${visitorIdentityId}::uuid`);
        if (existing.rows[0]) return mapAssignment(existing.rows[0] as Record<string, unknown>);
        const productCount = await tx.execute(sql`select count(*)::int as count from kablet_native_products where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid and status='published'`);
        const minimum = experiment.eligibility.minPublishedProducts;
        const eligible = Number((productCount.rows[0] as Record<string, unknown>).count) >= minimum;
        const bucket = bucketFor({ ...context, experimentId: experiment.experimentId, visitorIdentityId });
        const arm = bucket < experiment.controlAllocationBps ? 'control' : 'treatment';
        const assignmentId = randomUUID();
        await tx.execute(sql`insert into kablet_native_experiment_assignments(id,organization_id,business_id,store_id,experiment_id,visitor_identity_id,arm,hash_version,bucket,status,exclusion_reason) values (${assignmentId}::uuid,${context.organizationId}::uuid,${context.businessId}::uuid,${context.storeId}::uuid,${experiment.experimentId}::uuid,${visitorIdentityId}::uuid,${arm},'sha256-bucket.v1',${bucket},${eligible ? 'eligible' : 'ineligible'},${eligible ? null : `published_product_count_below_${minimum}`}) on conflict (organization_id,business_id,store_id,experiment_id,visitor_identity_id) do nothing`);
        const assigned = await tx.execute(sql`select * from kablet_native_experiment_assignments where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid and experiment_id=${experiment.experimentId}::uuid and visitor_identity_id=${visitorIdentityId}::uuid`);
        return mapAssignment(assigned.rows[0] as Record<string, unknown>);
      }, existingTx);
    },
    async recordExposure(input: Context & { experimentId: string; assignmentId: string; decisionId: string; exposureId: string; arm: 'control' | 'treatment'; compositionId: NativeExperimentComposition; status: 'exposed' | 'fallback' | 'noncompliant' }, existingTx?: DatabaseTransaction): Promise<NativeExperimentExposure> {
      return scoped(db, input, async tx => {
        const id = randomUUID();
        await tx.execute(sql`insert into kablet_native_experiment_exposures(id,organization_id,business_id,store_id,experiment_id,assignment_id,decision_id,exposure_id,arm,composition_id,status) values (${id}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.storeId}::uuid,${input.experimentId}::uuid,${input.assignmentId}::uuid,${input.decisionId}::uuid,${input.exposureId}::uuid,${input.arm},${input.compositionId},${input.status}) on conflict (organization_id,business_id,store_id,assignment_id,exposure_id) do nothing`);
        const row = await tx.execute(sql`select * from kablet_native_experiment_exposures where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and store_id=${input.storeId}::uuid and assignment_id=${input.assignmentId}::uuid and exposure_id=${input.exposureId}::uuid`);
        const value = row.rows[0] as Record<string, unknown>;
        return nativeExperimentExposureSchema.parse({ contractVersion: 'native-experiment-exposure.v1', exposureId: value.id, assignmentId: value.assignment_id, arm: value.arm, compositionId: value.composition_id, status: value.status, observedAt: value.observed_at });
      }, existingTx);
    },
    async results(input: Context & { experimentId: string; windowStart: Date; windowEnd: Date }) {
      return scoped(db, input, async tx => {
        const result = await tx.execute(sql`select a.arm, a.status as assignment_status, count(distinct a.visitor_identity_id)::int as assigned_visitors, count(distinct case when e.status='exposed' then a.visitor_identity_id end)::int as exposed_visitors, count(distinct case when o.id is not null then a.visitor_identity_id end)::int as verified_purchasers, count(distinct o.id)::int as verified_purchase_count, coalesce(sum(case when o.id is not null then o.total_amount_minor else 0 end),0)::text as verified_revenue_minor, o.currency from kablet_native_experiment_assignments a left join kablet_native_experiment_exposures e on e.organization_id=a.organization_id and e.business_id=a.business_id and e.store_id=a.store_id and e.assignment_id=a.id left join kablet_native_order_attributions oa on oa.organization_id=a.organization_id and oa.business_id=a.business_id and oa.store_id=a.store_id and oa.exposure_id=e.exposure_id and oa.status in ('linked','partial') and oa.purchase_at>=${input.windowStart} and oa.purchase_at<${input.windowEnd} left join kablet_native_orders o on o.id=oa.order_id where a.organization_id=${input.organizationId}::uuid and a.business_id=${input.businessId}::uuid and a.store_id=${input.storeId}::uuid and a.experiment_id=${input.experimentId}::uuid group by a.arm, a.status, o.currency order by a.arm, o.currency`);
        return result.rows.map(row => { const value = row as Record<string, unknown>; const assigned = Number(value.assigned_visitors); return { arm: String(value.arm), assignmentStatus: String(value.assignment_status), assignedVisitors: assigned, exposedVisitors: Number(value.exposed_visitors), verifiedPurchasers: Number(value.verified_purchasers), verifiedPurchaseCount: Number(value.verified_purchase_count), currency: value.currency === null ? null : String(value.currency), verifiedRevenueMinor: String(value.verified_revenue_minor), conversionRate: assigned === 0 ? 0 : Number(value.verified_purchasers) / assigned, revenuePerAssignedVisitorMinor: assigned === 0 ? '0' : (BigInt(String(value.verified_revenue_minor)) / BigInt(assigned)).toString() }; });
      });
    },
  };
}
