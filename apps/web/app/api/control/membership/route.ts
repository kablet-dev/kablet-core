import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDb, createSecurityRepository } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { securityCapabilitySchema } from '@kablet/domain';
import { authorizeControlCapability, resolveControlContext } from '../../../../lib/control-auth';

const inputSchema = z.object({
  organizationId: z.string().uuid(), businessId: z.string().uuid(), userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'operator', 'analyst', 'support']),
  capabilities: z.array(securityCapabilitySchema).max(32),
}).strict();

export async function POST(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const input = inputSchema.parse(await request.json());
    const context = await resolveControlContext(input.organizationId, input.businessId);
    if (!authorizeControlCapability(context, 'user.manage')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    if (input.role === 'owner' && !authorizeControlCapability(context, 'organization.manage')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    if (input.capabilities.some(capability => !context!.capabilities.includes(capability))) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    runtime = createDb(loadServerConfig().DATABASE_URL);
    const security = createSecurityRepository(runtime.db);
    const result = await security.addMembership(input);
    await security.audit({ organizationId: input.organizationId, businessId: input.businessId, actorId: context!.actorId, actorType: context!.actorType, action: 'membership.add', resourceType: 'membership', resourceId: String(result.rows[0]?.id), metadata: { role: input.role, capabilities: input.capabilities } });
    return NextResponse.json({ membershipId: result.rows[0]?.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
