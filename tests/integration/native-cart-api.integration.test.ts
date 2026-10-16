import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDb } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';
import { GET as getCart, POST as createCart } from '../../apps/web/app/api/store/[storeSlug]/cart/route';
import { POST as addLine } from '../../apps/web/app/api/store/[storeSlug]/cart/lines/route';
import { nativeCartCookieName } from '../../apps/web/lib/native-cart-api';

const enabled = Boolean(process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');
const creationKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefg';

function cookieFrom(response: Response, storeSlug: string): string {
  const header = response.headers.get('set-cookie') ?? '';
  const name = nativeCartCookieName(storeSlug);
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  if (!match) throw new Error('cart cookie was not issued');
  return `${name}=${match[1]}`;
}

function tokenFrom(cookie: string): string {
  return cookie.slice(cookie.indexOf('=') + 1);
}

function requestHeaders(origin = 'https://shop.example', cookie?: string, json = true): HeadersInit {
  return { Host: 'shop.example', Origin: origin, ...(json ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) };
}

describe.skipIf(!enabled)('native cart HTTP boundary', () => {
  it('keeps browser cart identity durable and tenant-scoped through the real routes', async () => {
    const manager = loadTestManagerConfig();
    const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
    const database = `kablet_cart_api_${randomBytes(12).toString('hex')}`;
    const organization = randomUUID(); const business = randomUUID(); const otherBusiness = randomUUID();
    const otherOrganization = randomUUID(); const otherOrganizationBusiness = randomUUID();
    const store = randomUUID(); const otherStore = randomUUID(); const otherTenantStore = randomUUID(); const product = randomUUID();
    const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
    let bootstrap: ReturnType<typeof createDb> | undefined;
    const previousNodeEnv = process.env.NODE_ENV;
    const previousTestUrl = process.env.TEST_DATABASE_URL;
    const previousOrigin = process.env.KABLET_PUBLIC_ORIGIN;
    try {
      await managerPool.query(`create database "${database}" owner "${manager.TEST_MANAGER_USER}"`);
      await managerPool.query(`grant connect, create on database "${database}" to "${process.env.TEST_BOOTSTRAP_USER}"`);
      const target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
      await target.query(`grant usage, create on schema public to "${process.env.TEST_BOOTSTRAP_USER}"`);
      await target.query('grant usage, create on schema public to kablet_privacy_owner');
      await target.end();
      bootstrap = createDb(`postgresql://${encodeURIComponent(process.env.TEST_BOOTSTRAP_USER!)}:${encodeURIComponent(process.env.TEST_BOOTSTRAP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const admin = new pg.Pool({ connectionString: process.env.TEST_ROLE_ADMIN_URL, max: 1 });
      await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
      try { await migrate(bootstrap.db, { migrationsFolder }); } finally { await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await admin.end(); }
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${organization}::uuid,'Cart API Test')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${organization}::uuid,'Cart API Business')`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${store}::uuid,${organization}::uuid,${business}::uuid,'api-store-a','API Store A','USD','published')`);
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${otherBusiness}, true)`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${otherBusiness}::uuid,${organization}::uuid,'Cart API Other Business')`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${otherStore}::uuid,${organization}::uuid,${otherBusiness}::uuid,'api-store-b','API Store B','USD','published')`);
        await tx.execute(sql`select set_config('kablet.organization_id', ${otherOrganization}, true), set_config('kablet.business_id', ${otherOrganizationBusiness}, true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${otherOrganization}::uuid,'Cart API Other Organization')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${otherOrganizationBusiness}::uuid,${otherOrganization}::uuid,'Cart API Other Tenant Business')`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${otherTenantStore}::uuid,${otherOrganization}::uuid,${otherOrganizationBusiness}::uuid,'api-store-c','API Store C','USD','published')`);
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values
          (${product}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'api-product','API-001','API Product','A route fixture.','1900','USD',3,1,'published','available')`);
      });
      process.env.NODE_ENV = 'test';
      process.env.TEST_DATABASE_URL = `postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`;
      process.env.KABLET_PUBLIC_ORIGIN = 'https://shop.example';

      const firstTwo = await Promise.all([
        createCart(new Request('https://shop.example/api/store/api-store-a/cart', { method: 'POST', headers: requestHeaders(), body: JSON.stringify({ idempotencyKey: creationKey }) }), { params: Promise.resolve({ storeSlug: 'api-store-a' }) }),
        createCart(new Request('https://shop.example/api/store/api-store-a/cart', { method: 'POST', headers: requestHeaders(), body: JSON.stringify({ idempotencyKey: creationKey }) }), { params: Promise.resolve({ storeSlug: 'api-store-a' }) }),
      ]);
      expect(firstTwo.map(response => response.status)).toEqual([201, 201]);
      const firstBodies = await Promise.all(firstTwo.map(response => response.clone().json()));
      expect(firstBodies[0].cart.cartId).toBe(firstBodies[1].cart.cartId);
      expect(JSON.stringify(firstBodies)).not.toContain('token');
      const cookie = cookieFrom(firstTwo[0], 'api-store-a');
      const issuedCookies = firstTwo.map(response => cookieFrom(response, 'api-store-a'));
      const primaryTokenHash = await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select encode(token_hash, 'hex') as token_hash from kablet_native_carts where id = ${firstBodies[0].cart.cartId}::uuid`);
      });
      const primaryHash = String(primaryTokenHash.rows[0].token_hash);
      const retryCookie = issuedCookies.find(value => createHash('sha256').update(tokenFrom(value), 'utf8').digest('hex') !== primaryHash);
      expect(retryCookie).toBeDefined();

      const read = await getCart(new Request('https://shop.example/api/store/api-store-a/cart', { headers: { Host: 'shop.example', Cookie: cookie } }), { params: Promise.resolve({ storeSlug: 'api-store-a' }) });
      expect(read.status).toBe(200);
      expect((await read.json()).cart.cartId).toBe(firstBodies[0].cart.cartId);
      const renewedAliases = await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select count(*)::int as count from kablet_native_cart_tokens where cart_id = ${firstBodies[0].cart.cartId}::uuid and expires_at > now()`);
      });
      expect(Number(renewedAliases.rows[0].count)).toBeGreaterThanOrEqual(1);
      const added = await addLine(new Request('https://shop.example/api/store/api-store-a/cart/lines', { method: 'POST', headers: requestHeaders('https://shop.example', cookie), body: JSON.stringify({ productId: product, quantity: 1, idempotencyKey: creationKey }) }), { params: Promise.resolve({ storeSlug: 'api-store-a' }) });
      expect(added.status).toBe(200);

      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`update kablet_native_cart_tokens set expires_at = now() - interval '1 minute' where cart_id = ${firstBodies[0].cart.cartId}::uuid and token_hash = ${createHash('sha256').update(tokenFrom(retryCookie!), 'utf8').digest()}`);
      });
      const expiredAlias = await getCart(new Request('https://shop.example/api/store/api-store-a/cart', { headers: { Host: 'shop.example', Cookie: retryCookie! } }), { params: Promise.resolve({ storeSlug: 'api-store-a' }) });
      expect(expiredAlias.status).toBe(200);
      expect((await expiredAlias.json()).cart).toBeNull();
      const cleanedAlias = await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select count(*)::int as count from kablet_native_cart_tokens where cart_id = ${firstBodies[0].cart.cartId}::uuid and token_hash = ${createHash('sha256').update(tokenFrom(retryCookie!), 'utf8').digest()}`);
      });
      expect(Number(cleanedAlias.rows[0].count)).toBe(0);

      const otherStoreRead = await getCart(new Request('https://shop.example/api/store/api-store-b/cart', { headers: { Host: 'shop.example', Cookie: cookie } }), { params: Promise.resolve({ storeSlug: 'api-store-b' }) });
      expect(otherStoreRead.status).toBe(200);
      expect((await otherStoreRead.json()).cart).toBeNull();
      const otherTenantRead = await getCart(new Request('https://shop.example/api/store/api-store-c/cart', { headers: { Host: 'shop.example', Cookie: cookie } }), { params: Promise.resolve({ storeSlug: 'api-store-c' }) });
      expect(otherTenantRead.status).toBe(200);
      expect((await otherTenantRead.json()).cart).toBeNull();
      const rejectedOrigin = await addLine(new Request('https://shop.example/api/store/api-store-a/cart/lines', { method: 'POST', headers: requestHeaders('https://evil.example', cookie), body: JSON.stringify({ productId: product, quantity: 1, idempotencyKey: creationKey }) }), { params: Promise.resolve({ storeSlug: 'api-store-a' }) });
      expect(rejectedOrigin.status).toBe(403);

      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`update kablet_native_carts set expires_at = now() - interval '1 minute' where id = ${firstBodies[0].cart.cartId}::uuid`);
      });
      const replayExpired = await createCart(new Request('https://shop.example/api/store/api-store-a/cart', { method: 'POST', headers: requestHeaders(), body: JSON.stringify({ idempotencyKey: creationKey }) }), { params: Promise.resolve({ storeSlug: 'api-store-a' }) });
      expect(replayExpired.status).toBe(410);
      const expired = await getCart(new Request('https://shop.example/api/store/api-store-a/cart', { headers: { Host: 'shop.example', Cookie: cookie } }), { params: Promise.resolve({ storeSlug: 'api-store-a' }) });
      expect(expired.status).toBe(200);
      expect((await expired.json()).cart).toBeNull();
      expect(expired.headers.get('set-cookie')).toContain('Max-Age=0');
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
      if (previousTestUrl === undefined) delete process.env.TEST_DATABASE_URL; else process.env.TEST_DATABASE_URL = previousTestUrl;
      if (previousOrigin === undefined) delete process.env.KABLET_PUBLIC_ORIGIN; else process.env.KABLET_PUBLIC_ORIGIN = previousOrigin;
      await bootstrap?.pool.end().catch(() => undefined);
      await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
      await managerPool.end();
    }
  }, 120000);
});
