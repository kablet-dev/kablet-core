import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { decisionToExperience, experienceInputSchema, expressContactRequestSchema, expressIntentRequestSchema, expressQualificationRequestSchema, observationSchema, qualificationQuestionSchema, type ExperienceModel, type InteractionIntent } from '@kablet/domain';
import { createBusinessTruthRepository, createDecisionRepository, createInteractionSessionRepository, createVisitorStateRepository, type Database, type DatabaseTransaction } from '@kablet/db';

const intentValues: Record<InteractionIntent, 'explore_offerings' | 'request_information' | 'select_offering'> = { explore_offerings: 'explore_offerings', request_information: 'request_information', select_offering: 'select_offering' };
const defaultQualificationRequirements = [qualificationQuestionSchema.parse({ key: 'context_timeline', prompt: 'What kind of timeframe are you considering?', options: [{ value: 'immediate', label: 'As soon as possible' }, { value: 'this_week', label: 'This week' }, { value: 'exploring', label: 'I am still exploring' }] })];
const contactRequirement = { fields: ['name', 'email'] as ('name' | 'email' | 'phone')[], channels: ['email'] as ('email' | 'phone')[], consentPurpose: 'follow_up', consentVersion: '1' };
export class InteractionExpiredError extends Error { constructor() { super('interaction expired or revoked'); this.name = 'InteractionExpiredError'; } }

export function createInteractionService(input: { db: Database['db']; organizationId: string; businessId: string; decisionRepository?: ReturnType<typeof createDecisionRepository>; qualificationRequirements?: typeof defaultQualificationRequirements }) {
  const visitors = createVisitorStateRepository(input.db);
  const interactions = createInteractionSessionRepository(input.db);
  const decisions = input.decisionRepository ?? createDecisionRepository(input.db);
  async function render(visitorIdentityId: string, sessionId: string, idempotencyKey: string, transaction?: DatabaseTransaction): Promise<ExperienceModel> {
    const stateRepository = createVisitorStateRepository(input.db, transaction);
    const truthRepository = createBusinessTruthRepository(input.db, transaction);
    const decisionRepository = transaction && !input.decisionRepository ? createDecisionRepository(input.db, transaction) : decisions;
    const current = await stateRepository.getCurrentState(input.organizationId, input.businessId, visitorIdentityId);
    const eligible = await truthRepository.listPublicOfferings(input.organizationId, input.businessId);
    const decision = await decisionRepository.create({ organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId, sessionId, idempotencyKey, policyId: 'baseline', policyVersion: '1', policyInput: { state: current.state, eligibleOfferingRefs: eligible.map(ref => ({ offeringId: ref.offeringId, offeringRevisionId: ref.offeringRevisionId })), qualificationRequirements: input.qualificationRequirements ?? defaultQualificationRequirements, contactRequirement, permittedNextStep: false } });
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
    async submitContact(handle: string, request: unknown): Promise<ExperienceModel> {
      const parsed = expressContactRequestSchema.parse(request);
      const session = await interactions.resolve(input.organizationId, input.businessId, handle);
      if (!session) throw new InteractionExpiredError();
      const current = await visitors.getCurrentState(input.organizationId, input.businessId, session.visitorIdentityId);
      let contactId: string = randomUUID(); let observationId: string = randomUUID(); const consentObservationId = randomUUID();
      return input.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
        const existing = await tx.execute(sql`select id, source_observation_id, name, email from visitor_contact_records where organization_id=${input.organizationId}::uuid and visitor_identity_id=${session.visitorIdentityId}::uuid and idempotency_key=${parsed.idempotencyKey}`);
        if (existing.rows[0]) {
          if (String(existing.rows[0].name) !== parsed.name || String(existing.rows[0].email) !== parsed.email) throw new Error('contact idempotency key conflicts with a different input');
          contactId = z.string().uuid().parse(existing.rows[0].id); observationId = z.string().uuid().parse(existing.rows[0].source_observation_id);
        } else {
          await tx.execute(sql`insert into visitor_contact_records (id,organization_id,business_id,visitor_identity_id,session_id,name,email,preferred_channel,source_observation_id,idempotency_key) values (${contactId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${session.visitorIdentityId}::uuid,${session.visitorSessionId}::uuid,${parsed.name},${parsed.email},'email',${observationId}::uuid,${parsed.idempotencyKey})`);
        }
        await tx.execute(sql`insert into visitor_consents (id,organization_id,business_id,visitor_identity_id,session_id,purpose,version,status,source_observation_id,idempotency_key) values (${randomUUID()}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${session.visitorIdentityId}::uuid,${session.visitorSessionId}::uuid,${contactRequirement.consentPurpose},${contactRequirement.consentVersion},'granted',${consentObservationId}::uuid,${parsed.idempotencyKey}) on conflict (organization_id,visitor_identity_id,idempotency_key) do nothing`);
        const transactionVisitors = createVisitorStateRepository(input.db, tx);
        const contactObservation = observationSchema.parse({ id: observationId, organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, expectedVersion: current.version, kind: 'contact.submitted', value: { type: 'contact', contactRecordId: contactId, channels: ['email'] }, idempotencyKey: parsed.idempotencyKey, observedAt: new Date(), sourceType: 'visitor', sourceReference: 'interaction', correctionOfObservationId: null });
        await transactionVisitors.ingest(input.organizationId, contactObservation);
        const afterContact = await transactionVisitors.getCurrentState(input.organizationId, input.businessId, session.visitorIdentityId);
        const consentObservation = observationSchema.parse({ id: consentObservationId, organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, expectedVersion: afterContact.version, kind: 'consent.granted', value: { type: 'consent', purpose: contactRequirement.consentPurpose, version: contactRequirement.consentVersion }, idempotencyKey: `${parsed.idempotencyKey}:consent`, observedAt: new Date(), sourceType: 'visitor', sourceReference: 'interaction', correctionOfObservationId: null });
        await transactionVisitors.ingest(input.organizationId, consentObservation);
        return render(session.visitorIdentityId, session.visitorSessionId, `interaction:${parsed.idempotencyKey}`, tx);
      });
    },
  };
}
