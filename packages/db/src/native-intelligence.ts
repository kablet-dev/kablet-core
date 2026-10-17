import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { evaluateNativeCanvasDecision, nativeCanvasSignalSchema, observationSchema, type NativeCanvasSignal } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';
import { createInteractionSessionRepository } from './interaction.js';
import { createVisitorStateRepository } from './visitor-state.js';
import { createNativeExperimentRepository } from './native-experiment.js';

type Context = { organizationId: string; businessId: string; storeId?: string };
export type NativeIntelligenceLineage = {
  visitorIdentityId: string;
  visitorSessionId: string;
  interactionSessionId: string;
  decisionId: string | null;
  exposureId: string | null;
  compositionId: string | null;
  compositionVersion: string | null;
};
type Result = { handle: string | null; composition: 'entry' | 'discovery' | 'comparison'; compositionVersion: 'native-canvas.v1'; decisionId: string; visitorIdentityId: string; visitorSessionId: string; interactionSessionId: string; visitorStateRevisionId: string; exposureId: string; experiment?: { experimentId: string; assignmentId: string; arm: 'control' | 'treatment'; exposureStatus: 'exposed' | 'fallback' | 'noncompliant' } };

function signalIntent(signal: NativeCanvasSignal): 'explore_offerings' | 'select_offering' {
  return signal === 'discovery' ? 'explore_offerings' : 'select_offering';
}
function hashHandle(handle: string): Buffer { return createHash('sha256').update(handle, 'utf8').digest(); }

