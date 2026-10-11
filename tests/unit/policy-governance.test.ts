import { describe, expect, it, vi } from 'vitest';
import { publishMerchantPolicy } from '../../apps/web/lib/policy-governance';

const context = { actorId: '10000000-0000-4000-8000-000000000001', actorType: 'merchant_user' as const, organizationId: '20000000-0000-4000-8000-000000000001', businessId: '30000000-0000-4000-8000-000000000001', capabilities: ['policy.approve'] as const, sessionId: '40000000-0000-4000-8000-000000000001' };

describe('merchant policy governance', () => {
  it('publishes only with merchant approval and records actor lineage', async () => {
    const policyRepository = { publish: vi.fn().mockResolvedValue(undefined) };
    const securityRepository = { audit: vi.fn().mockResolvedValue(undefined) };
    await expect(publishMerchantPolicy({ context: { ...context, capabilities: [...context.capabilities] }, organizationId: context.organizationId, businessId: context.businessId, policyKey: 'baseline', revisionId: '50000000-0000-4000-8000-000000000001', policyRepository: policyRepository as never, securityRepository: securityRepository as never })).resolves.toEqual({ published: true, revisionId: '50000000-0000-4000-8000-000000000001' });
    expect(policyRepository.publish).toHaveBeenCalledWith(context.organizationId, context.businessId, 'baseline', '50000000-0000-4000-8000-000000000001');
    expect(securityRepository.audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: context.actorId, actorType: 'merchant_user', action: 'policy.publish' }));
  });

  it('rejects platform actors and does not call the policy repository', async () => {
    const policyRepository = { publish: vi.fn() };
    const securityRepository = { audit: vi.fn() };
    await expect(publishMerchantPolicy({ context: { ...context, actorType: 'platform_operator', capabilities: [...context.capabilities] }, organizationId: context.organizationId, businessId: context.businessId, policyKey: 'baseline', revisionId: '50000000-0000-4000-8000-000000000001', policyRepository: policyRepository as never, securityRepository: securityRepository as never })).rejects.toThrow('authorization_denied:wrong_actor_type');
    expect(policyRepository.publish).not.toHaveBeenCalled();
    expect(securityRepository.audit).not.toHaveBeenCalled();
  });
});
