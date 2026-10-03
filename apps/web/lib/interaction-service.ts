import { randomUUID } from 'node:crypto';
import { decisionToExperience, experienceInputSchema, expressIntentRequestSchema, type ExperienceModel, type InteractionIntent } from '@kablet/domain';
import { createBusinessTruthRepository, createDecisionRepository, createInteractionSessionRepository, createVisitorStateRepository, type Database } from '@kablet/db';

const intentValues: Record<InteractionIntent, 'explore_offerings' | 'request_information' | 'select_offering'> = { explore_offerings: 'explore_offerings', request_information: 'request_information', select_offering: 'select_offering' };

export function createInteractionService(input: { db: Database['db']; organizationId: string; businessId: string; decisionRepository?: ReturnType<typeof createDecisionRepository> }) {
  const visitors = createVisitorStateRepository(input.db);
  const interactions = createInteractionSessionRepository(input.db);
  const decisions = input.decisionRepository ?? createDecisionRepository(input.db);
  const truth = createBusinessTruthRepository(input.db);
  return {
    async start(expiresAt: Date) {
      const visitorId = await visitors.createVisitor(input.organizationId, input.businessId, expiresAt);
      const sessionId = await visitors.createSession(input.organizationId, input.businessId, visitorId);
      const handle = await interactions.create(input.organizationId, input.businessId, visitorId, sessionId, expiresAt);
      return { handle, visitorId, sessionId };
    },
    async expressIntent(handle: string, request: unknown): Promise<ExperienceModel> {
      const parsed = expressIntentRequestSchema.parse(request);
      const session = await interactions.resolve(input.organizationId, input.businessId, handle);
      if (!session) throw new Error('interaction expired or revoked');
      const current = await visitors.getCurrentState(input.organizationId, input.businessId, session.visitorIdentityId);
      const observationId = randomUUID();
      const observation = { id: observationId, organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, expectedVersion: current.version, kind: 'intent.expressed' as const, value: { type: 'intent' as const, value: intentValues[parsed.intent] }, idempotencyKey: parsed.idempotencyKey, observedAt: new Date(), sourceType: 'visitor' as const, sourceReference: 'interaction', correctionOfObservationId: null };
      await visitors.ingest(input.organizationId, observation);
      const next = await visitors.getCurrentState(input.organizationId, input.businessId, session.visitorIdentityId);
      const eligible = await truth.listPublicOfferings(input.organizationId, input.businessId);
      const decision = await decisions.create({ organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, idempotencyKey: `interaction:${parsed.idempotencyKey}`, policyId: 'baseline', policyVersion: '1', policyInput: { state: next.state, eligibleOfferingRefs: eligible.map(ref => ({ offeringId: ref.offeringId, offeringRevisionId: ref.offeringRevisionId })), permittedNextStep: false } });
      const decisionRow = decision.decision as Record<string, unknown>;
      const experienceInput = experienceInputSchema.parse({ contractVersion: 'experience-input.v1', decisionId: String(decisionRow.id), decisionContractVersion: 'decision.v1', organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, decisionType: String(decisionRow.decision_type), visitorStateRevisionId: String(decisionRow.visitor_state_revision_id), businessTruthRefs: eligible.map(ref => ({ offeringId: ref.offeringId, offeringRevisionId: ref.offeringRevisionId })), rationale: Array.isArray(decisionRow.rationale) ? decisionRow.rationale : [] });
      return decisionToExperience(experienceInput, eligible);
    },
  };
}
