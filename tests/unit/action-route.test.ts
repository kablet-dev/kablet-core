import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirm, createActionService, createDb, dbPool, getInteractionHandle } = vi.hoisted(() => { const dbPool = { end: vi.fn().mockResolvedValue(undefined) }; return { confirm: vi.fn(), createActionService: vi.fn(), createDb: vi.fn(() => ({ db: {}, pool: dbPool })), dbPool, getInteractionHandle: vi.fn() }; });
vi.mock('@kablet/config', () => ({ loadServerConfig: () => ({ DATABASE_URL: 'postgres://test' }), loadInteractionServerConfig: () => ({ KABLET_INTERACTION_ORGANIZATION_ID: '00000000-0000-4000-8000-000000000001', KABLET_INTERACTION_BUSINESS_ID: '00000000-0000-4000-8000-000000000002' }) }));
vi.mock('@kablet/db', () => ({ createDb }));
vi.mock('../../apps/web/lib/action-service', () => ({ createActionService }));
vi.mock('../../apps/web/lib/interaction-cookie', () => ({ getInteractionHandle }));

import { POST } from '../../apps/web/app/api/interaction/action/route';

describe('action route authority boundary', () => {
  beforeEach(() => { confirm.mockReset(); createActionService.mockReset(); createActionService.mockReturnValue({ confirm }); createDb.mockClear(); dbPool.end.mockClear(); getInteractionHandle.mockReset(); getInteractionHandle.mockResolvedValue('opaque-test-handle'); });

  it('passes only server-resolved session and tenant authority to the service', async () => {
    confirm.mockResolvedValue({ status: 'verified', actionRequestId: '00000000-0000-4000-8000-000000000003', outcomeId: '00000000-0000-4000-8000-000000000004' });
    const response = await POST(new Request('http://localhost/api/interaction/action', { method: 'POST', body: JSON.stringify({ decisionId: '00000000-0000-4000-8000-000000000005', idempotencyKey: 'route-key', confirmed: true }) }));
    expect(response.status).toBe(200);
    expect(getInteractionHandle).toHaveBeenCalledOnce();
    expect(createDb).toHaveBeenCalledOnce();
    expect(dbPool.end).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith({ handle: 'opaque-test-handle', decisionId: '00000000-0000-4000-8000-000000000005', idempotencyKey: 'route-key', visitorConfirmed: true });
  });

  it('rejects browser authority overrides before calling the service', async () => {
    const response = await POST(new Request('http://localhost/api/interaction/action', { method: 'POST', body: JSON.stringify({ decisionId: '00000000-0000-4000-8000-000000000005', idempotencyKey: 'route-key', confirmed: true, organizationId: 'attacker' }) }));
    expect(response.status).toBe(503);
    expect(getInteractionHandle).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
});
