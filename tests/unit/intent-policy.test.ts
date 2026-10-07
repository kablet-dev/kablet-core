import { describe, expect, it } from 'vitest';
import { businessIntentPolicyRevisionSchema, qualificationRequirementsForIntent } from '@kablet/domain';

const base = {
  contractVersion: 'business-intent-policy.v1' as const,
  id: '82000000-0000-4000-8000-000000000001', organizationId: '82000000-0000-4000-8000-000000000002', businessId: '82000000-0000-4000-8000-000000000003', policyKey: 'baseline', revisionNumber: 1, createdAt: new Date(),
  qualificationRequirements: [{ key: 'context_timeline', prompt: 'What timeframe?', options: [{ value: 'immediate', label: 'Soon' }] }],
  intentRules: [{ intent: 'explore_offerings' as const, qualificationRequirementKeys: [] }, { intent: 'request_information' as const, qualificationRequirementKeys: ['context_timeline'] }, { intent: 'select_offering' as const, qualificationRequirementKeys: [] }],
};

describe('business intent policy contract', () => {
  it('accepts bounded revision and resolves applicability', () => {
    const policy = businessIntentPolicyRevisionSchema.parse(base);
    expect(qualificationRequirementsForIntent(policy, 'request_information')).toHaveLength(1);
    expect(qualificationRequirementsForIntent(policy, 'explore_offerings')).toHaveLength(0);
  });
  it.each([
    ['duplicate requirement keys', { qualificationRequirements: [...base.qualificationRequirements, ...base.qualificationRequirements] }],
    ['duplicate intent rules', { intentRules: [...base.intentRules, base.intentRules[0]] }],
    ['unknown requirement reference', { intentRules: [{ intent: 'request_information' as const, qualificationRequirementKeys: ['missing_key'] }] }],
    ['invalid revision', { revisionNumber: 0 }],
    ['unknown field', { extra: true }],
  ])('rejects %s', (_name, override) => {
    expect(() => businessIntentPolicyRevisionSchema.parse({ ...base, ...override })).toThrow();
  });
});
