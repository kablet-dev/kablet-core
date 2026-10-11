import { NextResponse } from 'next/server';
import { startInteractionRequestSchema, interactionExperienceResponseSchema, safeInteractionErrorSchema } from '@kablet/domain';
import { getInteractionService } from '../../../../lib/server-interaction';
import { readJsonBody, RequestBodyTooLargeError } from '../../../../lib/request-body';
import { ZodError } from 'zod';
import { acquisitionInputFromRequest } from '../../../../lib/acquisition-input';

const cookieName = 'kablet_interaction';
function failure(status: number, code: 'invalid_request' | 'unavailable') { return NextResponse.json(safeInteractionErrorSchema.parse({ contractVersion: 'interaction-error.v1', code, message: code === 'invalid_request' ? 'The interaction request was invalid.' : 'The interaction is temporarily unavailable.' }), { status, headers: { 'Cache-Control': 'no-store' } }); }

export async function POST(request: Request) {
  try {
    startInteractionRequestSchema.parse(await readJsonBody(request, 1024));
    const started = await getInteractionService().start(new Date(Date.now() + 30 * 60 * 1000), acquisitionInputFromRequest(request));
    const response = NextResponse.json(interactionExperienceResponseSchema.parse({ contractVersion: 'interaction-response.v1', experience: started.experience }), { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(cookieName, started.handle, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 1800 });
    return response;
  } catch (error) {
    const invalid = error instanceof RequestBodyTooLargeError || error instanceof SyntaxError || error instanceof ZodError;
    if (!invalid && process.env.NODE_ENV !== 'production') {
      const diagnostic = error as { name?: unknown; message?: unknown; stack?: unknown; code?: unknown };
      console.error('[interaction/start] failed', {
        name: typeof diagnostic.name === 'string' ? diagnostic.name : 'Error',
        message: typeof diagnostic.message === 'string' ? diagnostic.message : 'unknown failure',
        code: typeof diagnostic.code === 'string' ? diagnostic.code : undefined,
        stack: typeof diagnostic.stack === 'string' ? diagnostic.stack : undefined,
      });
    }
    return failure(invalid ? 400 : 503, invalid ? 'invalid_request' : 'unavailable');
  }
}
