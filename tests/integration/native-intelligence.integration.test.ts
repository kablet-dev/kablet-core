import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb, createNativeIntelligenceService } from '@kablet/db';
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
});
