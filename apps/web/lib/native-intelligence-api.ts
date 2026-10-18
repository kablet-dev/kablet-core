import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { nativeCanvasSignalSchema, nativeGuidanceRequestSchema, routeNativeInterpretation, type NativeGuidanceRequest, type NativeAiInterpretation } from '@kablet/domain';
import { createNativeEvidenceRepository, createNativeIntelligenceService, type Database, type NativeIntelligenceLineage } from '@kablet/db';
import { openNativeCartStore, isSameOriginMutation, NativeCartApiError } from './native-cart-api';
import { readJsonBody, RequestBodyTooLargeError } from './request-body';

export const nativeIntelligenceRequestSchema = z.object({ signal: nativeCanvasSignalSchema.nullable(), idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/), guidance: nativeGuidanceRequestSchema.optional(), text: z.string().trim().min(1).max(4000).optional() }).strict();
const cookiePrefix = 'kablet_native_intelligence_';

export function nativeIntelligenceCookieName(storeSlug: string): string { return `${cookiePrefix}${createHash('sha256').update(storeSlug, 'utf8').digest('hex').slice(0, 16)}`; }
function readHandle(request: Request, storeSlug: string): string | undefined { const name = nativeIntelligenceCookieName(storeSlug); const entry = (request.headers.get('cookie')?.split(';') ?? []).find(value => value.trim().startsWith(`${name}=`)); return entry ? entry.trim().slice(name.length + 1) || undefined : undefined; }
function setHandle(response: NextResponse, storeSlug: string, handle: string) { response.cookies.set(nativeIntelligenceCookieName(storeSlug), handle, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: `/api/store/${storeSlug}`, maxAge: 30 * 24 * 60 * 60 }); }
function clearHandle(response: NextResponse, storeSlug: string) { response.cookies.set(nativeIntelligenceCookieName(storeSlug), '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: `/api/store/${storeSlug}`, maxAge: 0 }); }
function resultJson(result: Awaited<ReturnType<ReturnType<typeof createNativeIntelligenceService>['resolve']>>, storeSlug: string, handle: string | null, interpretation?: NativeAiInterpretation) { const response = NextResponse.json({ composition: result.composition, compositionVersion: result.compositionVersion, decisionId: result.decisionId, visitorStateRevisionId: result.visitorStateRevisionId, exposureId: result.exposureId, rule: result.rule, guidance: result.guidance, ...(interpretation ? { interpretation } : {}) }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Origin' } }); if (!handle && result.handle) setHandle(response, storeSlug, result.handle); return response; }
export async function resolveNativeIntelligence(request: Request, storeSlug: string, signal: 'discovery' | 'comparison' | null, idempotencyKey: string, guidance?: NativeGuidanceRequest, text?: string, environment: NodeJS.ProcessEnv = process.env) {
  const opened = await openNativeCartStore(storeSlug); if (!opened) return NextResponse.json({ code: 'store_unavailable' }, { status: 404 });
  try {
    const service = createNativeIntelligenceService(opened.runtime.db, { organizationId: opened.context.organizationId, businessId: opened.context.businessId, storeId: opened.context.storeId });
    let handle = readHandle(request, storeSlug) ?? null;
    const resumed = Boolean(handle);
    if (text && !handle) handle = (await service.resolve(null, null, `native-bootstrap:${idempotencyKey}`)).handle;
    let interpretation: NativeAiInterpretation | undefined;
    let resolvedSignal = signal;
    let resolvedGuidance = guidance;
    if (text && handle) {
      const lineage = await service.resolveLineage(handle);
      if (lineage) {
        interpretation = await (await import('./native-ai-interpreter')).interpretNativeText({ db: opened.runtime.db, organizationId: opened.context.organizationId, businessId: opened.context.businessId, visitorIdentityId: lineage.visitorIdentityId, visitorSessionId: lineage.visitorSessionId, interactionSessionId: lineage.interactionSessionId, idempotencyKey, text, policyRevisionId: null, env: environment });
        const routed = routeNativeInterpretation(interpretation.output);
        resolvedSignal = signal ?? routed.signal;
        resolvedGuidance = guidance ?? routed.guidance;
      }
    }
    const result = await service.resolve(handle, resolvedSignal, idempotencyKey, resolvedGuidance);
    // Evidence is observational and deliberately non-blocking. A write failure
    // must never turn a valid storefront decision into a commerce failure.
    const evidence = createNativeEvidenceRepository(opened.runtime.db);
    const lineage = { organizationId: opened.context.organizationId, businessId: opened.context.businessId, storeId: opened.context.storeId, visitorIdentityId: result.visitorIdentityId, visitorSessionId: result.visitorSessionId, interactionSessionId: result.interactionSessionId, visitorStateRevisionId: result.visitorStateRevisionId, decisionId: result.decisionId, exposureId: result.exposureId, ruleKey: result.rule?.ruleKey ?? null, ruleVersion: result.rule?.version ?? null, decisionReason: result.rule?.reason ?? null };
    await evidence.append(lineage, { eventKind: resumed ? 'session_returned' : 'session_started', idempotencyKey: `session:${result.interactionSessionId}:${resumed ? 'returned' : 'started'}:${idempotencyKey}`, metadata: { composition: result.composition } }).catch(() => undefined);
    if (text || signal) await evidence.append(lineage, { eventKind: 'intent_submitted', idempotencyKey: `intent:${idempotencyKey}`, metadata: { signal: signal ?? null, inputMode: text ? 'free_text' : 'supported_action', interpretationSource: interpretation?.source ?? null } }).catch(() => undefined);
    await evidence.append(lineage, { eventKind: 'decision_exposed', idempotencyKey: `exposure:${result.exposureId}`, metadata: { composition: result.composition, compositionVersion: result.compositionVersion, aiSource: interpretation?.source ?? null } }).catch(() => undefined);
    return resultJson(result, storeSlug, readHandle(request, storeSlug) ?? null, interpretation);
  }
  catch (error) { const status = error instanceof NativeCartApiError ? error.status : error instanceof ZodError || error instanceof RequestBodyTooLargeError ? 400 : error instanceof Error && error.message === 'native_intelligence_session_expired' ? 401 : 503; const response = NextResponse.json({ code: status === 401 ? 'session_expired' : status === 400 ? 'invalid_request' : 'unavailable', message: status === 401 ? 'The visitor session has expired.' : status === 400 ? 'The intelligence request was invalid.' : 'The storefront experience is temporarily unavailable.' }, { status, headers: { 'Cache-Control': 'private, no-store' } }); if (status === 401) clearHandle(response, storeSlug); return response; }
  finally { await opened.runtime.pool.end(); }
}

export async function readNativeIntelligenceRequest(request: Request) { return nativeIntelligenceRequestSchema.parse(await readJsonBody(request, 2048)); }
export function readNativeIntelligenceHandle(request: Request, storeSlug: string): string | undefined { return readHandle(request, storeSlug); }
export async function readNativeIntelligenceLineage(db: Database['db'], context: { organizationId: string; businessId: string }, request: Request, storeSlug: string): Promise<NativeIntelligenceLineage | null> {
  const handle = readHandle(request, storeSlug);
  if (!handle) return null;
  try {
    return await createNativeIntelligenceService(db, context).resolveLineage(handle);
  } catch {
    // Attribution is optional commerce metadata; degraded intelligence must not
    // block an otherwise valid server-authorized checkout.
    return null;
  }
}
export { isSameOriginMutation };
