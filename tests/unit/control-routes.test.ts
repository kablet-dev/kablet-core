import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveControlContext: vi.fn(), authorizeControlCapability: vi.fn(), resolvePlatformOperatorContext: vi.fn(), authorizePlatformCapability: vi.fn(), resolveSupportControlContext: vi.fn(),
  createDb: vi.fn(), createSecurityRepository: vi.fn(), createIntentPolicyRepository: vi.fn(), createNativeEvidenceRepository: vi.fn(),
  loadControlCredentialVault: vi.fn(),
}));

vi.mock('../../apps/web/lib/control-auth', () => ({ resolveControlContext: mocks.resolveControlContext, authorizeControlCapability: mocks.authorizeControlCapability, resolvePlatformOperatorContext: mocks.resolvePlatformOperatorContext, authorizePlatformCapability: mocks.authorizePlatformCapability, resolveSupportControlContext: mocks.resolveSupportControlContext }));
vi.mock('../../apps/web/lib/control-credential-vault', () => ({ loadControlCredentialVault: mocks.loadControlCredentialVault }));
vi.mock('@kablet/config', () => ({ loadServerConfig: () => ({ DATABASE_URL: 'postgres://test' }), loadControlServerConfig: () => ({ DATABASE_URL: 'postgres://control-test' }) }));
vi.mock('@kablet/db', () => ({ createDb: mocks.createDb, createSecurityRepository: mocks.createSecurityRepository, createIntentPolicyRepository: mocks.createIntentPolicyRepository, createNativeEvidenceRepository: mocks.createNativeEvidenceRepository }));

import { POST as membershipPost } from '../../apps/web/app/api/control/membership/route';
import { POST as credentialPost } from '../../apps/web/app/api/control/credential/route';
import { POST as privacyPost } from '../../apps/web/app/api/control/privacy/route';
import { POST as policyPost } from '../../apps/web/app/api/control/policy/route';
import { POST as supportPost } from '../../apps/web/app/api/control/support/route';
import { POST as platformSafetyPost } from '../../apps/web/app/api/control/platform-safety/route';
import { GET as evidenceGet } from '../../apps/web/app/api/control/evidence/route';

const context = { actorId: '10000000-0000-4000-8000-000000000001', actorType: 'merchant_user' as const, organizationId: '20000000-0000-4000-8000-000000000001', businessId: '30000000-0000-4000-8000-000000000001', capabilities: ['user.manage', 'credential.rotate', 'privacy.manage', 'policy.approve', 'truth.read'] as const, sessionId: '40000000-0000-4000-8000-000000000001' };
const platformContext = { actorId: '10000000-0000-4000-8000-000000000002', actorType: 'platform_operator' as const, organizationId: null, businessId: null, capabilities: ['support.grant', 'platform.safety.manage'] as const, sessionId: '40000000-0000-4000-8000-000000000002' };
const db = { pool: { end: vi.fn().mockResolvedValue(undefined) }, db: {} };
const security = { addMembership: vi.fn(), audit: vi.fn(), auditPlatform: vi.fn(), saveProviderCredential: vi.fn(), revokeProviderCredential: vi.fn(), grantConsent: vi.fn(), revokeConsent: vi.fn(), exportVisitor: vi.fn(), deleteVisitor: vi.fn(), requestPolicyApproval: vi.fn(), approvePolicy: vi.fn(), isPolicyApproved: vi.fn(), requestSupportGrant: vi.fn(), approveSupportGrant: vi.fn(), revokeSupportGrant: vi.fn(), setPlatformSafetyRule: vi.fn() };
const evidence = { getTimeline: vi.fn() };

function request(body: unknown) { return new Request('http://localhost/api/control', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }); }

