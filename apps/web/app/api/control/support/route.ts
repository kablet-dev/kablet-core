import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDb, createSecurityRepository } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { supportGrantCapabilitySchema } from '@kablet/domain';
import { authorizePlatformCapability, resolvePlatformOperatorContext } from '../../../../lib/control-auth';

const inputSchema = z.object({
  action: z.enum(['request', 'approve', 'revoke']), grantId: z.string().uuid().optional(), organizationId: z.string().uuid().optional(), businessId: z.string().uuid().optional(),
  purpose: z.string().trim().min(10).max(500).optional(), capabilities: z.array(supportGrantCapabilitySchema).min(1).max(4).optional(), expiresAt: z.coerce.date().optional(),
}).strict();

export async function POST(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const input = inputSchema.parse(await request.json());
    const context = await resolvePlatformOperatorContext();
    if (!authorizePlatformCapability(context, 'support.grant')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    runtime = createDb(loadServerConfig().DATABASE_URL);
    const security = createSecurityRepository(runtime.db);
    if (input.action === 'request') {
      if (!input.organizationId || !input.businessId || !input.purpose || !input.capabilities || !input.expiresAt) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
      const result = await security.requestSupportGrant({ actorId: context!.actorId, sessionId: context!.sessionId!, organizationId: input.organizationId, businessId: input.businessId, purpose: input.purpose, capabilities: input.capabilities, expiresAt: input.expiresAt });
      await security.audit({ organizationId: input.organizationId, businessId: input.businessId, actorId: context!.actorId, actorType: 'platform_operator', action: 'support.grant.request', resourceType: 'support_grant', resourceId: String(result.rows[0]?.id), metadata: { purpose: input.purpose, capabilities: input.capabilities, expiresAt: input.expiresAt.toISOString() } });
      return NextResponse.json({ grantId: result.rows[0]?.id, expiresAt: result.rows[0]?.expires_at }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!input.grantId) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    if (input.action === 'approve') {
      const result = await security.approveSupportGrant({ actorId: context!.actorId, sessionId: context!.sessionId!, grantId: input.grantId });
      await security.auditPlatform({ actorId: context!.actorId, sessionId: context!.sessionId!, action: 'support.grant.approve', resourceType: 'support_grant', resourceId: input.grantId });
      return NextResponse.json({ grantId: result.rows[0]?.id, approved: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const result = await security.revokeSupportGrant({ actorId: context!.actorId, sessionId: context!.sessionId!, grantId: input.grantId });
    await security.auditPlatform({ actorId: context!.actorId, sessionId: context!.sessionId!, action: 'support.grant.revoke', resourceType: 'support_grant', resourceId: input.grantId });
    return NextResponse.json({ grantId: result.rows[0]?.id, revoked: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    if (error instanceof Error && error.message === 'support_grant_self_approval') return NextResponse.json({ code: 'self_approval_denied' }, { status: 403 });
    if (error instanceof Error && (error.message === 'support_grant_denied' || error.message === 'support_grant_unavailable' || error.message === 'support_grant_target_invalid')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
