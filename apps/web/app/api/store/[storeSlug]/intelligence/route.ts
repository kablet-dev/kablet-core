import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { resolveNativeIntelligence, readNativeIntelligenceRequest, isSameOriginMutation } from '../../../../../lib/native-intelligence-api';

export async function GET(request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params; return resolveNativeIntelligence(request, storeSlug, null, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
}
export async function POST(request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  try { if (!isSameOriginMutation(request)) return NextResponse.json({ code: 'origin_mismatch', message: 'The request origin was not authorized.' }, { status: 403 }); const { storeSlug } = await params; const input = await readNativeIntelligenceRequest(request); return resolveNativeIntelligence(request, storeSlug, input.signal, input.idempotencyKey); }
  catch (error) { return NextResponse.json({ code: error instanceof ZodError ? 'invalid_request' : 'unavailable', message: error instanceof ZodError ? 'The intelligence request was invalid.' : 'The storefront experience is temporarily unavailable.' }, { status: error instanceof ZodError ? 400 : 503 }); }
}