export function createNativeIntelligenceService(db: Database['db'], context: Context) {
  const visitors = createVisitorStateRepository(db);
  const sessions = createInteractionSessionRepository(db);
  const experiments = createNativeExperimentRepository(db);
  async function scoped<T>(work: (tx: DatabaseTransaction) => Promise<T>) {
    return db.transaction(async tx => {
      await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
      return work(tx);
    });
  }

  return {
    async resolveLineage(handle: string): Promise<NativeIntelligenceLineage | null> {
      return scoped(async tx => {
        const result = await tx.execute(sql`select i.visitor_identity_id, i.visitor_session_id, i.id as interaction_session_id, e.decision_id, e.id as exposure_id, e.composition_id, e.composition_version
          from interaction_sessions i
          left join lateral (
            select e.id, e.decision_id, e.composition_id, e.composition_version
              from experience_exposures e
              join visitor_decisions d on d.organization_id=e.organization_id and d.business_id=e.business_id and d.id=e.decision_id
             where e.organization_id=i.organization_id and e.business_id=i.business_id and e.interaction_session_id=i.id
               and e.composition_version='native-canvas.v1'
               and d.decision_type in ('native_entry','native_discovery','native_comparison')
             order by e.exposure_sequence desc, e.id desc limit 1
          ) e on true
         where i.organization_id=${context.organizationId}::uuid and i.business_id=${context.businessId}::uuid
           and i.handle_hash=${hashHandle(handle)} and i.status='active' and i.expires_at > now()`);
        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        return {
          visitorIdentityId: String(row.visitor_identity_id),
          visitorSessionId: String(row.visitor_session_id),
          interactionSessionId: String(row.interaction_session_id),
          decisionId: row.decision_id ? String(row.decision_id) : null,
          exposureId: row.exposure_id ? String(row.exposure_id) : null,
          compositionId: row.composition_id ? String(row.composition_id) : null,
          compositionVersion: row.composition_version ? String(row.composition_version) : null,
        };
      });
    },
    async resolve(handle: string | null, signal: NativeCanvasSignal | null, idempotencyKey: string): Promise<Result> {
      const parsedSignal = signal === null ? null : nativeCanvasSignalSchema.parse(signal);
      return scoped(async tx => {
        let identity: { visitorIdentityId: string; visitorSessionId: string; interactionSessionId: string; handle: string | null };
        if (handle) {
          const resolved = await sessions.resolve(context.organizationId, context.businessId, handle);
          if (!resolved) throw new Error('native_intelligence_session_expired');
          identity = { ...resolved, handle };
        } else {
          const visitorIdentityId = await createVisitorStateRepository(db, tx).createVisitor(context.organizationId, context.businessId, new Date(Date.now() + 180 * 24 * 60 * 60 * 1000));
          const visitorSessionId = await createVisitorStateRepository(db, tx).createSession(context.organizationId, context.businessId, visitorIdentityId);
          const interaction = await sessions.createWithId(context.organizationId, context.businessId, visitorIdentityId, visitorSessionId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), tx);
          identity = { visitorIdentityId, visitorSessionId, interactionSessionId: interaction.id, handle: interaction.handle };
        }

        const before = await createVisitorStateRepository(db, tx).getCurrentState(context.organizationId, context.businessId, identity.visitorIdentityId);
        if (parsedSignal) {
          const observation = observationSchema.parse({
            id: randomUUID(), organizationId: context.organizationId, businessId: context.businessId,
            visitorIdentityId: identity.visitorIdentityId, sessionId: identity.visitorSessionId,
            expectedVersion: before.version, kind: 'intent.expressed',
            value: { type: 'intent', value: signalIntent(parsedSignal) }, idempotencyKey,
            observedAt: new Date(), sourceType: 'visitor', sourceReference: 'native-canvas', correctionOfObservationId: null,
          });
          await createVisitorStateRepository(db, tx).ingest(context.organizationId, observation, tx);
        }
        const after = await createVisitorStateRepository(db, tx).getCurrentState(context.organizationId, context.businessId, identity.visitorIdentityId);
        const derivedSignal = after.state.intent?.status !== 'withdrawn' && after.state.intent?.status !== 'invalidated'
          ? after.state.intent?.value === 'explore_offerings' ? 'discovery' as const : after.state.intent?.value === 'select_offering' ? 'comparison' as const : null
          : null;
        const effectiveSignal = parsedSignal ?? derivedSignal;
        const decisionKey = parsedSignal ? `native:${idempotencyKey}` : effectiveSignal ? `native:resume:${after.revisionId}` : 'native:baseline';
        // Lock governance only after visitor state is settled. A pause/end
        // update therefore either wins before this read (baseline) or waits
        // until assignment/exposure persistence commits (assignment wins).
        // An already-running response cannot be revoked.
        const activeExperiment = context.storeId
          ? await experiments.getActive({ organizationId: context.organizationId, businessId: context.businessId, storeId: context.storeId }, new Date(), tx)
          : null;
        const assignment = activeExperiment && context.storeId ? await experiments.assign({ organizationId: context.organizationId, businessId: context.businessId, storeId: context.storeId }, activeExperiment, identity.visitorIdentityId, tx) : null;
        const existing = await tx.execute(sql`select id, decision_type from visitor_decisions where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and visitor_identity_id=${identity.visitorIdentityId}::uuid and idempotency_key=${decisionKey}`);
        let decisionId: string;
        let composition: Result['composition'];
        let experimentStatus: 'exposed' | 'fallback' | 'noncompliant' | null = null;
        if (existing.rows[0]) {
          decisionId = String(existing.rows[0].id);
          composition = existing.rows[0].decision_type === 'native_discovery' ? 'discovery' : existing.rows[0].decision_type === 'native_comparison' ? 'comparison' : 'entry';
        } else {
          const evaluated = evaluateNativeCanvasDecision({ signal: effectiveSignal });
          let experimentComposition: Result['composition'] | null = null;
          if (activeExperiment && assignment?.status === 'eligible') {
            experimentComposition = assignment.arm === 'control' ? activeExperiment.controlComposition : activeExperiment.treatmentComposition;
            const productCount = await tx.execute(sql`select count(*)::int as count from kablet_native_products where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId!}::uuid and status='published'`);
            const count = Number((productCount.rows[0] as Record<string, unknown>).count);
            const available = experimentComposition === 'entry' || (experimentComposition === 'discovery' && count >= 1) || (experimentComposition === 'comparison' && count >= 2);
            if (!available) { experimentComposition = 'entry'; experimentStatus = 'fallback'; } else experimentStatus = 'exposed';
          }
          decisionId = randomUUID();
          const inputFingerprint = createHash('sha256').update(JSON.stringify({ signal: effectiveSignal, revision: after.revisionId })).digest('hex');
          composition = experimentComposition ?? evaluated.composition;
          const decisionType = composition === 'discovery' ? 'native_discovery' : composition === 'comparison' ? 'native_comparison' : 'native_entry';
          await tx.execute(sql`insert into visitor_decisions (id,organization_id,business_id,visitor_identity_id,session_id,decision_type,status,contract_version,policy_id,policy_version,visitor_state_revision_id,visitor_state_version,idempotency_key,input_fingerprint,native_experiment_id,native_experiment_assignment_id) values (${decisionId}::uuid,${context.organizationId}::uuid,${context.businessId}::uuid,${identity.visitorIdentityId}::uuid,${identity.visitorSessionId}::uuid,${decisionType},'accepted','decision.v1','native-canvas','native-canvas.v1',${after.revisionId}::uuid,${after.version},${decisionKey},${inputFingerprint},${assignment?.status === 'eligible' ? activeExperiment?.experimentId ?? null : null}::uuid,${assignment?.status === 'eligible' ? assignment?.assignmentId ?? null : null}::uuid)`);
        }
        const exposureKey = `native:${decisionId}`;
        const exposure = await tx.execute(sql`insert into experience_exposures (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,decision_id,exposure_sequence,exposure_kind,composition_id,composition_version,exposure_idempotency_key,exposed_at) select ${randomUUID()}::uuid,${context.organizationId}::uuid,${context.businessId}::uuid,${identity.visitorIdentityId}::uuid,${identity.visitorSessionId}::uuid,${identity.interactionSessionId}::uuid,${decisionId}::uuid,coalesce(max(exposure_sequence),0)+1,'server_response',${composition},'native-canvas.v1',${exposureKey},now() from experience_exposures where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and interaction_session_id=${identity.interactionSessionId}::uuid on conflict (organization_id,business_id,interaction_session_id,exposure_idempotency_key) where exposure_idempotency_key is not null do nothing returning id`);
        const exposureId = exposure.rows[0]?.id ?? (await tx.execute(sql`select id from experience_exposures where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and interaction_session_id=${identity.interactionSessionId}::uuid and exposure_idempotency_key=${exposureKey}`)).rows[0].id;
        if (parsedSignal) await tx.execute(sql`insert into interaction_facts (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,decision_id,exposure_id,interaction_kind,occurred_at,idempotency_key,action_request_id) values (${randomUUID()}::uuid,${context.organizationId}::uuid,${context.businessId}::uuid,${identity.visitorIdentityId}::uuid,${identity.visitorSessionId}::uuid,${identity.interactionSessionId}::uuid,${decisionId}::uuid,${exposureId}::uuid,'native_composition_selected',now(),${idempotencyKey},null) on conflict (organization_id,business_id,interaction_session_id,interaction_kind,idempotency_key) do nothing`);
        const experiment = activeExperiment && assignment?.status === 'eligible' && context.storeId ? await experiments.recordExposure({ organizationId: context.organizationId, businessId: context.businessId, storeId: context.storeId, experimentId: activeExperiment.experimentId, assignmentId: assignment.assignmentId, decisionId, exposureId: String(exposureId), arm: assignment.arm, compositionId: composition, status: experimentStatus ?? 'exposed' }, tx) : null;
        return { handle: identity.handle, composition, compositionVersion: 'native-canvas.v1', decisionId, visitorIdentityId: identity.visitorIdentityId, visitorSessionId: identity.visitorSessionId, interactionSessionId: identity.interactionSessionId, visitorStateRevisionId: after.revisionId, exposureId: String(exposureId), ...(experiment ? { experiment: { experimentId: activeExperiment!.experimentId, assignmentId: experiment.assignmentId, arm: experiment.arm, exposureStatus: experiment.status } } : {}) };
      });
    },
  };
}