describe('authenticated control-plane entry points', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createDb.mockReturnValue(db);
    mocks.createSecurityRepository.mockReturnValue(security);
    mocks.createNativeEvidenceRepository.mockReturnValue(evidence);
    mocks.resolveControlContext.mockResolvedValue(context);
    mocks.authorizeControlCapability.mockImplementation((resolved: typeof context | null, capability: string) => Boolean(resolved?.capabilities.includes(capability as never)));
    mocks.resolvePlatformOperatorContext.mockResolvedValue(platformContext);
    mocks.authorizePlatformCapability.mockImplementation((resolved: typeof platformContext | null, capability: string) => Boolean(resolved?.capabilities.includes(capability as never)));
    mocks.resolveSupportControlContext.mockResolvedValue({ ...context, actorType: 'platform_operator' as const });
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
    security.requestSupportGrant.mockResolvedValue({ rows: [{ id: '80000000-0000-4000-8000-000000000001', expires_at: new Date('2030-01-01T00:00:00.000Z') }] });
    security.approveSupportGrant.mockResolvedValue({ rows: [{ id: '80000000-0000-4000-8000-000000000001' }] });
    security.revokeSupportGrant.mockResolvedValue({ rows: [{ id: '80000000-0000-4000-8000-000000000001' }] });
    security.setPlatformSafetyRule.mockResolvedValue({ rows: [{ rule_key: 'baseline', effect: 'deny', version: 2 }] });
    evidence.getTimeline.mockResolvedValue({ events: [], verifiedOutcomes: [], nextCursor: null });
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

  it('records a credential replacement as rotation without exposing key material', async () => {
    security.saveProviderCredential.mockResolvedValue({ rows: [{ credential_revision: 2 }] });
    const response = await credentialPost(request({ action: 'save', organizationId: context.organizationId, businessId: context.businessId, providerKey: 'shopify', secret: 'replacement-secret', scopes: ['write_orders'] }));
    expect(response.status).toBe(200);
    expect(security.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'credential.rotate', metadata: { providerKey: 'shopify', scopes: ['write_orders'] } }));
    expect(await response.json()).not.toHaveProperty('secret');
  });

  it('fails closed when credential encryption configuration is unavailable', async () => {
    mocks.loadControlCredentialVault.mockImplementation(() => { throw new Error('credential vault is not configured'); });
    const response = await credentialPost(request({ action: 'save', organizationId: context.organizationId, businessId: context.businessId, providerKey: 'shopify', secret: 'secret', scopes: ['read_catalog'] }));
    expect(response.status).toBe(503);
    expect(security.saveProviderCredential).not.toHaveBeenCalled();
    expect(security.audit).not.toHaveBeenCalled();
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

  it('reports deletion propagation as pending without exposing visitor data', async () => {
    security.deleteVisitor.mockResolvedValue({ rows: [{ deleted: true }] });
    const response = await privacyPost(request({ action: 'delete', organizationId: context.organizationId, businessId: context.businessId, visitorId: '60000000-0000-4000-8000-000000000001' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ action: 'delete', accepted: true, propagationStatus: 'pending' });
    expect(security.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'privacy.delete', actorId: context.actorId }));
  });

  it('rejects an approval that has no different requester', async () => {
    security.approvePolicy.mockRejectedValue(new Error('approval_separation_required'));
    const response = await policyPost(request({ action: 'approve', organizationId: context.organizationId, businessId: context.businessId, policyKey: 'baseline', revisionId: '70000000-0000-4000-8000-000000000001' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: 'approval_separation_required' });
  });

  it('uses the verified platform operator for a scoped support grant', async () => {
    const response = await supportPost(request({ action: 'request', organizationId: context.organizationId, businessId: context.businessId, purpose: 'Investigate an authorized issue', capabilities: ['privacy.manage'], expiresAt: '2030-01-01T00:00:00.000Z' }));
    expect(response.status).toBe(201);
    expect(security.requestSupportGrant).toHaveBeenCalledWith(expect.objectContaining({ actorId: platformContext.actorId, organizationId: context.organizationId, businessId: context.businessId, capabilities: ['privacy.manage'] }));
  });

  it('rejects support access when the platform session is absent or lacks support authority', async () => {
    mocks.resolvePlatformOperatorContext.mockResolvedValue(null);
    let response = await supportPost(request({ action: 'approve', grantId: '80000000-0000-4000-8000-000000000001' }));
    expect(response.status).toBe(403);
    mocks.resolvePlatformOperatorContext.mockResolvedValue({ ...platformContext, capabilities: ['audit.read'] });
    response = await supportPost(request({ action: 'approve', grantId: '80000000-0000-4000-8000-000000000001' }));
    expect(response.status).toBe(403);
    expect(security.approveSupportGrant).not.toHaveBeenCalled();
  });

  it('rejects self-approval and preserves support grant revocation', async () => {
    security.approveSupportGrant.mockRejectedValueOnce(new Error('support_grant_self_approval'));
    let response = await supportPost(request({ action: 'approve', grantId: '80000000-0000-4000-8000-000000000001' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: 'self_approval_denied' });
    response = await supportPost(request({ action: 'revoke', grantId: '80000000-0000-4000-8000-000000000001' }));
    expect(response.status).toBe(200);
    expect(security.auditPlatform).toHaveBeenCalledWith(expect.objectContaining({ action: 'support.grant.revoke', actorId: platformContext.actorId }));
  });

  it('allows only an authorized platform operator to change platform safety', async () => {
    const response = await platformSafetyPost(request({ ruleKey: 'baseline', effect: 'deny', reason: 'Blocked pending platform safety review' }));
    expect(response.status).toBe(200);
    expect(security.setPlatformSafetyRule).toHaveBeenCalledWith(expect.objectContaining({ actorId: platformContext.actorId, effect: 'deny' }));
    expect(security.auditPlatform).toHaveBeenCalledWith(expect.objectContaining({ action: 'platform.safety.deny', actorId: platformContext.actorId }));
    mocks.authorizePlatformCapability.mockReturnValue(false);
    expect((await platformSafetyPost(request({ ruleKey: 'baseline', effect: 'allow', reason: 'Attempted merchant override' }))).status).toBe(403);
  });

  it('keeps the evidence timeline behind reporting authorization and tenant-scoped query inputs', async () => {
    const url = new URL('http://localhost/api/control/evidence');
    url.searchParams.set('organizationId', context.organizationId);
    url.searchParams.set('businessId', context.businessId);
    url.searchParams.set('storeId', '50000000-0000-4000-8000-000000000001');
    url.searchParams.set('visitorSessionId', '60000000-0000-4000-8000-000000000001');
    mocks.authorizeControlCapability.mockReturnValue(false);
    expect((await evidenceGet(new Request(url))).status).toBe(403);
    mocks.authorizeControlCapability.mockReturnValue(true);
    const response = await evidenceGet(new Request(url));
    expect(response.status).toBe(200);
    expect(evidence.getTimeline).toHaveBeenCalledWith(expect.objectContaining({ organizationId: context.organizationId, businessId: context.businessId, storeId: '50000000-0000-4000-8000-000000000001' }), '60000000-0000-4000-8000-000000000001', 100, undefined);
  });
});
