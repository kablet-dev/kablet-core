import type { ExperienceInput } from '@kablet/domain';

export const demoExperienceInput: ExperienceInput = {
  contractVersion: 'experience-input.v1',
  decisionId: '10000000-0000-4000-8000-000000000001',
  decisionContractVersion: 'decision.v1',
  organizationId: '10000000-0000-4000-8000-000000000002',
  businessId: '10000000-0000-4000-8000-000000000003',
  visitorIdentityId: '10000000-0000-4000-8000-000000000004',
  sessionId: '10000000-0000-4000-8000-000000000005',
  decisionType: 'clarify_intent',
  visitorStateRevisionId: '10000000-0000-4000-8000-000000000006',
  businessTruthRefs: [],
  rationale: [{ code: 'intent_missing', source: 'visitor_state' }],
};

export const demoRenderableOfferings = [
  { offeringId: '20000000-0000-4000-8000-000000000001', offeringRevisionId: '20000000-0000-4000-8000-000000000002', name: 'Clarity Session', description: 'A focused conversation to turn a complex question into a clear next direction.', priceLabel: 'Fictional demo projection' },
  { offeringId: '20000000-0000-4000-8000-000000000003', offeringRevisionId: '20000000-0000-4000-8000-000000000004', name: 'Momentum Workshop', description: 'A practical working session for teams ready to shape an achievable plan.', priceLabel: 'Fictional demo projection' },
];

export function demoInputFor(decisionType: ExperienceInput['decisionType']): ExperienceInput {
  return { ...demoExperienceInput, decisionType };
}
