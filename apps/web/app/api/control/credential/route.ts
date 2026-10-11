import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDb, createSecurityRepository } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { authorizeControlCapability, resolveControlContext } from '../../../../lib/control-auth';
import { loadControlCredentialVault } from '../../../../lib/control-credential-vault';

const inputSchema = z.object({
  action: z.enum(['save', 'revoke']), organizationId: z.string().uuid(), businessId: z.string().uuid(), providerKey: z.string().trim().min(1).max(100),
  secret: z.string().min(1).max(10000).optional(), scopes: z.array(z.string().trim().min(1).max(100)).max(64).optional(),
}).strict();

export async function POST(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const input = inputSchema.parse(await request.json());
    if (input.action === 'save' && (!input.secret || !input.scopes)) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    const context = await resolveControlContext(input.organizationId, input.businessId);
    if (!authorizeControlCapability(context, 'credential.rotate')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    runtime = createDb(loadServerConfig().DATABASE_URL);
    const security = createSecurityRepository(runtime.db);
    if (input.action === 'save') {
      await security.saveProviderCredential({ organizationId: input.organizationId, businessId: input.businessId, providerKey: input.providerKey, secret: input.secret!, keyVersion: 'configured-by-vault', scopes: input.scopes!, createdBy: context!.actorId }, loadControlCredentialVault());
      await security.audit({ organizationId: input.organizationId, businessId: input.businessId, actorId: context!.actorId, actorType: context!.actorType, action: 'credential.save', resourceType: 'provider_credential', metadata: { providerKey: input.providerKey, scopes: input.scopes } });
    } else {
      await security.revokeProviderCredential({ organizationId: input.organizationId, businessId: input.businessId, providerKey: input.providerKey });
      await security.audit({ organizationId: input.organizationId, businessId: input.businessId, actorId: context!.actorId, actorType: context!.actorType, action: 'credential.revoke', resourceType: 'provider_credential', metadata: { providerKey: input.providerKey } });
    }
    return NextResponse.json({ providerKey: input.providerKey, action: input.action, accepted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
