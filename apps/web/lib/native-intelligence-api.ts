import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { nativeCanvasSignalSchema } from '@kablet/domain';
import { createNativeIntelligenceService } from '@kablet/db';
import { openNativeCartStore, isSameOriginMutation, NativeCartApiError } from './native-cart-api';
import { readJsonBody, RequestBodyTooLargeError } from './request-body';

export const nativeIntelligenceRequestSchema = z.object({ signal: nativeCanvasSignalSchema, idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
const cookiePrefix = 'kablet_native_intelligence_';

export function nativeIntelligenceCookieName(storeSlug: string): string { return `${cookiePrefix}${createHash('sha256').update(storeSlug, 'utf8').digest('hex').slice(0, 16)}`; }
function readHandle(request: Request, storeSlug: string): string | undefined { const name = nativeIntelligenceCookieName(storeSlug); const entry = (request.headers.get('cookie')?.split(';') ?? []).find(value => value.trim().startsWith(`${name}=`)); return entry ? entry.trim().slice(name.length + 1) || undefined : undefined; }
function setHandle(response: NextResponse, storeSlug: string, handle: string) { response.cookies.set(nativeIntelligenceCookieName(storeSlug), handle, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: `/api/store/${storeSlug}/intelligence`, maxAge: 30 * 24 * 60 * 60 }); }
function resultJson(result: Awaited<ReturnType<ReturnType<typeof createNativeIntelligenceService>['resolve']>>, storeSlug: string, handle: string | null) { const response = NextResponse.json({ composition: result.composition, compositionVersion: result.compositionVersion, decisionId: result.decisionId, visitorStateRevisionId: result.visitorStateRevisionId, exposureId: result.exposureId }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Origin' } }); if (!handle && result.handle) setHandle(response, storeSlug, result.handle); return response; }
export async function resolveNativeIntelligence(request: Request, storeSlug: string, signal: 'discovery' | 'comparison' | null, idempotencyKey: string) {
  const opened = await openNativeCartStore(storeSlug); if (!opened) return NextResponse.json({ code: 'store_unavailable' }, { status: 404 });
  try { const result = await createNativeIntelligenceService(opened.runtime.db, { organizationId: opened.context.organizationId, businessId: opened.context.businessId }).resolve(readHandle(request, storeSlug) ?? null, signal, idempotencyKey); return resultJson(result, storeSlug, readHandle(request, storeSlug) ?? null); }
  catch (error) { const status = error instanceof NativeCartApiError ? error.status : error instanceof ZodError || error instanceof RequestBodyTooLargeError ? 400 : error instanceof Error && error.message === 'native_intelligence_session_expired' ? 401 : 503; return NextResponse.json({ code: status === 401 ? 'session_expired' : status === 400 ? 'invalid_request' : 'unavailable', message: status === 401 ? 'The visitor session has expired.' : status === 400 ? 'The intelligence request was invalid.' : 'The storefront experience is temporarily unavailable.' }, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
  finally { await opened.runtime.pool.end(); }
}

export async function readNativeIntelligenceRequest(request: Request) { return nativeIntelligenceRequestSchema.parse(await readJsonBody(request, 2048)); }
export { isSameOriginMutation };
