import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveControlContext: vi.fn(), authorizeControlCapability: vi.fn(), createDb: vi.fn(), createCommerceRepository: vi.fn(), createSecurityRepository: vi.fn(),
}));

vi.mock('../../apps/web/lib/control-auth', () => ({ resolveControlContext: mocks.resolveControlContext, authorizeControlCapability: mocks.authorizeControlCapability }));
vi.mock('@kablet/config', () => ({ loadControlServerConfig: () => ({ DATABASE_URL: 'postgres://control' }), loadServerConfig: () => ({ DATABASE_URL: 'postgres://runtime' }) }));
vi.mock('@kablet/db', () => ({ createDb: mocks.createDb, createCommerceRepository: mocks.createCommerceRepository, createSecurityRepository: mocks.createSecurityRepository }));

import { POST as disconnectPost } from '../../apps/web/app/api/control/shopify/disconnect/route';
import { POST as syncPost } from '../../apps/web/app/api/control/shopify/sync/route';

const context = { actorId: '10000000-0000-4000-8000-000000000001', capabilities: ['integration.manage'] };
const db = { pool: { end: vi.fn().mockResolvedValue(undefined) } };
const commerce = { disconnectConnection: vi.fn(), beginCatalogSync: vi.fn() };
const security = { revokeProviderCredential: vi.fn(), audit: vi.fn() };

function request(body: unknown) { return new Request('http://localhost/api/control/shopify', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }); }

describe('Shopify control routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createDb.mockReturnValue(db);
    mocks.createCommerceRepository.mockReturnValue(commerce);
    mocks.createSecurityRepository.mockReturnValue(security);
    mocks.resolveControlContext.mockResolvedValue(context);
    mocks.authorizeControlCapability.mockReturnValue(true);
    commerce.disconnectConnection.mockResolvedValue({ rows: [{ id: 'connection-1' }] });
    commerce.beginCatalogSync.mockResolvedValue({ rows: [{ id: 'sync-1' }] });
    security.revokeProviderCredential.mockResolvedValue(undefined);
    security.audit.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated disconnect before mutation', async () => {
    mocks.resolveControlContext.mockResolvedValue(null);
    const response = await disconnectPost(request({ organizationId: '20000000-0000-4000-8000-000000000001', businessId: '30000000-0000-4000-8000-000000000001', connectionId: '40000000-0000-4000-8000-000000000001', providerKey: 'shopify:demo.myshopify.com' }));
    expect(response.status).toBe(403);
    expect(commerce.disconnectConnection).not.toHaveBeenCalled();
  });

  it('disconnects locally, revokes the credential, and records redacted audit evidence', async () => {
    const response = await disconnectPost(request({ organizationId: '20000000-0000-4000-8000-000000000001', businessId: '30000000-0000-4000-8000-000000000001', connectionId: '40000000-0000-4000-8000-000000000001', providerKey: 'shopify:demo.myshopify.com' }));
    expect(response.status).toBe(200);
    expect(security.revokeProviderCredential).toHaveBeenCalledWith(expect.objectContaining({ providerKey: 'shopify:demo.myshopify.com' }));
    expect(security.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'provider.disconnect' }));
    expect(await response.json()).toEqual(expect.objectContaining({ disconnected: true, remoteUninstall: 'not_attempted' }));
  });

  it('starts a tenant-authorized sync without executing provider calls in the request', async () => {
    const response = await syncPost(request({ organizationId: '20000000-0000-4000-8000-000000000001', businessId: '30000000-0000-4000-8000-000000000001', connectionId: '40000000-0000-4000-8000-000000000001', kind: 'initial' }));
    expect(response.status).toBe(202);
    expect(commerce.beginCatalogSync).toHaveBeenCalledWith(expect.objectContaining({ syncKind: 'initial' }));
  });

  it('returns not found when a tenant does not own the requested connection', async () => {
    commerce.beginCatalogSync.mockRejectedValueOnce(new Error('connection_not_found'));
    const response = await syncPost(request({ organizationId: '20000000-0000-4000-8000-000000000001', businessId: '30000000-0000-4000-8000-000000000001', connectionId: '40000000-0000-4000-8000-000000000001', kind: 'initial' }));
    expect(response.status).toBe(404);
  });

  it('does not revoke credentials when the tenant-scoped disconnect finds no row', async () => {
    commerce.disconnectConnection.mockResolvedValueOnce({ rows: [] });
    const response = await disconnectPost(request({ organizationId: '20000000-0000-4000-8000-000000000001', businessId: '30000000-0000-4000-8000-000000000001', connectionId: '40000000-0000-4000-8000-000000000001', providerKey: 'shopify:demo.myshopify.com' }));
    expect(response.status).toBe(404);
    expect(security.revokeProviderCredential).not.toHaveBeenCalled();
  });
});
