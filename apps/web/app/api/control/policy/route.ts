import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDb, createIntentPolicyRepository, createSecurityRepository } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { authorizePolicyApproval } from '@kablet/domain';
import { resolveControlContext } from '../../../../lib/control-auth';
import { publishMerchantPolicy } from '../../../../lib/policy-governance';

const inputSchema = z.object({
  action: z.enum(['request', 'approve', 'publish']),
  organizationId: z.string().uuid(), businessId: z.string().uuid(),
  policyKey: z.string().min(1).max(160), revisionId: z.string().uuid(), approvalId: z.string().uuid().optional(),
}).strict();

export async function POST(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const input = inputSchema.parse(await request.json());
    const context = await resolveControlContext(input.organizationId, input.businessId);
    const authorization = authorizePolicyApproval(context, input.organizationId, input.businessId);
    if (!authorization.allowed) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    runtime = createDb(loadServerConfig().DATABASE_URL);
    const security = createSecurityRepository(runtime.db);
    if (input.action === 'request') {
      const result = await security.requestPolicyApproval({ ...input, actorId: context!.actorId, actorType: 'merchant_user' });
      return NextResponse.json({ approvalEventId: result.rows[0]?.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }
    if (input.action === 'approve') {
      const result = await security.approvePolicy({ ...input, actorId: context!.actorId, actorType: 'merchant_user' });
      return NextResponse.json({ approvalEventId: result.rows[0]?.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!input.approvalId) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    const policy = createIntentPolicyRepository(runtime.db);
    const result = await publishMerchantPolicy({ ...input, approvalId: input.approvalId, context, policyRepository: policy, securityRepository: security });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'approval_separation_required') return NextResponse.json({ code: 'approval_separation_required' }, { status: 403 });
    if (error instanceof Error && error.message === 'platform_safety_denied') return NextResponse.json({ code: 'platform_safety_denied' }, { status: 403 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  }
  finally { await runtime?.pool.end().catch(() => undefined); }
}
