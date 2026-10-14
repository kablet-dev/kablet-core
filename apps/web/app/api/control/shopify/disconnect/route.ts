import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCommerceRepository, createDb, createSecurityRepository } from '@kablet/db';
import { loadControlServerConfig } from '@kablet/config';
import { authorizeControlCapability, resolveControlContext } from '../../../../../lib/control-auth';

const inputSchema = z.object({ organizationId: z.string().uuid(), businessId: z.string().uuid(), connectionId: z.string().uuid(), providerKey: z.string().trim().min(1).max(100) }).strict();

export async function POST(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const input = inputSchema.parse(await request.json());
    const context = await resolveControlContext(input.organizationId, input.businessId);
    if (!authorizeControlCapability(context, 'integration.manage')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    runtime = createDb(loadControlServerConfig().DATABASE_URL);
    const commerce = createCommerceRepository(runtime.db);
    const security = createSecurityRepository(runtime.db);
    const result = await commerce.disconnectConnection({ organizationId: input.organizationId, businessId: input.businessId, connectionId: input.connectionId });
    if (result.rows.length === 0) return NextResponse.json({ code: 'connection_not_found' }, { status: 404 });
    await security.revokeProviderCredential({ organizationId: input.organizationId, businessId: input.businessId, providerKey: input.providerKey });
    await security.audit({ organizationId: input.organizationId, businessId: input.businessId, actorId: context!.actorId, actorType: context!.actorType, action: 'provider.disconnect', resourceType: 'provider_connection', resourceId: input.connectionId, metadata: { providerKey: input.providerKey, remoteUninstall: 'not_attempted' } });
    return NextResponse.json({ disconnected: true, changed: result.rows.length > 0, remoteUninstall: 'not_attempted' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
