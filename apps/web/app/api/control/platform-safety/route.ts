import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDb, createSecurityRepository } from '@kablet/db';
import { loadControlServerConfig } from '@kablet/config';
import { authorizePlatformCapability, resolvePlatformOperatorContext } from '../../../../lib/control-auth';

const inputSchema = z.object({ ruleKey: z.string().trim().min(1).max(160), effect: z.enum(['allow', 'deny']), reason: z.string().trim().min(10).max(500) }).strict();

export async function POST(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const input = inputSchema.parse(await request.json());
    const context = await resolvePlatformOperatorContext();
    if (!authorizePlatformCapability(context, 'platform.safety.manage')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    runtime = createDb(loadControlServerConfig().DATABASE_URL);
    const security = createSecurityRepository(runtime.db);
    const result = await security.setPlatformSafetyRule({ actorId: context!.actorId, sessionId: context!.sessionId!, ...input });
    await security.auditPlatform({ actorId: context!.actorId, sessionId: context!.sessionId!, action: `platform.safety.${input.effect}`, resourceType: 'platform_safety_rule', resourceId: undefined, metadata: { ruleKey: input.ruleKey, reason: input.reason, version: result.rows[0]?.version } });
    return NextResponse.json({ ruleKey: input.ruleKey, effect: input.effect, version: result.rows[0]?.version }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
