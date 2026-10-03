import { describe, expect, it } from 'vitest';
import { decisionToExperience, experienceInputSchema } from '@kablet/domain';

const base = { contractVersion: 'experience-input.v1' as const, decisionId: '10000000-0000-4000-8000-000000000001', decisionContractVersion: 'decision.v1' as const, organizationId: '10000000-0000-4000-8000-000000000002', businessId: '10000000-0000-4000-8000-000000000003', visitorIdentityId: '10000000-0000-4000-8000-000000000004', sessionId: '10000000-0000-4000-8000-000000000005', visitorStateRevisionId: '10000000-0000-4000-8000-000000000006', businessTruthRefs: [], rationale: [{ code: 'intent_missing' as const, source: 'visitor_state' as const }] };
const offering = { offeringId: '20000000-0000-4000-8000-000000000001', offeringRevisionId: '20000000-0000-4000-8000-000000000002', name: 'A considered option', description: 'A verified projection supplied by the server boundary.', priceLabel: 'Price available on request' };

describe('decisionToExperience', () => {
  it.each(['clarify_intent', 'present_offering', 'request_time_window', 'offer_next_step', 'no_safe_decision'] as const)('maps %s deterministically', decisionType => {
    const input = { ...base, decisionType };
    const first = decisionToExperience(input, decisionType === 'present_offering' ? [offering] : []);
    expect(first).toEqual(decisionToExperience(input, decisionType === 'present_offering' ? [offering] : []));
    expect(first.contractVersion).toBe('experience.v1');
  });
  it('rejects malformed experience input before rendering', () => { expect(() => decisionToExperience({ ...base, decisionType: 'clarify_intent', decisionId: 'bad' })).toThrow(); });
  it('requires a validated renderable offering projection', () => { expect(() => decisionToExperience({ ...base, decisionType: 'present_offering' }, [{ ...offering, offeringId: 'bad' }])).toThrow(); });
  it('validates the public input contract', () => { expect(experienceInputSchema.parse({ ...base, decisionType: 'clarify_intent' }).contractVersion).toBe('experience-input.v1'); });
  it('renders the fictional offering projection only when explicitly supplied', () => { expect(decisionToExperience({ ...base, decisionType: 'present_offering' }, [offering]).components[0].type).toBe('offering-list'); expect(decisionToExperience({ ...base, decisionType: 'present_offering' }).components[0].type).toBe('safe-fallback'); });
});
