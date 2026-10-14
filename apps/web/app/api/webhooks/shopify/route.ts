import { NextResponse } from 'next/server';
import { createCommerceRepository, createDb } from '@kablet/db';
import { providerEventSchema } from '@kablet/domain';
import { loadControlServerConfig } from '@kablet/config';
import { normalizeShopifyDomain, verifyShopifyWebhook } from '../../../../../lib/shopify-provider';

export async function POST(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const rawBody = await request.text();
    const secret = process.env.SHOPIFY_CLIENT_SECRET;
    const signature = request.headers.get('x-shopify-hmac-sha256');
    if (!secret || !verifyShopifyWebhook(rawBody, signature, secret)) return NextResponse.json({ code: 'invalid_webhook' }, { status: 401 });
    const shopDomain = normalizeShopifyDomain(request.headers.get('x-shopify-shop-domain') ?? '');
    const eventId = request.headers.get('x-shopify-event-id') ?? request.headers.get('x-shopify-webhook-id');
    const eventType = request.headers.get('x-shopify-topic');
    if (!eventId || !eventType) return NextResponse.json({ code: 'invalid_webhook' }, { status: 400 });
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    runtime = createDb(loadControlServerConfig().DATABASE_URL);
    const commerce = createCommerceRepository(runtime.db);
    const connectionResult = await commerce.resolveConnectionForWebhook({ provider: 'shopify', shopDomain });
    const connection = connectionResult.rows[0] as { id: string; organization_id: string; business_id: string } | undefined;
    if (!connection) return NextResponse.json({ code: 'unknown_shop' }, { status: 404 });
    const event = providerEventSchema.parse({ contractVersion: 'commerce.v1', provider: 'shopify', eventId, eventType, occurredAt: request.headers.get('x-shopify-triggered-at'), sourceVersion: request.headers.get('x-shopify-api-version'), payload });
    await commerce.acceptVerifiedWebhook({ connectionId: connection.id, organizationId: connection.organization_id, businessId: connection.business_id, event });
    return NextResponse.json({ accepted: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof Error && ['invalid_shop_domain', 'invalid_webhook'].includes(error.message)) return NextResponse.json({ code: 'invalid_webhook' }, { status: 400 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
