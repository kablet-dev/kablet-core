import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDb, createNativeEvidenceRepository } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { authorizeControlCapability, resolveControlContext } from '../../../../lib/control-auth';

const querySchema = z.object({ organizationId: z.string().uuid(), businessId: z.string().uuid(), storeId: z.string().uuid(), visitorSessionId: z.string().uuid(), limit: z.coerce.number().int().min(1).max(100).default(100), beforeAt: z.coerce.date().optional(), beforeId: z.string().uuid().optional() }).strict();

export async function GET(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
    if (query.beforeAt && !query.beforeId) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    const context = await resolveControlContext(query.organizationId, query.businessId);
    if (!authorizeControlCapability(context, 'reporting.read')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    runtime = createDb(loadServerConfig().DATABASE_URL);
    const result = await createNativeEvidenceRepository(runtime.db).getTimeline({ organizationId: query.organizationId, businessId: query.businessId, storeId: query.storeId }, query.visitorSessionId, query.limit, query.beforeAt && query.beforeId ? { occurredAt: query.beforeAt, id: query.beforeId } : undefined);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
