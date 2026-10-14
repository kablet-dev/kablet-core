import { z } from 'zod';

export const actorTypeSchema = z.enum(['merchant_user', 'platform_operator', 'system', 'visitor', 'integration']);
export type ActorType = z.infer<typeof actorTypeSchema>;

export const roleSchema = z.enum(['owner', 'admin', 'operator', 'analyst', 'support']);
export type Role = z.infer<typeof roleSchema>;

export const securityCapabilitySchema = z.enum([
  'organization.manage', 'business.manage', 'truth.read', 'truth.write',
  'integration.manage', 'experiment.manage', 'reporting.read', 'user.manage',
  'policy.approve', 'credential.read_metadata', 'credential.rotate', 'privacy.manage', 'platform.safety.manage', 'support.grant', 'audit.read',
]);
export type SecurityCapability = z.infer<typeof securityCapabilitySchema>;
export const supportGrantCapabilitySchema = z.enum(['truth.read', 'credential.read_metadata', 'privacy.manage', 'audit.read']);
export type SupportGrantCapability = z.infer<typeof supportGrantCapabilitySchema>;

export const membershipStatusSchema = z.enum(['invited', 'active', 'suspended', 'revoked']);
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export const authContextSchema = z.object({
  actorId: z.string().uuid(), actorType: actorTypeSchema,
  organizationId: z.string().uuid().nullable(), businessId: z.string().uuid().nullable(),
  capabilities: z.array(securityCapabilitySchema), sessionId: z.string().uuid().nullable(),
}).strict();
export type AuthContext = z.infer<typeof authContextSchema>;

export const policyApprovalEventTypeSchema = z.enum(['requested', 'approved', 'rejected']);
export type PolicyApprovalEventType = z.infer<typeof policyApprovalEventTypeSchema>;

export type ExternalIdentity = { provider: 'supabase'; subject: string };
export interface AuthProviderAdapter {
  verifySession(token: string): Promise<ExternalIdentity | null>;
}

export type AuthorizationResult = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'wrong_actor_type' | 'wrong_organization' | 'wrong_business' | 'missing_capability' | 'membership_inactive' };

export function authorize(context: AuthContext | null, input: { actorType?: ActorType; organizationId?: string; businessId?: string; capability: SecurityCapability }): AuthorizationResult {
  if (!context) return { allowed: false, reason: 'unauthenticated' };
  if (input.actorType && context.actorType !== input.actorType) return { allowed: false, reason: 'wrong_actor_type' };
  if (input.organizationId && context.organizationId !== input.organizationId) return { allowed: false, reason: 'wrong_organization' };
  if (input.businessId && context.businessId !== input.businessId) return { allowed: false, reason: 'wrong_business' };
  if (!context.capabilities.includes(input.capability)) return { allowed: false, reason: 'missing_capability' };
  return { allowed: true };
}

export function assertTenantContext(context: AuthContext | null, organizationId: string, businessId: string): void {
  const result = authorize(context, { actorType: 'merchant_user', organizationId, businessId, capability: 'truth.read' });
  if (!result.allowed) throw new Error(`authorization_denied:${result.reason}`);
}

export function authorizePolicyApproval(context: AuthContext | null, organizationId: string, businessId: string): AuthorizationResult {
  return authorize(context, { actorType: 'merchant_user', organizationId, businessId, capability: 'policy.approve' });
}

export const consentPurposeSchema = z.enum(['contact', 'personalization', 'intelligence_context', 'analytics', 'follow_up']);
export type ConsentPurpose = z.infer<typeof consentPurposeSchema>;

export function isConsentActive(input: { purpose: ConsentPurpose; grantedAt: Date | null; revokedAt: Date | null }, now = new Date()): boolean {
  return input.grantedAt !== null && input.grantedAt <= now && (input.revokedAt === null || input.revokedAt > now);
}

export function redactSecret(value: string): string { return value.length < 8 ? '[redacted]' : `${value.slice(0, 4)}…[redacted]`; }
