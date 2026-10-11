import { beforeEach, describe, expect, it, vi } from 'vitest';

const { expressIntent, interpretIntent, getInteractionService, getInteractionHandle } = vi.hoisted(() => ({ expressIntent: vi.fn(), interpretIntent: vi.fn(), getInteractionService: vi.fn(), getInteractionHandle: vi.fn() }));
vi.mock('../../apps/web/lib/server-interaction', () => ({ getInteractionService }));
vi.mock('../../apps/web/lib/interaction-cookie', () => ({ getInteractionHandle }));
vi.mock('../../apps/web/lib/interaction-service', () => ({ InteractionExpiredError: class InteractionExpiredError extends Error {} }));

import { POST } from '../../apps/web/app/api/interaction/intent/route';

const experience = { contractVersion: 'experience.v1', decisionId: '91000000-0000-4000-8000-000000000001', businessId: '91000000-0000-4000-8000-000000000002', decisionType: 'request_contact', components: [{ type: 'contact-request', fields: ['name', 'email'], channels: ['email'], consentPurpose: 'follow_up', consentVersion: '1', consentLabel: 'I agree to be contacted about this request.' }] };

describe('intent route dispatch and safe errors', () => {
  beforeEach(() => {
    expressIntent.mockReset(); interpretIntent.mockReset(); getInteractionService.mockReset().mockReturnValue({ expressIntent, interpretIntent }); getInteractionHandle.mockReset().mockResolvedValue('opaque-handle');
    expressIntent.mockResolvedValue(experience); interpretIntent.mockResolvedValue({ experience, interpretation: { contractVersion: 'intent-interpretation.v1', normalizedIntent: 'unclear', reasonCode: 'ambiguous', interpreterVersion: 'test' } });
  });

  it('dispatches structured intent without changing the existing contract', async () => {
    const response = await POST(new Request('http://localhost/api/interaction/intent', { method: 'POST', body: JSON.stringify({ intent: 'request_information', idempotencyKey: 'structured-1' }) }));
    expect(response.status).toBe(200);
    expect(getInteractionHandle).toHaveBeenCalled();
    expect(expressIntent).toHaveBeenCalledWith('opaque-handle', { intent: 'request_information', idempotencyKey: 'structured-1' });
    expect(interpretIntent).not.toHaveBeenCalled();
  });

  it('dispatches bounded free text to the interpreter service', async () => {
    const response = await POST(new Request('http://localhost/api/interaction/intent', { method: 'POST', body: JSON.stringify({ text: 'Tell me something surprising.', idempotencyKey: 'free-text-1' }) }));
    expect(response.status).toBe(200);
    expect(getInteractionHandle).toHaveBeenCalled();
    expect(interpretIntent).toHaveBeenCalledWith('opaque-handle', { text: 'Tell me something surprising.', idempotencyKey: 'free-text-1' });
    expect(expressIntent).not.toHaveBeenCalled();
  });

  it('returns safe errors for invalid input, expiry and interpreter unavailability', async () => {
    const invalid = await POST(new Request('http://localhost/api/interaction/intent', { method: 'POST', body: JSON.stringify({ text: '' }) }));
    expect(invalid.status).toBe(400);
    getInteractionHandle.mockResolvedValueOnce(undefined);
    expect((await POST(new Request('http://localhost/api/interaction/intent', { method: 'POST', body: JSON.stringify({ intent: 'request_information', idempotencyKey: 'expired-1' }) }))).status).toBe(401);
    getInteractionHandle.mockResolvedValue('opaque-handle');
    interpretIntent.mockRejectedValueOnce(new Error('intent interpreter is unavailable'));
    expect((await POST(new Request('http://localhost/api/interaction/intent', { method: 'POST', body: JSON.stringify({ text: 'unknown', idempotencyKey: 'unavailable-1' }) }))).status).toBe(503);
  });
});
