import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb, createNativeExperimentRepository, createNativeIntelligenceService } from '@kablet/db';
import { provisionBrowserDatabase } from '../e2e/support/disposable-postgres';

const discoveryKey = `${'A'.repeat(42)}1`;
const comparisonKey = `${'A'.repeat(42)}2`;

describe('native intelligence bridge PostgreSQL boundary', () => {
  it('persists isolated sessions, governed native decisions, exposure lineage, and idempotent signals', async () => {
    const fixture = await provisionBrowserDatabase();
    const runtime = createDb(fixture.runtimeUrl);
    try {
      const service = createNativeIntelligenceService(runtime.db, { organizationId: fixture.organizationId, businessId: fixture.businessId });
      const first = await service.resolve(null, null, discoveryKey);
      const second = await service.resolve(null, null, discoveryKey);
      expect(first.composition).toBe('entry');
      expect(second.composition).toBe('entry');
      const discovery = await service.resolve(first.handle, 'discovery', discoveryKey);
      expect(discovery.composition).toBe('discovery');
      const replay = await service.resolve(first.handle, 'discovery', discoveryKey);
      expect(replay.decisionId).toBe(discovery.decisionId);
      await expect(service.resolve(first.handle, 'comparison', discoveryKey)).rejects.toThrow('observation idempotency key conflicts');
      const comparison = await service.resolve(null, 'comparison', comparisonKey);
      expect(comparison.composition).toBe('comparison');
      const rows = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${fixture.organizationId},true),set_config('kablet.business_id',${fixture.businessId},true)`); return tx.execute(sql`select decision_type from visitor_decisions where organization_id=${fixture.organizationId}::uuid and business_id=${fixture.businessId}::uuid order by created_at`); });
      expect(rows.rows.map(row => row.decision_type)).toEqual(expect.arrayContaining(['native_entry', 'native_discovery', 'native_comparison']));
    } finally { await runtime.pool.end(); await fixture.cleanup(); }
  }, 90000);

  it('assigns eligible visitors deterministically and preserves arms through intent changes', async () => {
    const fixture = await provisionBrowserDatabase();
    const runtime = createDb(fixture.runtimeUrl);
    try {
      const service = createNativeIntelligenceService(runtime.db, { organizationId: fixture.organizationId, businessId: fixture.nativeExperimentBusinessId, storeId: fixture.nativeExperimentStoreId });
      const first = await service.resolve(null, null, `${'B'.repeat(42)}1`);
      const firstRepeat = await service.resolve(first.handle, 'comparison', `${'B'.repeat(42)}2`);
      expect(firstRepeat.experiment?.assignmentId).toBe(first.experiment?.assignmentId);
      expect(firstRepeat.experiment?.arm).toBe(first.experiment?.arm);
      let other = await service.resolve(null, null, `${'C'.repeat(42)}1`);
      for (let index = 2; index < 24 && other.experiment?.arm === first.experiment?.arm; index += 1) other = await service.resolve(null, null, `${'C'.repeat(41)}${String(index).padStart(2, '0')}`);
      expect(other.experiment?.assignmentId).not.toBe(first.experiment?.assignmentId);
      const rows = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${fixture.organizationId},true),set_config('kablet.business_id',${fixture.nativeExperimentBusinessId},true)`); return tx.execute(sql`select arm, status, count(*)::int as count from kablet_native_experiment_assignments group by arm,status`); });
      expect(Number(rows.rows.reduce((total, row) => total + Number(row.count), 0))).toBeGreaterThanOrEqual(2);
      expect(rows.rows.every(row => row.status === 'eligible')).toBe(true);
    } finally { await runtime.pool.end(); await fixture.cleanup(); }
  }, 90000);

  it('keeps assigned non-purchasers in the results denominator and isolates the query', async () => {
    const fixture = await provisionBrowserDatabase();
    const runtime = createDb(fixture.runtimeUrl);
    try {
      const service = createNativeIntelligenceService(runtime.db, { organizationId: fixture.organizationId, businessId: fixture.nativeExperimentBusinessId, storeId: fixture.nativeExperimentStoreId });
      const first = await service.resolve(null, null, `${'D'.repeat(42)}1`);
      const second = await service.resolve(null, null, `${'E'.repeat(42)}1`);
      const experimentId = first.experiment!.experimentId;
      await fixture.clearNativeExperimentExposure(second.experiment!.assignmentId);
      const repository = createNativeExperimentRepository(runtime.db);
      const input = { organizationId: fixture.organizationId, businessId: fixture.nativeExperimentBusinessId, storeId: fixture.nativeExperimentStoreId, experimentId, windowStart: new Date(Date.now() - 60_000), windowEnd: new Date(Date.now() + 60_000) };
      const results = await repository.results(input);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.reduce((total, row) => total + row.assignedVisitors, 0)).toBe(2);
      expect(results.reduce((total, row) => total + row.exposedVisitors, 0)).toBe(1);
      expect(results.every(row => row.verifiedPurchasers === 0 && row.verifiedPurchaseCount === 0 && row.verifiedRevenueMinor === '0')).toBe(true);
      expect(await repository.results(input)).toEqual(results);
      await expect(repository.results({ ...input, businessId: fixture.businessId })).resolves.toEqual([]);
    } finally { await runtime.pool.end(); await fixture.cleanup(); }
  }, 90000);

  it('serializes pause state with assignment and rejects forged exposure lineage', async () => {
    const fixture = await provisionBrowserDatabase();
    const runtime = createDb(fixture.runtimeUrl);
    try {
      const service = createNativeIntelligenceService(runtime.db, { organizationId: fixture.organizationId, businessId: fixture.nativeExperimentBusinessId, storeId: fixture.nativeExperimentStoreId });
      const beforePause = await service.resolve(null, 'discovery', `${'F'.repeat(42)}1`);
      expect(beforePause.experiment).toBeDefined();
      let releaseGovernanceLock!: () => void;
      const governanceLock = new Promise<void>(resolve => { releaseGovernanceLock = resolve; });
      const blocker = runtime.db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${fixture.organizationId}:${fixture.nativeExperimentBusinessId}:${fixture.nativeExperimentStoreId}:${beforePause.experiment!.experimentId}`}, 0))`);
        await governanceLock;
      });
      const assignmentWins = service.resolve(null, 'discovery', `${'H'.repeat(42)}1`);
      await new Promise(resolve => setTimeout(resolve, 100));
      const pauseAfterAssignmentRequest = fixture.setNativeExperimentState(beforePause.experiment!.experimentId, 'paused');
      releaseGovernanceLock();
      expect((await assignmentWins).experiment).toBeDefined();
      await pauseAfterAssignmentRequest;
      await blocker;
      const afterPause = await service.resolve(null, 'discovery', `${'G'.repeat(42)}1`);
      expect(afterPause.experiment).toBeUndefined();

      const rows = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${fixture.organizationId},true),set_config('kablet.business_id',${fixture.nativeExperimentBusinessId},true)`);
        return tx.execute(sql`select assignment_id, experiment_id, decision_id, exposure_id, arm, composition_id from kablet_native_experiment_exposures limit 1`);
      });
      const exposure = rows.rows[0] as Record<string, string>;
      await expect(runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${fixture.organizationId},true),set_config('kablet.business_id',${fixture.nativeExperimentBusinessId},true)`);
        await tx.execute(sql`insert into kablet_native_experiment_exposures(id,organization_id,business_id,store_id,experiment_id,assignment_id,decision_id,exposure_id,arm,composition_id,status) values (gen_random_uuid(),${fixture.organizationId}::uuid,${fixture.nativeExperimentBusinessId}::uuid,${fixture.nativeExperimentStoreId}::uuid,${exposure.experiment_id}::uuid,${exposure.assignment_id}::uuid,${exposure.decision_id}::uuid,${exposure.exposure_id}::uuid,${exposure.arm === 'control' ? 'treatment' : 'control'},${exposure.composition_id},'exposed')`);
      })).rejects.toThrow();
    } finally { await runtime.pool.end(); await fixture.cleanup(); }
  }, 90000);
});
