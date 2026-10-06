import { describe, expect, it } from 'vitest';
import { experienceExposureSchema, interactionFactSchema } from '@kablet/domain';

const ids = { id:'20000000-0000-0000-0000-000000000001', organizationId:'20000000-0000-0000-0000-000000000002', businessId:'20000000-0000-0000-0000-000000000003', visitorIdentityId:'20000000-0000-0000-0000-000000000004', visitorSessionId:'20000000-0000-0000-0000-000000000005', interactionSessionId:'20000000-0000-0000-0000-000000000006', decisionId:'20000000-0000-0000-0000-000000000007' };

describe('03B measurement facts', () => {
  it('validates the closed exposure contract', () => {
    expect(experienceExposureSchema.parse({ contractVersion:'experience-exposure.v1', ...ids, exposureKind:'server_response', exposedAt:new Date() }).exposureKind).toBe('server_response');
    expect(() => experienceExposureSchema.parse({ contractVersion:'experience-exposure.v1', ...ids, exposureKind:'browser_rendered', exposedAt:new Date() })).toThrow();
    expect(() => experienceExposureSchema.parse({ contractVersion:'experience-exposure.v1', ...ids, exposureKind:'server_response', exposedAt:new Date(), properties:{} })).toThrow();
  });
  it('validates the closed interaction taxonomy and nullable links', () => {
    expect(interactionFactSchema.parse({ contractVersion:'interaction-fact.v1', ...ids, exposureId:null, interactionKind:'qualification_answered', occurredAt:new Date(), idempotencyKey:'qualification:1', actionRequestId:null }).interactionKind).toBe('qualification_answered');
    expect(() => interactionFactSchema.parse({ contractVersion:'interaction-fact.v1', ...ids, exposureId:null, interactionKind:'click', occurredAt:new Date(), idempotencyKey:'x', actionRequestId:null })).toThrow();
    expect(() => interactionFactSchema.parse({ contractVersion:'interaction-fact.v1', ...ids, exposureId:null, interactionKind:'intent_expressed', occurredAt:new Date(), idempotencyKey:'x', actionRequestId:null, outcome:'verified' })).toThrow();
  });
});
