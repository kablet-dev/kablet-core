import { describe, expect, it } from 'vitest';
import { assertTenantContext, authorize, authorizePolicyApproval, isConsentActive, redactSecret } from '@kablet/domain';

const merchant = { actorId: '10000000-0000-4000-8000-000000000001', actorType: 'merchant_user' as const, organizationId: '20000000-0000-4000-8000-000000000001', businessId: '30000000-0000-4000-8000-000000000001', capabilities: ['truth.read', 'policy.approve'], sessionId: '40000000-0000-4000-8000-000000000001' };

describe('identity and tenant authorization contracts', () => {
  it('denies missing context and wrong actor type by default', () => {
    expect(authorize(null, { capability: 'truth.read' })).toEqual({ allowed: false, reason: 'unauthenticated' });
    expect(authorize({ ...merchant, actorType: 'platform_operator' }, { actorType: 'merchant_user', capability: 'truth.read' })).toEqual({ allowed: false, reason: 'wrong_actor_type' });
  });

  it('denies cross-tenant and over-broad capability access', () => {
    expect(authorize(merchant, { organizationId: '20000000-0000-4000-8000-000000000099', capability: 'truth.read' })).toEqual({ allowed: false, reason: 'wrong_organization' });
    expect(authorize(merchant, { businessId: '30000000-0000-4000-8000-000000000099', capability: 'truth.read' })).toEqual({ allowed: false, reason: 'wrong_business' });
    expect(authorize(merchant, { capability: 'credential.rotate' })).toEqual({ allowed: false, reason: 'missing_capability' });
  });

  it('requires merchant tenant context for sensitive operations', () => {
    expect(() => assertTenantContext(merchant, merchant.organizationId!, merchant.businessId!)).not.toThrow();
    expect(() => assertTenantContext(null, merchant.organizationId!, merchant.businessId!)).toThrow('authorization_denied:unauthenticated');
  });

  it('does not allow platform authority or a different tenant to approve merchant policy', () => {
    expect(authorizePolicyApproval(merchant, merchant.organizationId!, merchant.businessId!)).toEqual({ allowed: true });
    expect(authorizePolicyApproval({ ...merchant, actorType: 'platform_operator' }, merchant.organizationId!, merchant.businessId!)).toEqual({ allowed: false, reason: 'wrong_actor_type' });
    expect(authorizePolicyApproval(merchant, merchant.organizationId!, '30000000-0000-4000-8000-000000000099')).toEqual({ allowed: false, reason: 'wrong_business' });
  });

  it('enforces consent lifecycle and redacts secrets', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(isConsentActive({ purpose: 'analytics', grantedAt: new Date('2025-12-01T00:00:00Z'), revokedAt: null }, now)).toBe(true);
    expect(isConsentActive({ purpose: 'analytics', grantedAt: new Date('2025-12-01T00:00:00Z'), revokedAt: new Date('2025-12-15T00:00:00Z') }, now)).toBe(false);
    expect(redactSecret('provider-secret-value')).toBe('prov…[redacted]');
    expect(redactSecret('short')).toBe('[redacted]');
  });
});
