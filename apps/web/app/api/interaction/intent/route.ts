import { NextResponse } from 'next/server';
import { interactionExperienceResponseSchema, safeInteractionErrorSchema, expressIntentRequestSchema } from '@kablet/domain';
import { getInteractionService } from '../../../../lib/server-interaction';
import { InteractionExpiredError } from '../../../../lib/interaction-service';
import { readJsonBody, RequestBodyTooLargeError } from '../../../../lib/request-body';
import { cookies } from 'next/headers';
import { ZodError } from 'zod';

const cookieName = 'kablet_interaction';
function failure(status: number, code: 'invalid_request' | 'interaction_expired' | 'unavailable') { return NextResponse.json(safeInteractionErrorSchema.parse({ contractVersion: 'interaction-error.v1', code, message: code === 'invalid_request' ? 'Choose one of the supported intents.' : code === 'interaction_expired' ? 'This interaction has expired. Start a new one.' : 'The interaction is temporarily unavailable.' }), { status, headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(request: Request) {
  try {
    if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > 2048) return failure(413, 'invalid_request');
    const handle = (await cookies()).get(cookieName)?.value;
    if (!handle) return failure(401, 'interaction_expired');
    const input = expressIntentRequestSchema.parse(await readJsonBody(request, 2048));
    const experience = await getInteractionService().expressIntent(handle, input);
    return NextResponse.json(interactionExperienceResponseSchema.parse({ contractVersion: 'interaction-response.v1', experience }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error instanceof RequestBodyTooLargeError ? 413 : error instanceof SyntaxError ? 400 : error instanceof InteractionExpiredError ? 401 : error instanceof ZodError ? 400 : 503, error instanceof InteractionExpiredError ? 'interaction_expired' : error instanceof RequestBodyTooLargeError || error instanceof SyntaxError || error instanceof ZodError ? 'invalid_request' : 'unavailable'); }
}
