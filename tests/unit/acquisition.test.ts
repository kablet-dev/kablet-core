import { describe, expect, it } from 'vitest';
import { acquisitionContextSchema } from '@kablet/domain';
import { acquisitionInputFromRequest } from '../../apps/web/lib/acquisition-input';

const ids = { id: '00000000-0000-0000-0000-000000000001', organizationId: '00000000-0000-0000-0000-000000000002', businessId: '00000000-0000-0000-0000-000000000003', visitorIdentityId: '00000000-0000-0000-0000-000000000004', visitorSessionId: '00000000-0000-0000-0000-000000000005', interactionSessionId: '00000000-0000-0000-0000-000000000006' };

describe('acquisition context', () => {
  it('validates the versioned explicit contract and optional fields', () => {
    expect(acquisitionContextSchema.parse({ contractVersion: 'acquisition-context.v1', ...ids, capturedAt: new Date(), landingPath: '/landing', referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null })).toMatchObject({ contractVersion: 'acquisition-context.v1', landingPath: '/landing' });
    expect(() => acquisitionContextSchema.parse({ contractVersion: 'acquisition-context.v2', ...ids, capturedAt: new Date(), landingPath: '/', referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null })).toThrow();
    expect(() => acquisitionContextSchema.parse({ contractVersion: 'acquisition-context.v1', ...ids, capturedAt: new Date(), landingPath: '/', referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, properties: {} })).toThrow();
    expect(() => acquisitionContextSchema.parse({ contractVersion: 'acquisition-context.v1', ...ids, organizationId: 'not-a-uuid', capturedAt: new Date(), landingPath: '/', referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null })).toThrow();
  });

  it('captures path, normalized referrer, and supported UTM fields only', () => {
    const input = acquisitionInputFromRequest(new Request('https://kablet.test/landing?utm_source=google&utm_medium=cpc&utm_campaign=pilot&utm_content=hero&utm_term=service&utm_unknown=x', { headers: { referer: 'https://search.test/path?secret=ignored' } }));
    expect(input).toEqual({ landingPath: '/landing', referrer: 'https://search.test/path', utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'pilot', utmContent: 'hero', utmTerm: 'service' });
  });

  it('omits malformed or oversized optional values while preserving interaction input', () => {
    const input = acquisitionInputFromRequest(new Request(`https://kablet.test/${'p'.repeat(2100)}?utm_source=${'x'.repeat(201)}&utm_medium=%FF`, { headers: { referer: 'not a url' } }));
    expect(input.referrer).toBeNull();
    expect(input.utmSource).toBeNull();
    expect(input.utmMedium).toBeNull();
    expect(input.landingPath.length).toBe(2048);
  });
});
