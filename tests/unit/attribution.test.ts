import { describe, expect, it } from 'vitest';
import { attributionSchema } from '@kablet/domain';

const base = {
  contractVersion: 'attribution.v1' as const,
  id: 'a3000000-0000-4000-8000-000000000001',
  organizationId: 'a3000000-0000-4000-8000-000000000002',
  businessId: 'a3000000-0000-4000-8000-000000000003',
  outcomeId: 'a3000000-0000-4000-8000-000000000004',
  acquisitionContextId: 'a3000000-0000-4000-8000-000000000005',
  interactionSessionId: 'a3000000-0000-4000-8000-000000000006',
  rule: 'same_interaction_acquisition.v1' as const,
  attributedAt: new Date(),
};

describe('attribution.v1', () => {
  it('accepts the strict same-interaction contract', () => expect(attributionSchema.parse(base)).toMatchObject(base));
  it('rejects arbitrary fields and other rules', () => {
    expect(() => attributionSchema.parse({ ...base, extra: 'nope' })).toThrow();
    expect(() => attributionSchema.parse({ ...base, rule: 'last_touch.v1' })).toThrow();
  });
});
