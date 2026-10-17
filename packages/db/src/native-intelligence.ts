import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { evaluateNativeCanvasDecision, nativeCanvasSignalSchema, observationSchema, type NativeCanvasSignal } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';
import { createInteractionSessionRepository } from './interaction.js';
import { createVisitorStateRepository } from './visitor-state.js';

type Context = { organizationId: string; businessId: string };
type Result = { handle: string | null; composition: 'entry' | 'discovery' | 'comparison'; compositionVersion: 'native-canvas.v1'; decisionId: string; visitorIdentityId: string; visitorSessionId: string; interactionSessionId: string; visitorStateRevisionId: string; exposureId: string };

function signalIntent(signal: NativeCanvasSignal): 'explore_offerings' | 'select_offering' {
  return signal === 'discovery' ? 'explore_offerings' : 'select_offering';
}

export function createNativeIntelligenceService(db: Database['db'], context: Context) {
  const visitors = createVisitorStateRepository(db);
  const sessions = createInteractionSessionRepository(db);
  async function scoped<T>(work: (tx: DatabaseTransaction) => Promise<T>) {
    return db.transaction(async tx => {
      await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
      const business = await tx.execute(sql`select 1 from businesses where id=${context.businessId}::uuid and organization_id=${context.organizationId}::uuid and active`);
      if (!business.rows[0]) throw new Error('native_intelligence_business_unavailable');
      return work(tx);
    });
  }

  return {
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
        const existing = await tx.execute(sql`select id, decision_type from visitor_decisions where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and visitor_identity_id=${identity.visitorIdentityId}::uuid and idempotency_key=${decisionKey}`);
        let decisionId: string;
        let composition: Result['composition'];
        if (existing.rows[0]) {
          decisionId = String(existing.rows[0].id);
          composition = existing.rows[0].decision_type === 'native_discovery' ? 'discovery' : existing.rows[0].decision_type === 'native_comparison' ? 'comparison' : 'entry';
        } else {
          const evaluated = evaluateNativeCanvasDecision({ signal: effectiveSignal });
          decisionId = randomUUID();
          const inputFingerprint = createHash('sha256').update(JSON.stringify({ signal: effectiveSignal, revision: after.revisionId })).digest('hex');
          await tx.execute(sql`insert into visitor_decisions (id,organization_id,business_id,visitor_identity_id,session_id,decision_type,status,contract_version,policy_id,policy_version,visitor_state_revision_id,visitor_state_version,idempotency_key,input_fingerprint) values (${decisionId}::uuid,${context.organizationId}::uuid,${context.businessId}::uuid,${identity.visitorIdentityId}::uuid,${identity.visitorSessionId}::uuid,${evaluated.type},'accepted','decision.v1','native-canvas','native-canvas.v1',${after.revisionId}::uuid,${after.version},${decisionKey},${inputFingerprint})`);
          composition = evaluated.composition;
        }
        const exposureKey = `native:${decisionId}`;
        const exposure = await tx.execute(sql`insert into experience_exposures (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,decision_id,exposure_sequence,exposure_kind,composition_id,composition_version,exposure_idempotency_key,exposed_at) select ${randomUUID()}::uuid,${context.organizationId}::uuid,${context.businessId}::uuid,${identity.visitorIdentityId}::uuid,${identity.visitorSessionId}::uuid,${identity.interactionSessionId}::uuid,${decisionId}::uuid,coalesce(max(exposure_sequence),0)+1,'server_response',${composition},'native-canvas.v1',${exposureKey},now() from experience_exposures where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and interaction_session_id=${identity.interactionSessionId}::uuid on conflict (organization_id,business_id,interaction_session_id,exposure_idempotency_key) where exposure_idempotency_key is not null do nothing returning id`);
        const exposureId = exposure.rows[0]?.id ?? (await tx.execute(sql`select id from experience_exposures where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and interaction_session_id=${identity.interactionSessionId}::uuid and exposure_idempotency_key=${exposureKey}`)).rows[0].id;
        if (parsedSignal) await tx.execute(sql`insert into interaction_facts (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,decision_id,exposure_id,interaction_kind,occurred_at,idempotency_key,action_request_id) values (${randomUUID()}::uuid,${context.organizationId}::uuid,${context.businessId}::uuid,${identity.visitorIdentityId}::uuid,${identity.visitorSessionId}::uuid,${identity.interactionSessionId}::uuid,${decisionId}::uuid,${exposureId}::uuid,'native_composition_selected',now(),${idempotencyKey},null) on conflict (organization_id,business_id,interaction_session_id,interaction_kind,idempotency_key) do nothing`);
        return { handle: identity.handle, composition, compositionVersion: 'native-canvas.v1', decisionId, visitorIdentityId: identity.visitorIdentityId, visitorSessionId: identity.visitorSessionId, interactionSessionId: identity.interactionSessionId, visitorStateRevisionId: after.revisionId, exposureId: String(exposureId) };
      });
    },
  };
}
