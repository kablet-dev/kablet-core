import { describe, expect, it } from 'vitest';
import { conversionMeasurementQuerySchema, conversionMeasurementSchema, experienceExposureSchema, interactionFactSchema } from '@kablet/domain';

const base = { contractVersion:'conversion-measurement.v1' as const, organizationId:'d4000000-0000-4000-8000-000000000001', businessId:'d4000000-0000-4000-8000-000000000002', conversionDefinitionId:'d4000000-0000-4000-8000-000000000003', windowStart:new Date('2026-01-01T00:00:00Z'), windowEnd:new Date('2026-01-02T00:00:00Z') };
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

const result = (eligibleActionConfirmationCount: number, conversionCount: number, conversionRate: number, attributedConversionCount = conversionCount, unattributedConversionCount = 0) => ({ ...base, denominatorKind:'action_confirmation' as const, eligibleActionConfirmationCount, conversionCount, conversionRate, attributedConversionCount, unattributedConversionCount });

describe('conversion measurement contract', () => {
  it('accepts the strict query/result', () => { expect(conversionMeasurementQuerySchema.parse(base)).toMatchObject(base); expect(conversionMeasurementSchema.parse(result(2, 1, 0.5, 1, 0))).toBeTruthy(); });
  it('rejects invalid windows', () => { expect(() => conversionMeasurementQuerySchema.parse({ ...base, windowEnd:base.windowStart })).toThrow(); });
  it('rejects unknown fields', () => { expect(() => conversionMeasurementSchema.parse({ ...result(1, 1, 1), payload:{} })).toThrow(); });
  it('rejects inconsistent attribution arithmetic', () => { expect(() => conversionMeasurementSchema.parse(result(1, 1, 1, 0, 2))).toThrow(); });
  it('enforces rate consistency without capping event-window rates', () => {
    expect(conversionMeasurementSchema.parse(result(2, 1, 0.5))).toBeTruthy();
    expect(() => conversionMeasurementSchema.parse(result(2, 1, 0.9))).toThrow();
    expect(conversionMeasurementSchema.parse(result(1, 2, 2))).toBeTruthy();
  });
  it('preserves zero-denominator event-window semantics', () => {
    expect(conversionMeasurementSchema.parse(result(0, 0, 0))).toBeTruthy();
    expect(conversionMeasurementSchema.parse(result(0, 2, 0))).toBeTruthy();
    expect(() => conversionMeasurementSchema.parse(result(0, 2, 0.1))).toThrow();
  });
});
