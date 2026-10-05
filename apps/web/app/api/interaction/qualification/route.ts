import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { interactionExperienceResponseSchema, safeInteractionErrorSchema, expressQualificationRequestSchema } from '@kablet/domain';
import { getInteractionService } from '../../../../lib/server-interaction';
import { InteractionExpiredError } from '../../../../lib/interaction-service';
import { readJsonBody, RequestBodyTooLargeError } from '../../../../lib/request-body';
import { ZodError } from 'zod';

function failure(status: number, code: 'invalid_request' | 'interaction_expired' | 'unavailable') { return NextResponse.json(safeInteractionErrorSchema.parse({ contractVersion: 'interaction-error.v1', code, message: code === 'invalid_request' ? 'Choose one of the supported answers.' : code === 'interaction_expired' ? 'This interaction has expired. Start a new one.' : 'The interaction is temporarily unavailable.' }), { status, headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(request: Request) {
  try {
    const handle = (await cookies()).get('kablet_interaction')?.value;
    if (!handle) return failure(401, 'interaction_expired');
    const input = expressQualificationRequestSchema.parse(await readJsonBody(request, 2048));
    const experience = await getInteractionService().submitQualification(handle, input);
    return NextResponse.json(interactionExperienceResponseSchema.parse({ contractVersion: 'interaction-response.v1', experience }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error instanceof RequestBodyTooLargeError ? 413 : error instanceof InteractionExpiredError ? 401 : error instanceof ZodError ? 400 : 503, error instanceof InteractionExpiredError ? 'interaction_expired' : error instanceof RequestBodyTooLargeError || error instanceof ZodError ? 'invalid_request' : 'unavailable'); }
}
