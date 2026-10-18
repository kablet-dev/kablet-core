import { NextResponse } from 'next/server';
import { nativeEvidenceInputSchema, nativeStoreSlugSchema } from '@kablet/domain';
import { createNativeEvidenceRepository } from '@kablet/db';
import { openNativeCartStore, isSameOriginMutation } from '../../../../../lib/native-cart-api';
import { readNativeIntelligenceHandle, readNativeIntelligenceLineage } from '../../../../../lib/native-intelligence-api';
import { readJsonBody, RequestBodyTooLargeError } from '../../../../../lib/request-body';
import { ZodError } from 'zod';

export async function POST(request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug: rawSlug } = await params;
  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ code: 'origin_mismatch' }, { status: 403 });
    const storeSlug = nativeStoreSlugSchema.parse(rawSlug);
    const input = nativeEvidenceInputSchema.parse(await readJsonBody(request, 4096));
    if (input.eventKind === 'verified_purchase') return NextResponse.json({ code: 'authoritative_event_required' }, { status: 403 });
    const opened = await openNativeCartStore(storeSlug);
    if (!opened) return NextResponse.json({ code: 'store_unavailable' }, { status: 404 });
    try {
      const handle = readNativeIntelligenceHandle(request, storeSlug);
      const lineage = handle ? await readNativeIntelligenceLineage(opened.runtime.db, opened.context, request, storeSlug) : null;
      if (!lineage) return NextResponse.json({ code: 'session_unavailable' }, { status: 401 });
      const result = await createNativeEvidenceRepository(opened.runtime.db).append({ ...opened.context, ...lineage }, input);
      return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } finally { await opened.runtime.pool.end(); }
  } catch (error) {
    const status = error instanceof ZodError || error instanceof RequestBodyTooLargeError ? 400 : 503;
    return NextResponse.json({ code: status === 400 ? 'invalid_request' : 'evidence_unavailable' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
