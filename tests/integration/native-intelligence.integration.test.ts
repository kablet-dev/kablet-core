import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { createDb, createNativeEvidenceRepository, createNativeExperimentRepository, createNativeIntelligenceService, createNativeRuleRepository } from '@kablet/db';
import { interpretNativeText } from '../../apps/web/lib/native-ai-interpreter';
import { routeNativeInterpretation } from '@kablet/domain';
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

  it('derives bounded guidance from tenant-scoped catalog and policy truth', async () => {
    const fixture = await provisionBrowserDatabase();
    const runtime = createDb(fixture.runtimeUrl);
    try {
      const service = createNativeIntelligenceService(runtime.db, { organizationId: fixture.organizationId, businessId: fixture.nativeExperimentBusinessId, storeId: fixture.nativeExperimentStoreId });
      const initial = await service.resolve(null, 'discovery', `${'J'.repeat(42)}1`, { mode: 'discovery', preference: null, productId: null });
      expect(initial.guidance?.contractVersion).toBe('native-guidance.v1');
      expect(initial.guidance?.options.length).toBeGreaterThan(0);
      const available = await service.resolve(initial.handle, 'discovery', `${'J'.repeat(42)}2`, { mode: 'discovery', preference: 'available', productId: null });
      expect(available.guidance?.products.length).toBeGreaterThan(0);
      expect(available.guidance?.products.every(product => product.availability === 'available')).toBe(true);
      const reassurance = await service.resolve(initial.handle, null, `${'J'.repeat(42)}3`, { mode: 'reassurance', preference: null, productId: null });
      expect(reassurance.guidance?.mode).toBe('reassurance');
      expect(reassurance.guidance?.fallback).toBe(true);
      expect(reassurance.guidance?.facts).toContain('No single active checkout policy is available for this store and currency.');
      expect(reassurance.decisionId).toBeTruthy();
      await expect(service.resolve(initial.handle, 'discovery', `${'J'.repeat(42)}4`, { mode: 'product', preference: null, productId: '00000000-0000-4000-8000-000000000099' })).resolves.toMatchObject({ guidance: { fallback: true } });
      await expect(service.resolve(initial.handle, 'discovery', `${'J'.repeat(42)}5`, { mode: 'discovery', preference: null, productId: null })).resolves.toMatchObject({ guidance: { contractVersion: 'native-guidance.v1' } });
    } finally { await runtime.pool.end(); await fixture.cleanup(); }
  }, 90000);

  it('covers preference, returning context, purchase readiness, and unknown inventory safely', async () => {
    const fixture = await provisionBrowserDatabase();
    const runtime = createDb(fixture.runtimeUrl);
    try {
      const service = createNativeIntelligenceService(runtime.db, { organizationId: fixture.organizationId, businessId: fixture.businessId, storeId: fixture.nativeStoreId });
      const initial = await service.resolve(null, 'discovery', `${'K'.repeat(42)}1`, { mode: 'discovery', preference: null, productId: null });
      const available = await service.resolve(initial.handle, 'discovery', `${'K'.repeat(42)}2`, { mode: 'discovery', preference: 'available', productId: null });
      expect(available.rule).toMatchObject({ ruleKey: 'native.discovery.available', reasonCode: 'merchant_truth_match' });
      expect(available.guidance?.products.every(product => product.availability === 'available')).toBe(true);
      const ready = await service.resolve(initial.handle, null, `${'K'.repeat(42)}3`, { mode: 'purchase_readiness', preference: null, productId: fixture.nativeVisibleProductId });
      expect(ready.rule).toMatchObject({ ruleKey: 'native.purchase-readiness', composition: 'discovery' });
      expect(ready.guidance).toMatchObject({ mode: 'purchase_readiness', fallback: false });
      expect(ready.guidance?.facts.join(' ')).toContain('authorized cart flow');
      const readyRepeat = await service.resolve(initial.handle, null, `${'K'.repeat(42)}3`, { mode: 'purchase_readiness', preference: null, productId: fixture.nativeVisibleProductId });
      expect(readyRepeat.decisionId).toBe(ready.decisionId);
      const unknown = await service.resolve(initial.handle, null, `${'K'.repeat(42)}4`, { mode: 'purchase_readiness', preference: null, productId: fixture.nativeUnknownInventoryProductId });
      expect(unknown.guidance).toMatchObject({ mode: 'purchase_readiness', fallback: true });
      expect(unknown.guidance?.facts.join(' ')).toContain('not confirmed');
      const resumed = await service.resolve(initial.handle, null, `${'K'.repeat(42)}5`, { mode: 'discovery', preference: null, productId: null });
      expect(resumed.rule).toMatchObject({ ruleKey: 'native.discovery', version: 1 });
      const comparison = await service.resolve(initial.handle, 'comparison', `${'K'.repeat(42)}6`, { mode: 'comparison', preference: null, productId: null });
      expect(comparison.composition).toBe('comparison');
      expect(comparison.rule?.ruleKey).toBe('native.comparison');
    } finally { await runtime.pool.end(); await fixture.cleanup(); }
  }, 90000);

  it('routes ambiguous text through the durable provider boundary and back into the governed canvas', async () => {
    const fixture = await provisionBrowserDatabase();
    const runtime = createDb(fixture.runtimeUrl);
    try {
      const service = createNativeIntelligenceService(runtime.db, { organizationId: fixture.organizationId, businessId: fixture.businessId, storeId: fixture.nativeStoreId });
      const initial = await service.resolve(null, null, `${'L'.repeat(42)}1`);
      const lineage = await service.resolveLineage(initial.handle!);
      expect(lineage).toBeTruthy();
      const daily = randomUUID();
      const monthly = randomUUID();
      await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${fixture.organizationId},true),set_config('kablet.business_id',${fixture.businessId},true)`);
        await tx.execute(sql`insert into ai_intent_accounting_periods(id,organization_id,business_id,period_kind,period_start,period_end,max_units) values (${daily}::uuid,${fixture.organizationId}::uuid,${fixture.businessId}::uuid,'daily',current_date,current_date+1,10),(${monthly}::uuid,${fixture.organizationId}::uuid,${fixture.businessId}::uuid,'monthly',date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month')::date,10)`);
      });
      let providerCalls = 0;
      const interpretation = await interpretNativeText({
        db: runtime.db, organizationId: fixture.organizationId, businessId: fixture.businessId,
        visitorIdentityId: lineage!.visitorIdentityId, visitorSessionId: lineage!.visitorSessionId, interactionSessionId: lineage!.interactionSessionId,
        idempotencyKey: `${'M'.repeat(42)}1`, text: 'I am not sure which direction is right for me.', policyRevisionId: null,
        env: { KABLET_AI_INTERPRETATION_ENABLED: 'true', KABLET_AI_PROVIDER_API_KEY: 'test-only', KABLET_AI_PROVIDER_MODEL: 'mock' },
        fetcher: (async () => { providerCalls += 1; return new Response(JSON.stringify({ id: 'mock-request-1', choices: [{ message: { content: JSON.stringify({ contractVersion: 'intent-interpretation.v1', normalizedIntent: 'select_offering', reasonCode: 'intent_extracted', confidence: 0.91, interpreterVersion: 'mock.v1' }) } }] }), { status: 200 }); }) as typeof fetch,
      });
      expect(providerCalls).toBe(1);
      expect(interpretation.source).toBe('provider');
      const routed = routeNativeInterpretation(interpretation.output);
      const result = await service.resolve(initial.handle, routed.signal, `${'M'.repeat(42)}2`, routed.guidance);
      expect(result.composition).toBe('comparison');
      const persisted = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${fixture.organizationId},true),set_config('kablet.business_id',${fixture.businessId},true)`); return tx.execute(sql`select status,normalized_intent,confidence,visitor_identity_id,visitor_session_id from ai_intent_invocations where interaction_session_id=${lineage!.interactionSessionId}::uuid`); });
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0]).toMatchObject({ status: 'succeeded', normalized_intent: 'select_offering', visitor_identity_id: lineage!.visitorIdentityId, visitor_session_id: lineage!.visitorSessionId });
      const providerResponse = (content: string) => (async () => new Response(JSON.stringify({ id: 'mock-request-diagnostic', choices: [{ message: { content } }] }), { status: 200 })) as typeof fetch;
      const nullableConfidence = await interpretNativeText({
        db: runtime.db, organizationId: fixture.organizationId, businessId: fixture.businessId,
        visitorIdentityId: lineage!.visitorIdentityId, visitorSessionId: lineage!.visitorSessionId, interactionSessionId: lineage!.interactionSessionId,
        idempotencyKey: `${'Q'.repeat(42)}1`, text: 'I am uncertain about my next step.', policyRevisionId: null,
        env: { KABLET_AI_INTERPRETATION_ENABLED: 'true', KABLET_AI_PROVIDER_API_KEY: 'test-only', KABLET_AI_PROVIDER_MODEL: 'mock' },
        fetcher: providerResponse(JSON.stringify({ contractVersion: 'intent-interpretation.v1', normalizedIntent: 'unclear', reasonCode: 'ambiguous', confidence: null, interpreterVersion: 'mock.v1' })),
      });
      expect(nullableConfidence).toMatchObject({ source: 'provider', output: { normalizedIntent: 'unclear', confidence: null } });
      const malformedJson = await interpretNativeText({
        db: runtime.db, organizationId: fixture.organizationId, businessId: fixture.businessId,
        visitorIdentityId: lineage!.visitorIdentityId, visitorSessionId: lineage!.visitorSessionId, interactionSessionId: lineage!.interactionSessionId,
        idempotencyKey: `${'Q'.repeat(42)}2`, text: 'I am uncertain about my next step.', policyRevisionId: null,
        env: { KABLET_AI_INTERPRETATION_ENABLED: 'true', KABLET_AI_PROVIDER_API_KEY: 'test-only', KABLET_AI_PROVIDER_MODEL: 'mock' },
        fetcher: providerResponse('{not-json'),
      });
      expect(malformedJson).toMatchObject({ source: 'fallback', fallbackReason: 'unclear', providerDiagnostic: { category: 'invalid_output', stage: 'json', reason: 'malformed_json' } });
      const invalidSchema = await interpretNativeText({
        db: runtime.db, organizationId: fixture.organizationId, businessId: fixture.businessId,
        visitorIdentityId: lineage!.visitorIdentityId, visitorSessionId: lineage!.visitorSessionId, interactionSessionId: lineage!.interactionSessionId,
        idempotencyKey: `${'Q'.repeat(42)}3`, text: 'I am uncertain about my next step.', policyRevisionId: null,
        env: { KABLET_AI_INTERPRETATION_ENABLED: 'true', KABLET_AI_PROVIDER_API_KEY: 'test-only', KABLET_AI_PROVIDER_MODEL: 'mock' },
        fetcher: providerResponse(JSON.stringify({ contractVersion: 'intent-interpretation.v1', normalizedIntent: 'invented_intent', reasonCode: 'intent_extracted', confidence: 0.5, interpreterVersion: 'mock.v1' })),
      });
      expect(invalidSchema).toMatchObject({ source: 'fallback', fallbackReason: 'unclear', providerDiagnostic: { category: 'invalid_output', stage: 'schema', reason: 'schema_validation' } });
      const unauthorizedService = createNativeIntelligenceService(runtime.db, { organizationId: fixture.organizationId, businessId: fixture.nativeExperimentBusinessId, storeId: fixture.nativeExperimentStoreId });
      const unauthorizedInitial = await unauthorizedService.resolve(null, null, `${'O'.repeat(42)}1`);
      const unauthorizedLineage = await unauthorizedService.resolveLineage(unauthorizedInitial.handle!);
      expect(unauthorizedLineage).toBeTruthy();
      let unauthorizedProviderCalls = 0;
      const unauthorized = await interpretNativeText({
        db: runtime.db, organizationId: fixture.organizationId, businessId: fixture.nativeExperimentBusinessId,
        visitorIdentityId: unauthorizedLineage!.visitorIdentityId, visitorSessionId: unauthorizedLineage!.visitorSessionId, interactionSessionId: unauthorizedLineage!.interactionSessionId,
        idempotencyKey: `${'P'.repeat(42)}1`, text: 'I am not sure which direction is right for me.', policyRevisionId: null,
        env: { KABLET_AI_INTERPRETATION_ENABLED: 'true', KABLET_AI_PROVIDER_API_KEY: 'test-only', KABLET_AI_PROVIDER_MODEL: 'mock' },
        fetcher: (async () => { unauthorizedProviderCalls += 1; return new Response('{}', { status: 200 }); }) as typeof fetch,
      });
      expect(unauthorizedProviderCalls).toBe(0);
      expect(unauthorized).toMatchObject({ source: 'fallback', fallbackReason: 'unclear', routingDiagnostic: { stage: 'eligibility', reason: 'accounting_period_missing' } });
      const rejected = await interpretNativeText({
        db: runtime.db, organizationId: fixture.organizationId, businessId: fixture.businessId,
        visitorIdentityId: lineage!.visitorIdentityId, visitorSessionId: lineage!.visitorSessionId, interactionSessionId: lineage!.interactionSessionId,
        idempotencyKey: `${'N'.repeat(42)}1`, text: 'I need help deciding between these routines.', policyRevisionId: null,
        env: { KABLET_AI_INTERPRETATION_ENABLED: 'true', KABLET_AI_PROVIDER_API_KEY: 'test-only', KABLET_AI_PROVIDER_MODEL: 'mock' },
        fetcher: (async () => new Response(JSON.stringify({ error: { type: 'rate_limit' } }), { status: 429 })) as typeof fetch,
      });
      expect(rejected).toMatchObject({ source: 'fallback', fallbackReason: 'unavailable', providerDiagnostic: { category: 'http_error', status: 429 } });
    } finally { await runtime.pool.end(); await fixture.cleanup(); }
  }, 90000);

  it('records bounded session evidence with lineage, idempotency, review ordering, and tenant isolation', async () => {
    const fixture = await provisionBrowserDatabase();
    const runtime = createDb(fixture.runtimeUrl);
    try {
      const service = createNativeIntelligenceService(runtime.db, { organizationId: fixture.organizationId, businessId: fixture.businessId, storeId: fixture.nativeStoreId });
      const result = await service.resolve(null, 'discovery', `${'E'.repeat(42)}1`);
      const evidence = createNativeEvidenceRepository(runtime.db);
      const lineage = { organizationId: fixture.organizationId, businessId: fixture.businessId, storeId: fixture.nativeStoreId, visitorIdentityId: result.visitorIdentityId, visitorSessionId: result.visitorSessionId, interactionSessionId: result.interactionSessionId, visitorStateRevisionId: result.visitorStateRevisionId, decisionId: result.decisionId, exposureId: result.exposureId, ruleKey: result.rule?.ruleKey ?? null, ruleVersion: result.rule?.version ?? null, decisionReason: result.rule?.reason ?? null };
      const started = await evidence.append(lineage, { eventKind: 'session_started', idempotencyKey: 'evidence-start-1', metadata: { composition: result.composition } });
      const replay = await evidence.append(lineage, { eventKind: 'session_started', idempotencyKey: 'evidence-start-1', metadata: { composition: result.composition } });
      await evidence.append(lineage, { eventKind: 'product_viewed', idempotencyKey: 'evidence-product-1', metadata: { productId: fixture.nativeVisibleProductId } });
      await evidence.append(lineage, { eventKind: 'ai_interpretation', idempotencyKey: 'evidence-ai-1', metadata: { source: 'fallback', reason: 'disabled' } });
      expect(started.inserted).toBe(true);
      expect(replay.inserted).toBe(false);
      const timeline = await evidence.getTimeline({ organizationId: fixture.organizationId, businessId: fixture.businessId, storeId: fixture.nativeStoreId }, result.visitorSessionId);
      expect(timeline.events.map(item => item.event.eventKind)).toEqual(['ai_interpretation', 'product_viewed', 'session_started']);
      expect(timeline.events[1].event.decisionId).toBe(result.decisionId);
      expect(timeline.events[1].lineage.selectedRuleKey).toBe(result.rule?.ruleKey);
      expect(timeline.verifiedOutcomes).toHaveLength(0);
      const isolated = await evidence.getTimeline({ organizationId: fixture.organizationId, businessId: fixture.nativeExperimentBusinessId, storeId: fixture.nativeExperimentStoreId }, result.visitorSessionId);
      expect(isolated.events).toHaveLength(0);
      await expect(evidence.append(lineage, { eventKind: 'intent_submitted', idempotencyKey: 'evidence-sensitive-1', metadata: { rawText: 'x'.repeat(2001) } })).rejects.toThrow();
    } finally { await runtime.pool.end(); await fixture.cleanup(); }
  }, 90000);

  it('publishes versioned rules, records the selected rule, and rolls back safely', async () => {
    const fixture = await provisionBrowserDatabase();
    const runtime = createDb(fixture.runtimeUrl);
    const control = createDb(fixture.controlUrl);
    try {
      const repository = createNativeRuleRepository(control.db);
      const scope = { organizationId: fixture.organizationId, businessId: fixture.businessId, storeId: fixture.nativeStoreId };
      const actorId = randomUUID();
      const definition = { ...scope, ruleKey: 'integration.discovery', version: 1, priority: 1000, conditions: { intent: 'discovery' as const, preference: null, requiresAvailableInventory: true }, composition: 'discovery' as const, reasonCode: 'explicit_intent' as const, reason: 'The visitor selected the published discovery path.', createdBy: actorId };
      await expect(createNativeRuleRepository(runtime.db).createDraft(definition)).rejects.toMatchObject({ cause: { code: '42501' } });
      const controlRun = <T>(work: (tx: Parameters<Parameters<typeof control.db.transaction>[0]>[0]) => Promise<T>) => control.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${fixture.organizationId},true),set_config('kablet.business_id',${fixture.businessId},true)`); return work(tx); });
      const draft = await controlRun(async tx => {
        const created = await repository.createDraft(definition, tx);
        expect(created.status).toBe('draft');
        expect((await repository.validate(scope, created.ruleId, actorId, tx)).status).toBe('validated');
        expect((await repository.approve(scope, created.ruleId, actorId, tx)).status).toBe('approved');
        return repository.activate(scope, created.ruleId, actorId, tx);
      });
      const active = draft;
      expect(active.status).toBe('active');

      await controlRun(async tx => {
        const tie = await repository.createDraft({ ...definition, ruleKey: 'integration.discovery-low', priority: 1000 }, tx);
        await repository.validate(scope, tie.ruleId, actorId, tx);
        await repository.approve(scope, tie.ruleId, actorId, tx);
        await repository.activate(scope, tie.ruleId, actorId, tx);
      });

      const service = createNativeIntelligenceService(runtime.db, scope);
      const result = await service.resolve(null, 'discovery', `${'R'.repeat(42)}1`);
      expect(result.rule).toMatchObject({ ruleKey: 'integration.discovery', version: 1, composition: 'discovery', reasonCode: 'explicit_intent' });
      const decision = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${fixture.organizationId},true),set_config('kablet.business_id',${fixture.businessId},true)`);
        return tx.execute(sql`select native_store_id,native_rule_id,native_rule_version,native_rule_reason_code,native_rule_reason from visitor_decisions where id=${result.decisionId}::uuid`);
      });
      expect(decision.rows[0]).toMatchObject({ native_store_id: fixture.nativeStoreId, native_rule_id: draft.ruleId, native_rule_version: 1, native_rule_reason_code: 'explicit_intent' });

      const versionTwo = await controlRun(async tx => {
        const created = await repository.createDraft({ ...definition, version: 2, reason: 'The visitor selected the latest published discovery path.' }, tx);
        await repository.validate(scope, created.ruleId, actorId, tx);
        await repository.approve(scope, created.ruleId, actorId, tx);
        expect((await repository.activate(scope, created.ruleId, actorId, tx)).status).toBe('active');
        return created;
      });
      expect((await controlRun(tx => repository.rollback(scope, 'integration.discovery', 1, actorId, tx))).status).toBe('active');
      expect((await controlRun(tx => repository.get(scope, versionTwo.ruleId, tx)))?.status).toBe('rolled_back');
      expect((await controlRun(tx => repository.disable(scope, draft.ruleId, actorId, tx))).status).toBe('disabled');
      await expect(controlRun(tx => repository.activate(scope, draft.ruleId, actorId, tx))).rejects.toThrow('must be approved');
    } finally { await control.pool.end(); await runtime.pool.end(); await fixture.cleanup(); }
  }, 90000);
});
