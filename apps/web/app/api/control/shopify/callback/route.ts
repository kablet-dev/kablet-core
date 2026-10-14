import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createCommerceRepository, createCredentialVault, createDb, createSecurityRepository } from '@kablet/db';
import { exchangeShopifyCode, normalizeShopifyDomain, verifyShopifyOAuthQuery } from '../../../../../lib/shopify-provider';
import { loadControlServerConfig } from '@kablet/config';

export async function GET(request: Request) {
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    const url = new URL(request.url);
    const shopDomain = normalizeShopifyDomain(url.searchParams.get('shop') ?? '');
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const secret = process.env.SHOPIFY_CLIENT_SECRET;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    if (!state || !code || !secret || !clientId || !verifyShopifyOAuthQuery(url.searchParams, secret)) return NextResponse.json({ code: 'invalid_shopify_callback' }, { status: 400 });
    runtime = createDb(loadControlServerConfig().DATABASE_URL);
    const commerce = createCommerceRepository(runtime.db);
    const consumed = await commerce.consumeOAuthState({ stateHash: createHash('sha256').update(state).digest('hex'), provider: 'shopify', shopDomain });
    const binding = consumed.rows[0] as { requested_by: string; organization_id: string; business_id: string } | undefined;
    if (!binding) return NextResponse.json({ code: 'invalid_or_expired_state' }, { status: 400 });
    const token = await exchangeShopifyCode({ shopDomain, clientId, clientSecret: secret, code });
    const apiVersion = process.env.SHOPIFY_API_VERSION;
    if (!apiVersion) return NextResponse.json({ code: 'shopify_not_configured' }, { status: 503 });
    const shopResponse = await fetch(`https://${shopDomain}/admin/api/${encodeURIComponent(apiVersion)}/shop.json`, { headers: { 'x-shopify-access-token': token.accessToken, accept: 'application/json' } });
    if (!shopResponse.ok) return NextResponse.json({ code: 'shopify_identity_verification_failed' }, { status: 502 });
    const shopBody = await shopResponse.json() as { shop?: { id?: unknown; domain?: unknown } };
    if (typeof shopBody.shop?.id !== 'string' || normalizeShopifyDomain(String(shopBody.shop.domain ?? shopDomain)) !== shopDomain) return NextResponse.json({ code: 'shopify_identity_verification_failed' }, { status: 502 });
    const vaultKey = process.env.KABLET_CREDENTIAL_KEY;
    const keyVersion = process.env.KABLET_CREDENTIAL_KEY_VERSION;
    if (!vaultKey || !keyVersion) return NextResponse.json({ code: 'credential_vault_unavailable' }, { status: 503 });
    const security = createSecurityRepository(runtime.db);
    await security.saveProviderCredential({ organizationId: binding.organization_id, businessId: binding.business_id, providerKey: `shopify:${shopDomain}`, secret: token.accessToken, keyVersion, scopes: token.scopes, createdBy: binding.requested_by }, createCredentialVault(Buffer.from(vaultKey, 'base64'), keyVersion));
    const connection = await commerce.upsertConnection({ organizationId: binding.organization_id, businessId: binding.business_id, provider: 'shopify', shopDomain, externalShopId: String(shopBody.shop.id), credentialProviderKey: `shopify:${shopDomain}`, scopes: token.scopes });
    await security.audit({ organizationId: binding.organization_id, businessId: binding.business_id, actorId: binding.requested_by, actorType: 'merchant_user', action: 'provider.connect', resourceType: 'provider_connection', resourceId: String(connection.rows[0]?.id), metadata: { provider: 'shopify', shopDomain, scopes: token.scopes } });
    return NextResponse.json({ connected: true, provider: 'shopify', shopDomain }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && ['invalid_shop_domain', 'shopify_required_scope_missing', 'shopify_oauth_exchange_failed', 'shopify_oauth_response_invalid'].includes(error.message)) return NextResponse.json({ code: 'shopify_installation_failed' }, { status: 400 });
    return NextResponse.json({ code: 'unavailable' }, { status: 503 });
  } finally { await runtime?.pool.end().catch(() => undefined); }
}
