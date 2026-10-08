import { NextResponse } from 'next/server';
import { interactionExperienceResponseSchema, safeInteractionErrorSchema } from '@kablet/domain';
import { getInteractionService } from '../../../../lib/server-interaction';
import { InteractionExpiredError } from '../../../../lib/interaction-service';
import { getInteractionHandle } from '../../../../lib/interaction-cookie';

function failure(status: number, code: 'interaction_expired' | 'unavailable') {
  return NextResponse.json(safeInteractionErrorSchema.parse({ contractVersion: 'interaction-error.v1', code, message: code === 'interaction_expired' ? 'This interaction has expired. Start a new one.' : 'The interaction is temporarily unavailable.' }), { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  try {
    const handle = await getInteractionHandle();
    if (!handle) return failure(401, 'interaction_expired');
    const experience = await getInteractionService().resume(handle);
    return NextResponse.json(interactionExperienceResponseSchema.parse({ contractVersion: 'interaction-response.v1', experience }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error instanceof InteractionExpiredError ? 401 : 503, error instanceof InteractionExpiredError ? 'interaction_expired' : 'unavailable');
  }
}
