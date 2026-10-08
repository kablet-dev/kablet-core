import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { decisionToExperience, experienceInputSchema, expressContactRequestSchema, expressIntentRequestSchema, expressQualificationRequestSchema, observationSchema, qualificationQuestionSchema, selectOfferingRequestSchema, type ExperienceModel, type InteractionIntent } from '@kablet/domain';
import { createAcquisitionRepository, createBusinessTruthRepository, createDecisionRepository, createIntentPolicyRepository, createInteractionSessionRepository, createMeasurementRepository, createVisitorStateRepository, type Database, type DatabaseTransaction } from '@kablet/db';
import { acquisitionContextSchema } from '@kablet/domain';

const intentValues: Record<InteractionIntent, 'explore_offerings' | 'request_information' | 'select_offering'> = { explore_offerings: 'explore_offerings', request_information: 'request_information', select_offering: 'select_offering' };
const contactRequirement = { fields: ['name', 'email'] as ('name' | 'email' | 'phone')[], channels: ['email'] as ('email' | 'phone')[], consentPurpose: 'follow_up', consentVersion: '1' };
export class InteractionExpiredError extends Error { constructor() { super('interaction expired or revoked'); this.name = 'InteractionExpiredError'; } }

export type InteractionAcquisitionInput = { landingPath: string; referrer: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; utmContent: string | null; utmTerm: string | null };
export function createInteractionService(input: { db: Database['db']; organizationId: string; businessId: string; decisionRepository?: ReturnType<typeof createDecisionRepository> }) {
  const visitors = createVisitorStateRepository(input.db);
  const interactions = createInteractionSessionRepository(input.db);
  const decisions = input.decisionRepository ?? createDecisionRepository(input.db);
  async function render(visitorIdentityId: string, sessionId: string, interactionSessionId: string, idempotencyKey: string, transaction?: DatabaseTransaction): Promise<{ experience: ExperienceModel; exposureId: string }> {
    const stateRepository = createVisitorStateRepository(input.db, transaction);
    const truthRepository = createBusinessTruthRepository(input.db, transaction);
    const policyRepository = createIntentPolicyRepository(input.db, transaction);
    const decisionRepository = transaction && !input.decisionRepository ? createDecisionRepository(input.db, transaction) : decisions;
    const current = await stateRepository.getCurrentState(input.organizationId, input.businessId, visitorIdentityId);
    const eligible = await truthRepository.listPublicOfferings(input.organizationId, input.businessId);
    const policy = await policyRepository.getCurrent(input.organizationId, input.businessId, 'baseline');
    const qualificationRequirements = policyRepository.qualificationRequirementsForIntent(policy, current.state.intent?.status === 'stated' || current.state.intent?.status === 'confirmed' ? (current.state.intent.value as InteractionIntent) : null);
    const decision = await decisionRepository.create({ organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId, sessionId, idempotencyKey, policyId: 'baseline', policyVersion: policy.contractVersion, intentPolicyRevisionId: policy.id, policyInput: { state: current.state, eligibleOfferingRefs: eligible.map(ref => ({ offeringId: ref.offeringId, offeringRevisionId: ref.offeringRevisionId })), qualificationRequirements, contactRequirement, permittedNextStep: false } });
    const decisionRow = decision.decision as Record<string, unknown>;
    const qualificationQuestion = decisionRow.qualification_question_key ? { key: String(decisionRow.qualification_question_key), prompt: String(decisionRow.qualification_question_prompt), options: qualificationQuestionSchema.shape.options.parse(decisionRow.qualification_question_options) } : null;
    const experienceInput = experienceInputSchema.parse({ contractVersion: 'experience-input.v1', decisionId: String(decisionRow.id), decisionContractVersion: 'decision.v1', organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId, sessionId, decisionType: String(decisionRow.decision_type), visitorStateRevisionId: String(decisionRow.visitor_state_revision_id), businessTruthRefs: eligible.map(ref => ({ offeringId: ref.offeringId, offeringRevisionId: ref.offeringRevisionId })), qualificationQuestion, rationale: Array.isArray(decisionRow.rationale) ? decisionRow.rationale : [] });
    const experience = decisionToExperience(experienceInput, eligible);
    const exposureId = randomUUID();
    await createMeasurementRepository(input.db, transaction).insertExposure({ contractVersion: 'experience-exposure.v1', id: exposureId, organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId, visitorSessionId: sessionId, interactionSessionId, decisionId: String(decisionRow.id), exposureKind: 'server_response', exposedAt: new Date() });
    return { experience, exposureId };
  }
  async function fact(session: { interactionSessionId: string; visitorIdentityId: string; visitorSessionId: string }, priorExposureId: string, experience: ExperienceModel, kind: 'intent_expressed' | 'qualification_answered' | 'contact_submitted' | 'consent_granted', idempotencyKey: string, transaction?: DatabaseTransaction) {
    await createMeasurementRepository(input.db, transaction).insertFact({ contractVersion: 'interaction-fact.v1', id: randomUUID(), organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, visitorSessionId: session.visitorSessionId, interactionSessionId: session.interactionSessionId, decisionId: (await createMeasurementRepository(input.db, transaction).getExposure(priorExposureId, input.organizationId, input.businessId))!.decisionId, exposureId: priorExposureId, interactionKind: kind, occurredAt: new Date(), idempotencyKey, actionRequestId: null });
  }
  return {
    async resume(handle: string): Promise<ExperienceModel> {
      const session = await interactions.resolve(input.organizationId, input.businessId, handle);
      if (!session) throw new InteractionExpiredError();
      return input.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
        const exposure = await tx.execute(sql`select e.*, d.visitor_identity_id as decision_visitor_identity_id, d.session_id as decision_session_id, d.visitor_state_revision_id, d.visitor_state_version, d.decision_type, d.intent_policy_revision_id, d.qualification_question_key, d.qualification_question_prompt, d.qualification_question_options from experience_exposures e join visitor_decisions d on d.id=e.decision_id and d.organization_id=e.organization_id and d.business_id=e.business_id where e.organization_id=${input.organizationId}::uuid and e.business_id=${input.businessId}::uuid and e.interaction_session_id=${session.interactionSessionId}::uuid order by e.exposure_sequence desc limit 1`);
        const row = exposure.rows[0] as Record<string, unknown> | undefined;
        if (!row || String(row.decision_visitor_identity_id) !== session.visitorIdentityId || String(row.decision_session_id) !== session.visitorSessionId) throw new Error('interaction decision lineage is inconsistent');
        if (!row.intent_policy_revision_id) throw new Error('interaction policy lineage is missing');
        const policy = await createIntentPolicyRepository(input.db, tx).getById(input.organizationId, input.businessId, String(row.intent_policy_revision_id));
        if (!policy) throw new Error('interaction policy revision not found');
        if (String(row.decision_type) === 'request_qualification' && (!row.qualification_question_key || !policy.qualificationRequirements.some(item => item.key === String(row.qualification_question_key)))) throw new Error('interaction policy lineage is inconsistent');
        const state = await tx.execute(sql`select s.current_revision_id, s.version from visitor_states s where s.organization_id=${input.organizationId}::uuid and s.business_id=${input.businessId}::uuid and s.visitor_identity_id=${session.visitorIdentityId}::uuid`);
        if (!state.rows[0] || String(state.rows[0].current_revision_id) !== String(row.visitor_state_revision_id) || Number(state.rows[0].version) !== Number(row.visitor_state_version)) throw new Error('interaction decision is stale');
        const refs = await tx.execute(sql`select offering_id, offering_revision_id from visitor_decision_business_truth_refs where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and decision_id=${row.decision_id}::uuid`);
        const offerings = await createBusinessTruthRepository(input.db, tx).getOfferingsByReferences(input.organizationId, input.businessId, refs.rows.map(ref => ({ offeringId: String(ref.offering_id), offeringRevisionId: String(ref.offering_revision_id) })), tx);
        const qualificationQuestion = row.qualification_question_key ? { key: String(row.qualification_question_key), prompt: String(row.qualification_question_prompt), options: qualificationQuestionSchema.shape.options.parse(row.qualification_question_options) } : null;
        return decisionToExperience(experienceInputSchema.parse({ contractVersion: 'experience-input.v1', decisionId: String(row.decision_id), decisionContractVersion: 'decision.v1', organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, decisionType: String(row.decision_type), visitorStateRevisionId: String(row.visitor_state_revision_id), businessTruthRefs: refs.rows.map(ref => ({ offeringId: String(ref.offering_id), offeringRevisionId: String(ref.offering_revision_id) })), qualificationQuestion, rationale: [] }), offerings);
      });
    },
    async start(expiresAt: Date, acquisition: InteractionAcquisitionInput = { landingPath: '/', referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null }) {
      return input.db.transaction(async tx => {
        const transactionVisitors = createVisitorStateRepository(input.db, tx);
        const visitorId = await transactionVisitors.createVisitor(input.organizationId, input.businessId, expiresAt);
        const sessionId = await transactionVisitors.createSession(input.organizationId, input.businessId, visitorId);
        const interaction = await interactions.createWithId(input.organizationId, input.businessId, visitorId, sessionId, expiresAt, tx);
        const context = acquisitionContextSchema.parse({ contractVersion: 'acquisition-context.v1', id: randomUUID(), organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: visitorId, visitorSessionId: sessionId, interactionSessionId: interaction.id, capturedAt: new Date(), ...acquisition });
        await createAcquisitionRepository(input.db, tx).insert(context);
        return { handle: interaction.handle, visitorId, sessionId, experience: (await render(visitorId, sessionId, interaction.id, `interaction-start:${visitorId}`, tx)).experience };
      });
    },
    async expressIntent(handle: string, request: unknown): Promise<ExperienceModel> {
      const parsed = expressIntentRequestSchema.parse(request);
      const session = await interactions.resolve(input.organizationId, input.businessId, handle);
      if (!session) throw new InteractionExpiredError();
      const prior = await createMeasurementRepository(input.db).getLatestExposure(input.organizationId, input.businessId, session.interactionSessionId); if (!prior) throw new Error('interaction exposure not found');
      return input.db.transaction(async tx => {
        const transactionVisitors = createVisitorStateRepository(input.db, tx);
        const current = await transactionVisitors.getCurrentState(input.organizationId, input.businessId, session.visitorIdentityId);
        const observation = { id: randomUUID(), organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, expectedVersion: current.version, kind: 'intent.expressed' as const, value: { type: 'intent' as const, value: intentValues[parsed.intent] }, idempotencyKey: parsed.idempotencyKey, observedAt: new Date(), sourceType: 'visitor' as const, sourceReference: 'interaction', correctionOfObservationId: null };
        await transactionVisitors.ingest(input.organizationId, observation, tx);
        const rendered = await render(session.visitorIdentityId, session.visitorSessionId, session.interactionSessionId, `interaction:${parsed.idempotencyKey}`, tx);
        await fact(session, prior.id, rendered.experience, 'intent_expressed', parsed.idempotencyKey, tx);
        return rendered.experience;
      });
    },
    async submitQualification(handle: string, request: unknown): Promise<ExperienceModel> {
      const parsed = expressQualificationRequestSchema.parse(request);
      const session = await interactions.resolve(input.organizationId, input.businessId, handle);
      if (!session) throw new InteractionExpiredError();
      const prior = await createMeasurementRepository(input.db).getLatestExposure(input.organizationId, input.businessId, session.interactionSessionId); if (!prior) throw new Error('interaction exposure not found');
      const priorDecision = await decisions.getById(input.organizationId, input.businessId, prior.decisionId);
      if (!priorDecision?.intent_policy_revision_id) throw new Error('qualification decision policy revision not found');
      const policy = await createIntentPolicyRepository(input.db).getById(input.organizationId, input.businessId, String(priorDecision.intent_policy_revision_id));
      const question = policy.qualificationRequirements.find(item => item.key === parsed.questionKey);
      if (!question || !question.options.some(option => option.value === parsed.answer)) throw new Error('qualification answer is not permitted');
      return input.db.transaction(async tx => {
        const transactionVisitors = createVisitorStateRepository(input.db, tx);
        const current = await transactionVisitors.getCurrentState(input.organizationId, input.businessId, session.visitorIdentityId);
        await transactionVisitors.ingest(input.organizationId, { id: randomUUID(), organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, expectedVersion: current.version, kind: 'qualification.answered', value: { type: 'qualification', questionKey: parsed.questionKey, answer: parsed.answer }, idempotencyKey: parsed.idempotencyKey, observedAt: new Date(), sourceType: 'visitor', sourceReference: 'interaction', correctionOfObservationId: null }, tx);
        const rendered = await render(session.visitorIdentityId, session.visitorSessionId, session.interactionSessionId, `interaction:${parsed.idempotencyKey}`, tx);
        await fact(session, prior.id, rendered.experience, 'qualification_answered', parsed.idempotencyKey, tx);
        return rendered.experience;
      });
    },
    async selectOffering(handle: string, request: unknown): Promise<ExperienceModel> {
      const parsed = selectOfferingRequestSchema.parse(request);
      const session = await interactions.resolve(input.organizationId, input.businessId, handle);
      if (!session) throw new InteractionExpiredError();
      const prior = await createMeasurementRepository(input.db).getLatestExposure(input.organizationId, input.businessId, session.interactionSessionId); if (!prior) throw new Error('interaction exposure not found');
      return input.db.transaction(async tx => {
        const truth = await createBusinessTruthRepository(input.db, tx).listPublicOfferings(input.organizationId, input.businessId);
        if (!truth.some(ref => ref.offeringId === parsed.offeringId && ref.offeringRevisionId === parsed.offeringRevisionId)) throw new Error('offering is not eligible');
        const transactionVisitors = createVisitorStateRepository(input.db, tx);
        const current = await transactionVisitors.getCurrentState(input.organizationId, input.businessId, session.visitorIdentityId);
        await transactionVisitors.ingest(input.organizationId, { id: randomUUID(), organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, expectedVersion: current.version, kind: 'offering.selected' as const, value: { type: 'offering' as const, offeringId: parsed.offeringId, publishedRevisionId: parsed.offeringRevisionId }, idempotencyKey: parsed.idempotencyKey, observedAt: new Date(), sourceType: 'visitor' as const, sourceReference: 'interaction', correctionOfObservationId: null }, tx);
        return (await render(session.visitorIdentityId, session.visitorSessionId, session.interactionSessionId, `interaction:${parsed.idempotencyKey}`, tx)).experience;
      });
    },
    async submitContact(handle: string, request: unknown): Promise<ExperienceModel> {
      const parsed = expressContactRequestSchema.parse(request);
      const session = await interactions.resolve(input.organizationId, input.businessId, handle);
      if (!session) throw new InteractionExpiredError();
      const prior = await createMeasurementRepository(input.db).getLatestExposure(input.organizationId, input.businessId, session.interactionSessionId); if (!prior) throw new Error('interaction exposure not found');
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
        await transactionVisitors.ingest(input.organizationId, contactObservation, tx);
        const afterContact = await transactionVisitors.getCurrentState(input.organizationId, input.businessId, session.visitorIdentityId);
        const consentObservation = observationSchema.parse({ id: consentObservationId, organizationId: input.organizationId, businessId: input.businessId, visitorIdentityId: session.visitorIdentityId, sessionId: session.visitorSessionId, expectedVersion: afterContact.version, kind: 'consent.granted', value: { type: 'consent', purpose: contactRequirement.consentPurpose, version: contactRequirement.consentVersion }, idempotencyKey: `${parsed.idempotencyKey}:consent`, observedAt: new Date(), sourceType: 'visitor', sourceReference: 'interaction', correctionOfObservationId: null });
        await transactionVisitors.ingest(input.organizationId, consentObservation, tx);
        const rendered = await render(session.visitorIdentityId, session.visitorSessionId, session.interactionSessionId, `interaction:${parsed.idempotencyKey}`, tx);
        await fact(session, prior.id, rendered.experience, 'contact_submitted', parsed.idempotencyKey, tx);
        await fact(session, prior.id, rendered.experience, 'consent_granted', `${parsed.idempotencyKey}:consent`, tx);
        return rendered.experience;
      });
    },
  };
}
