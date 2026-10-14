import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCommerceRepository, createDb } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { authorizeControlCapability, resolveControlContext } from '../../../../../lib/control-auth';

const inputSchema = z.object({ organizationId: z.string().uuid(), businessId: z.string().uuid(), connectionId: z.string().uuid(), kind: z.enum(['initial', 'incremental', 'reconciliation']).default('initial') }).strict();

export async function POST(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const input = inputSchema.parse(await request.json());
    const context = await resolveControlContext(input.organizationId, input.businessId);
    if (!authorizeControlCapability(context, 'integration.manage')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    runtime = createDb(loadServerConfig().DATABASE_URL);
    const result = await createCommerceRepository(runtime.db).beginCatalogSync({ organizationId: input.organizationId, businessId: input.businessId, connectionId: input.connectionId, syncKind: input.kind });
    return NextResponse.json({ syncId: result.rows[0]?.id, status: 'running' }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    if (error instanceof Error && error.message === 'catalog_sync_already_running') return NextResponse.json({ code: 'sync_already_running' }, { status: 409 });
    if (error instanceof Error && error.message === 'connection_not_found') return NextResponse.json({ code: 'connection_not_found' }, { status: 404 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
