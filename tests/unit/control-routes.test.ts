import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveControlContext: vi.fn(), authorizeControlCapability: vi.fn(),
  createDb: vi.fn(), createSecurityRepository: vi.fn(), createIntentPolicyRepository: vi.fn(),
  loadControlCredentialVault: vi.fn(),
}));

vi.mock('../../apps/web/lib/control-auth', () => ({ resolveControlContext: mocks.resolveControlContext, authorizeControlCapability: mocks.authorizeControlCapability }));
vi.mock('../../apps/web/lib/control-credential-vault', () => ({ loadControlCredentialVault: mocks.loadControlCredentialVault }));
vi.mock('@kablet/config', () => ({ loadServerConfig: () => ({ DATABASE_URL: 'postgres://test' }) }));
vi.mock('@kablet/db', () => ({ createDb: mocks.createDb, createSecurityRepository: mocks.createSecurityRepository, createIntentPolicyRepository: mocks.createIntentPolicyRepository }));

import { POST as membershipPost } from '../../apps/web/app/api/control/membership/route';
import { POST as credentialPost } from '../../apps/web/app/api/control/credential/route';
import { POST as privacyPost } from '../../apps/web/app/api/control/privacy/route';
import { POST as policyPost } from '../../apps/web/app/api/control/policy/route';

const context = { actorId: '10000000-0000-4000-8000-000000000001', actorType: 'merchant_user' as const, organizationId: '20000000-0000-4000-8000-000000000001', businessId: '30000000-0000-4000-8000-000000000001', capabilities: ['user.manage', 'credential.rotate', 'privacy.manage', 'policy.approve', 'truth.read'] as const, sessionId: '40000000-0000-4000-8000-000000000001' };
const db = { pool: { end: vi.fn().mockResolvedValue(undefined) }, db: {} };
const security = { addMembership: vi.fn(), audit: vi.fn(), saveProviderCredential: vi.fn(), revokeProviderCredential: vi.fn(), grantConsent: vi.fn(), revokeConsent: vi.fn(), exportVisitor: vi.fn(), deleteVisitor: vi.fn(), requestPolicyApproval: vi.fn(), approvePolicy: vi.fn(), isPolicyApproved: vi.fn() };

function request(body: unknown) { return new Request('http://localhost/api/control', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }); }

describe('authenticated control-plane entry points', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createDb.mockReturnValue(db);
    mocks.createSecurityRepository.mockReturnValue(security);
    mocks.resolveControlContext.mockResolvedValue(context);
    mocks.authorizeControlCapability.mockImplementation((resolved: typeof context | null, capability: string) => Boolean(resolved?.capabilities.includes(capability as never)));
    mocks.loadControlCredentialVault.mockReturnValue({ encrypt: vi.fn(), decrypt: vi.fn() });
    security.addMembership.mockResolvedValue({ rows: [{ id: '50000000-0000-4000-8000-000000000001' }] });
    security.saveProviderCredential.mockResolvedValue(undefined);
    security.revokeProviderCredential.mockResolvedValue(undefined);
    security.grantConsent.mockResolvedValue(undefined);
    security.revokeConsent.mockResolvedValue(undefined);
    security.exportVisitor.mockResolvedValue({ visitor: null, consents: [] });
    security.deleteVisitor.mockResolvedValue(undefined);
    security.audit.mockResolvedValue(undefined);
    security.requestPolicyApproval.mockResolvedValue({ rows: [{ id: '50000000-0000-4000-8000-000000000001' }] });
    security.approvePolicy.mockResolvedValue({ rows: [{ id: '50000000-0000-4000-8000-000000000002' }] });
    security.isPolicyApproved.mockResolvedValue(true);
  });

  it('rejects unauthenticated membership administration before repository mutation', async () => {
    mocks.resolveControlContext.mockResolvedValue(null);
    const response = await membershipPost(request({ organizationId: context.organizationId, businessId: context.businessId, userId: context.actorId, role: 'analyst', capabilities: ['truth.read'] }));
    expect(response.status).toBe(403);
    expect(security.addMembership).not.toHaveBeenCalled();
  });

  it('rejects capability escalation and does not trust the target identity as the actor', async () => {
    const response = await membershipPost(request({ organizationId: context.organizationId, businessId: context.businessId, userId: '10000000-0000-4000-8000-000000000099', role: 'analyst', capabilities: ['organization.manage'] }));
    expect(response.status).toBe(403);
    expect(security.addMembership).not.toHaveBeenCalled();
  });

  it('stores credentials only after authorization and never returns the secret', async () => {
    const response = await credentialPost(request({ action: 'save', organizationId: context.organizationId, businessId: context.businessId, providerKey: 'shopify', secret: 'do-not-return', scopes: ['read_catalog'] }));
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty('secret');
    expect(security.saveProviderCredential).toHaveBeenCalledWith(expect.objectContaining({ createdBy: context.actorId, secret: 'do-not-return' }), expect.anything());
    expect(security.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'credential.save', actorId: context.actorId }));
  });

  it('rejects privacy operations for an authenticated merchant without privacy authority', async () => {
    mocks.authorizeControlCapability.mockReturnValue(false);
    const response = await privacyPost(request({ action: 'delete', organizationId: context.organizationId, businessId: context.businessId, visitorId: '60000000-0000-4000-8000-000000000001' }));
    expect(response.status).toBe(403);
    expect(security.deleteVisitor).not.toHaveBeenCalled();
  });

  it('audits an authorized visitor export in the verified tenant context', async () => {
    const response = await privacyPost(request({ action: 'export', organizationId: context.organizationId, businessId: context.businessId, visitorId: '60000000-0000-4000-8000-000000000001' }));
    expect(response.status).toBe(200);
    expect(security.exportVisitor).toHaveBeenCalledWith(expect.objectContaining({ organizationId: context.organizationId, businessId: context.businessId }));
    expect(security.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'privacy.export', actorId: context.actorId }));
  });

  it('rejects an approval that has no different requester', async () => {
    security.approvePolicy.mockRejectedValue(new Error('approval_separation_required'));
    const response = await policyPost(request({ action: 'approve', organizationId: context.organizationId, businessId: context.businessId, policyKey: 'baseline', revisionId: '70000000-0000-4000-8000-000000000001' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: 'approval_separation_required' });
  });
});
