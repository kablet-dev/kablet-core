import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCommerceRepository, createDb } from '@kablet/db';
import { authorizeControlCapability, resolveControlContext } from '../../../../../lib/control-auth';
import { buildShopifyInstallUrl, createShopifyOAuthState, normalizeShopifyDomain, SHOPIFY_REQUIRED_SCOPES } from '../../../../lib/shopify-provider';
import { loadControlServerConfig } from '@kablet/config';

const inputSchema = z.object({ organizationId: z.string().uuid(), businessId: z.string().uuid(), shopDomain: z.string().min(1).max(255) }).strict();

export async function POST(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const input = inputSchema.parse(await request.json());
    const context = await resolveControlContext(input.organizationId, input.businessId);
    if (!authorizeControlCapability(context, 'integration.manage')) return NextResponse.json({ code: 'unauthorized' }, { status: 403 });
    const shopDomain = normalizeShopifyDomain(input.shopDomain);
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
    if (!clientId || !redirectUri) return NextResponse.json({ code: 'shopify_not_configured' }, { status: 503 });
    runtime = createDb(loadControlServerConfig().DATABASE_URL);
    const commerce = createCommerceRepository(runtime.db);
    const state = createShopifyOAuthState();
    await commerce.createOAuthState({ organizationId: input.organizationId, businessId: input.businessId, requestedBy: context!.actorId, provider: 'shopify', shopDomain, stateHash: state.hash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    return NextResponse.json({ authorizationUrl: buildShopifyInstallUrl({ clientId, shopDomain, redirectUri, state: state.raw, scopes: SHOPIFY_REQUIRED_SCOPES }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof Error && error.message === 'invalid_shop_domain') return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
