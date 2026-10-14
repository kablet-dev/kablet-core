import { cookies } from 'next/headers';
import { createDb, createSecurityRepository } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import type { SecurityCapability, SupportGrantCapability } from '@kablet/domain';
import { createSupabaseAuthAdapter } from './supabase-auth';

export const controlSessionCookieName = 'kablet_control_session';
export const platformSessionCookieName = 'kablet_platform_session';

let cachedRepository: ReturnType<typeof createSecurityRepository> | undefined;
function repository() { if (!cachedRepository) cachedRepository = createSecurityRepository(createDb(loadServerConfig().DATABASE_URL).db); return cachedRepository; }

export async function issueControlSession(providerToken: string) {
  const identity = await createSupabaseAuthAdapter().verifySession(providerToken);
  if (!identity) return null;
  const security = repository();
  const user = await security.upsertUser(identity.provider, identity.subject);
  const session = await security.createSession(String(user.id), new Date(Date.now() + 8 * 60 * 60 * 1000));
  const store = await cookies();
  store.set(controlSessionCookieName, session.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: session.expiresAt });
  return { sessionId: session.id, expiresAt: session.expiresAt };
}

export async function resolveControlContext(organizationId: string, businessId: string) {
  const token = (await cookies()).get(controlSessionCookieName)?.value;
  if (!token) return null;
  return repository().resolveMerchantContext(token, organizationId, businessId);
}

export function authorizeControlCapability(context: Awaited<ReturnType<typeof resolveControlContext>>, capability: SecurityCapability) {
  return context?.capabilities.includes(capability) ?? false;
}

export async function resolvePlatformOperatorContext() {
  const token = (await cookies()).get(platformSessionCookieName)?.value;
  if (!token) return null;
  return repository().resolvePlatformContext(token);
}

export function authorizePlatformCapability(context: Awaited<ReturnType<typeof resolvePlatformOperatorContext>>, capability: Extract<SecurityCapability, 'support.grant' | 'platform.safety.manage'>) {
  return context?.capabilities.includes(capability) ?? false;
}

export async function resolveSupportControlContext(organizationId: string, businessId: string, grantId: string, capability: SupportGrantCapability) {
  const platform = await resolvePlatformOperatorContext();
  if (!platform) return null;
  await repository().resolveSupportGrant({ actorId: platform.actorId, sessionId: platform.sessionId!, grantId, organizationId, businessId, capability });
  return { ...platform, organizationId, businessId, capabilities: [capability], sessionId: platform.sessionId };
}

export async function issuePlatformOperatorSession(providerToken: string) {
  const identity = await createSupabaseAuthAdapter().verifySession(providerToken);
  if (!identity) return null;
  const security = repository();
  const user = await security.upsertUser(identity.provider, identity.subject);
  if (!(await security.isRegisteredPlatformOperator(String(user.id)))) return null;
  const session = await security.createSession(String(user.id), new Date(Date.now() + 60 * 60 * 1000), 'platform_operator');
  const store = await cookies();
  store.set(platformSessionCookieName, session.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: session.expiresAt });
  return { sessionId: session.id, expiresAt: session.expiresAt };
}

export async function revokeControlSession() {
  const store = await cookies();
  const token = store.get(controlSessionCookieName)?.value;
  if (token) {
    const security = repository();
    const session = await security.resolveSession(token);
    if (session) await security.revokeSession(session.sessionId);
  }
  store.delete(controlSessionCookieName);
}

export async function revokePlatformOperatorSession() {
  const store = await cookies();
  const token = store.get(platformSessionCookieName)?.value;
  if (token) {
    const security = repository();
    const session = await security.resolveSession(token);
    if (session?.actorType === 'platform_operator') await security.revokeSession(session.sessionId);
  }
  store.delete(platformSessionCookieName);
}
