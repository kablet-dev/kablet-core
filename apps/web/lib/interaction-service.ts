import { randomUUID } from 'node:crypto';
import { decisionToExperience, experienceInputSchema, expressIntentRequestSchema, expressQualificationRequestSchema, qualificationQuestionSchema, type ExperienceModel, type InteractionIntent } from '@kablet/domain';
import { createBusinessTruthRepository, createDecisionRepository, createInteractionSessionRepository, createVisitorStateRepository, type Database } from '@kablet/db';

const intentValues: Record<InteractionIntent, 'explore_offerings' | 'request_information' | 'select_offering'> = { explore_offerings: 'explore_offerings', request_information: 'request_information', select_offering: 'select_offering' };
const defaultQualificationRequirements = [qualificationQuestionSchema.parse({ key: 'context_timeline', prompt: 'What kind of timeframe are you considering?', options: [{ value: 'immediate', label: 'As soon as possible' }, { value: 'this_week', label: 'This week' }, { value: 'exploring', label: 'I am still exploring' }] })];
export class InteractionExpiredError extends Error { constructor() { super('interaction expired or revoked'); this.name = 'InteractionExpiredError'; } }

export function createInteractionService(input: { db: Database['db']; organizationId: string; businessId: string; decisionRepository?: ReturnType<typeof createDecisionRepository>; qualificationRequirements?: typeof defaultQualificationRequirements }) {
  const visitors = createVisitorStateRepository(input.db);
  const interactions = createInteractionSessionRepository(input.db);
  const decisions = input.decisionRepository ?? createDecisionRepository(input.db);
  const truth = createBusinessTruthRepository(input.db);
  async function render(visitorIdentityId: string, sessionId: string, idempotencyKey: string): Promise<ExperienceModel> {
    const current = await visitors.getCurrentState(input.organizationId, input.businessId, visitorIdentityId);
    const eligible = await truth.listPublicOfferings(input.organizationId, input.businessId);
    const decision = await decisions.create({ organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId, sessionId, idempotencyKey, policyId: 'baseline', policyVersion: '1', policyInput: { state: current.state, eligibleOfferingRefs: eligible.map(ref => ({ offeringId: ref.offeringId, offeringRevisionId: ref.offeringRevisionId })), qualificationRequirements: input.qualificationRequirements ?? defaultQualificationRequirements, permittedNextStep: false } });
    const decisionRow = decision.decision as Record<string, unknown>;
    const qualificationQuestion = decisionRow.qualification_question_key ? { key: String(decisionRow.qualification_question_key), prompt: String(decisionRow.qualification_question_prompt), options: qualificationQuestionSchema.shape.options.parse(decisionRow.qualification_question_options) } : null;
    const experienceInput = experienceInputSchema.parse({ contractVersion: 'experience-input.v1', decisionId: String(decisionRow.id), decisionContractVersion: 'decision.v1', organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId, sessionId, decisionType: String(decisionRow.decision_type), visitorStateRevisionId: String(decisionRow.visitor_state_revision_id), businessTruthRefs: eligible.map(ref => ({ offeringId: ref.offeringId, offeringRevisionId: ref.offeringRevisionId })), qualificationQuestion, rationale: Array.isArray(decisionRow.rationale) ? decisionRow.rationale : [] });
    return decisionToExperience(experienceInput, eligible);
  }
  return {
    async start(expiresAt: Date) {
      const visitorId = await visitors.createVisitor(input.organizationId, input.businessId, expiresAt);
      const sessionId = await visitors.createSession(input.organizationId, input.businessId, visitorId);
      const handle = await interactions.create(input.organizationId, input.businessId, visitorId, sessionId, expiresAt);
      return { handle, visitorId, sessionId, experience: await render(visitorId, sessionId, `interaction-start:${visitorId}`) };
    },
    async expressIntent(handle: string, request: unknown): Promise<ExperienceModel> {
      const parsed = expressIntentRequestSchema.parse(request);
      const session = await interactions.resolve(input.organizationId, input.businessId, handle);
      if (!session) throw new InteractionExpiredError();
      const current = await visitors.getCurrentState(input.organizationId, input.businessId, session.visitorIdentityId);
      const observationId = randomUUID();
      const observation = { id: observationId, organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, expectedVersion: current.version, kind: 'intent.expressed' as const, value: { type: 'intent' as const, value: intentValues[parsed.intent] }, idempotencyKey: parsed.idempotencyKey, observedAt: new Date(), sourceType: 'visitor' as const, sourceReference: 'interaction', correctionOfObservationId: null };
      await visitors.ingest(input.organizationId, observation);
      return render(session.visitorIdentityId, session.visitorSessionId, `interaction:${parsed.idempotencyKey}`);
    },
    async submitQualification(handle: string, request: unknown): Promise<ExperienceModel> {
      const parsed = expressQualificationRequestSchema.parse(request);
      const session = await interactions.resolve(input.organizationId, input.businessId, handle);
      if (!session) throw new InteractionExpiredError();
      const question = (input.qualificationRequirements ?? defaultQualificationRequirements).find(item => item.key === parsed.questionKey);
      if (!question || !question.options.some(option => option.value === parsed.answer)) throw new Error('qualification answer is not permitted');
      const current = await visitors.getCurrentState(input.organizationId, input.businessId, session.visitorIdentityId);
      await visitors.ingest(input.organizationId, { id: randomUUID(), organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, expectedVersion: current.version, kind: 'qualification.answered', value: { type: 'qualification', questionKey: parsed.questionKey, answer: parsed.answer }, idempotencyKey: parsed.idempotencyKey, observedAt: new Date(), sourceType: 'visitor', sourceReference: 'interaction', correctionOfObservationId: null });
      return render(session.visitorIdentityId, session.visitorSessionId, `interaction:${parsed.idempotencyKey}`);
    },
  };
}
