import { authorizePolicyApproval, type AuthContext } from '@kablet/domain';
import type { createIntentPolicyRepository, createSecurityRepository } from '@kablet/db';

export async function publishMerchantPolicy(input: {
  context: AuthContext | null;
  organizationId: string;
  businessId: string;
  policyKey: string;
  revisionId: string;
  approvalId: string;
  policyRepository: ReturnType<typeof createIntentPolicyRepository>;
  securityRepository: ReturnType<typeof createSecurityRepository>;
}) {
  const authorization = authorizePolicyApproval(input.context, input.organizationId, input.businessId);
  if (!authorization.allowed) throw new Error(`authorization_denied:${authorization.reason}`);
  if (!(await input.securityRepository.isPolicyApproved({ organizationId: input.organizationId, businessId: input.businessId, policyKey: input.policyKey, revisionId: input.revisionId, approvalId: input.approvalId }))) throw new Error('policy_approval_required');
  await input.policyRepository.publish(input.organizationId, input.businessId, input.policyKey, input.revisionId);
  await input.securityRepository.audit({ organizationId: input.organizationId, businessId: input.businessId, actorId: input.context!.actorId, actorType: input.context!.actorType, action: 'policy.publish', resourceType: 'intent_policy_revision', resourceId: input.revisionId, metadata: { policyKey: input.policyKey } });
  return { published: true, revisionId: input.revisionId };
}
