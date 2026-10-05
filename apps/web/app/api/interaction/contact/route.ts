import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { expressContactRequestSchema, interactionExperienceResponseSchema } from '@kablet/domain';
import { getInteractionService } from '../../../../lib/server-interaction';
import { InteractionExpiredError } from '../../../../lib/interaction-service';
import { readJsonBody, RequestBodyTooLargeError } from '../../../../lib/request-body';
import { ZodError } from 'zod';
export async function POST(request: Request) { try { const handle = (await cookies()).get('kablet_interaction')?.value; if (!handle) return NextResponse.json({ code: 'interaction_expired' }, { status: 401 }); const input = expressContactRequestSchema.parse(await readJsonBody(request, 2048)); const experience = await getInteractionService().submitContact(handle, input); return NextResponse.json(interactionExperienceResponseSchema.parse({ contractVersion: 'interaction-response.v1', experience }), { headers: { 'Cache-Control': 'no-store' } }); } catch (error) { return NextResponse.json({ code: error instanceof InteractionExpiredError ? 'interaction_expired' : error instanceof RequestBodyTooLargeError || error instanceof ZodError ? 'invalid_request' : 'unavailable' }, { status: error instanceof InteractionExpiredError ? 401 : error instanceof RequestBodyTooLargeError || error instanceof ZodError ? 400 : 503 }); } }
