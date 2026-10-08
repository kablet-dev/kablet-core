import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resume, getInteractionService, getInteractionHandle } = vi.hoisted(() => ({ resume: vi.fn(), getInteractionService: vi.fn(), getInteractionHandle: vi.fn() }));
vi.mock('../../apps/web/lib/server-interaction', () => ({ getInteractionService }));
vi.mock('../../apps/web/lib/interaction-cookie', () => ({ getInteractionHandle }));
vi.mock('../../apps/web/lib/interaction-service', () => ({ InteractionExpiredError: class InteractionExpiredError extends Error {} }));

import { GET } from '../../apps/web/app/api/interaction/resume/route';

const experience = { contractVersion: 'experience.v1', decisionId: '91000000-0000-4000-8000-000000000001', businessId: '91000000-0000-4000-8000-000000000002', decisionType: 'request_contact', components: [{ type: 'contact-request', fields: ['name', 'email'], channels: ['email'], consentPurpose: 'follow_up', consentVersion: '1', consentLabel: 'I agree to be contacted about this request.' }] };

describe('interaction resume route', () => {
  beforeEach(() => { resume.mockReset(); getInteractionService.mockReset().mockReturnValue({ resume }); getInteractionHandle.mockReset().mockResolvedValue('opaque-handle'); });

  it('returns the persisted experience for a valid cookie', async () => {
    resume.mockResolvedValue(experience);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ experience: { decisionId: experience.decisionId } });
    expect(resume).toHaveBeenCalledWith('opaque-handle');
  });

  it('returns an explicit non-resumable response without a cookie', async () => {
    getInteractionHandle.mockResolvedValue(undefined);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'interaction_expired' });
    expect(resume).not.toHaveBeenCalled();
  });

  it('does not disguise expiry or lineage failure as a fresh start', async () => {
    const { InteractionExpiredError } = await import('../../apps/web/lib/interaction-service');
    resume.mockRejectedValueOnce(new InteractionExpiredError()).mockRejectedValueOnce(new Error('lineage inconsistent'));
    expect((await GET()).status).toBe(401);
    expect((await GET()).status).toBe(503);
  });

  it('returns server failure for database errors', async () => {
    resume.mockRejectedValue(new Error('database unavailable'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'unavailable' });
  });
});
