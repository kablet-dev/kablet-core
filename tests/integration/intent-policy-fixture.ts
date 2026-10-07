import { createIntentPolicyRepository, type Database } from '@kablet/db';

export async function seedBaselineIntentPolicy(db: Database['db'], organizationId: string, businessId: string) {
  const repository = createIntentPolicyRepository(db);
  const revision = await repository.createRevision({
    organizationId,
    businessId,
    policyKey: 'baseline',
    qualificationRequirements: [{ key: 'context_timeline', prompt: 'What kind of timeframe are you considering?', options: [{ value: 'immediate', label: 'As soon as possible' }, { value: 'this_week', label: 'This week' }, { value: 'exploring', label: 'I am still exploring' }] }],
    intentRules: [
      { intent: 'explore_offerings', qualificationRequirementKeys: [] },
      { intent: 'request_information', qualificationRequirementKeys: ['context_timeline'] },
      { intent: 'select_offering', qualificationRequirementKeys: [] },
    ],
  });
  await repository.publish(organizationId, businessId, 'baseline', revision.id);
  return revision;
}
