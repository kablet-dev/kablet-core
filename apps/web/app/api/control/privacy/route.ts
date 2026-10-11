import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDb, createSecurityRepository } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { authorizeControlCapability, resolveControlContext } from '../../../../lib/control-auth';

const inputSchema = z.object({
  action: z.enum(['grant_consent', 'revoke_consent', 'export', 'delete']), organizationId: z.string().uuid(), businessId: z.string().uuid(), visitorId: z.string().uuid(),
  purpose: z.enum(['contact', 'personalization', 'intelligence_context', 'analytics']).optional(), version: z.string().trim().min(1).max(64).optional(),
}).strict();

export async function POST(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const input = inputSchema.parse(await request.json());
    if ((input.action === 'grant_consent' || input.action === 'revoke_consent') && (!input.purpose || (input.action === 'grant_consent' && !input.version))) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    const context = await resolveControlContext(input.organizationId, input.businessId);
    if (!authorizeControlCapability(context, 'privacy.manage')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    runtime = createDb(loadServerConfig().DATABASE_URL);
    const security = createSecurityRepository(runtime.db);
    if (input.action === 'grant_consent') await security.grantConsent({ organizationId: input.organizationId, businessId: input.businessId, visitorId: input.visitorId, purpose: input.purpose!, version: input.version! });
    if (input.action === 'revoke_consent') await security.revokeConsent({ organizationId: input.organizationId, businessId: input.businessId, visitorId: input.visitorId, purpose: input.purpose! });
    if (input.action === 'export') {
      const exported = await security.exportVisitor({ organizationId: input.organizationId, businessId: input.businessId, visitorId: input.visitorId });
      await security.audit({ organizationId: input.organizationId, businessId: input.businessId, actorId: context!.actorId, actorType: context!.actorType, action: 'privacy.export', resourceType: 'visitor', resourceId: input.visitorId });
      return NextResponse.json({ action: input.action, data: exported }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (input.action === 'delete') await security.deleteVisitor({ organizationId: input.organizationId, businessId: input.businessId, visitorId: input.visitorId });
    await security.audit({ organizationId: input.organizationId, businessId: input.businessId, actorId: context!.actorId, actorType: context!.actorType, action: `privacy.${input.action.replace('_consent', '')}`, resourceType: 'visitor', resourceId: input.visitorId, metadata: input.purpose ? { purpose: input.purpose, version: input.version } : {} });
    return NextResponse.json({ action: input.action, accepted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
