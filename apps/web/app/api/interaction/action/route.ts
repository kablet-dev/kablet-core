import { NextResponse } from 'next/server';
import { loadInteractionServerConfig, loadServerConfig } from '@kablet/config';
import { createDb } from '@kablet/db';
import { createActionService } from '../../../../lib/action-service';
import { actionConfirmationRequestSchema } from '../../../../lib/action-request-schema';
import { getInteractionHandle } from '../../../../lib/interaction-cookie';

export async function POST(request: Request) { let requestDb: ReturnType<typeof createDb> | undefined; try { const body = actionConfirmationRequestSchema.parse(await request.json()); const config=loadServerConfig(); const interaction=loadInteractionServerConfig(); const handle=await getInteractionHandle(); if(!handle) return NextResponse.json({code:'interaction_expired'},{status:401}); requestDb=createDb(config.DATABASE_URL); const result=await createActionService(requestDb.db,interaction.KABLET_INTERACTION_ORGANIZATION_ID,interaction.KABLET_INTERACTION_BUSINESS_ID).confirm({handle,decisionId:body.decisionId,idempotencyKey:body.idempotencyKey,visitorConfirmed:body.confirmed}); return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}}); } catch { return NextResponse.json({code:'unavailable'},{status:503}); } finally { if(requestDb) { try { await requestDb.pool.end(); } catch { /* preserve the primary route result */ } } } }
