import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDb, createNativeCartService, type NativeCartService } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const manager = loadTestManagerConfig();
const enabled = Boolean(process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');

describe.skipIf(!enabled)('native cart persistence and authorization', () => {
  it('keeps cart state authoritative, isolated, idempotent, and non-reserving', async () => {
    const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
    const database = `kablet_cart_service_${randomBytes(12).toString('hex')}`;
    const organization = randomUUID(); const business = randomUUID(); const store = randomUUID();
    const product = randomUUID(); const draft = randomUUID(); const unavailable = randomUUID(); const euro = randomUUID();
    const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
    let bootstrap: ReturnType<typeof createDb> | undefined;
    let runtime: ReturnType<typeof createDb> | undefined;
    let service: NativeCartService | undefined;
    const context = { organizationId: organization, businessId: business, storeId: store };
    const setProduct = async (id: string, changes: { status?: string; availability?: string; amount?: string; currency?: string; revision?: number }) => {
      await bootstrap!.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`update kablet_native_products set
          status = coalesce(${changes.status ?? null}, status),
          availability = coalesce(${changes.availability ?? null}, availability),
          amount_minor = coalesce(${changes.amount ?? null}, amount_minor),
          currency = coalesce(${changes.currency ?? null}, currency),
          price_revision = coalesce(${changes.revision ?? null}, price_revision),
          updated_at = now()
          where id = ${id}::uuid`);
      });
    };
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
        await tx.execute(sql`insert into organizations(id,name) values (${organization}::uuid,'Native Cart Service Test')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${organization}::uuid,'Native Cart Service Business')`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${store}::uuid,${organization}::uuid,${business}::uuid,'cart-service-test','Native Cart Service Store','USD','published')`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values
          (${product}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'cart-product','CART-001','Cart Product','A cart fixture.','2400','USD',4,1,'published','available'),
          (${draft}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'draft-product','CART-002','Draft Product','A hidden fixture.','1200','USD',4,1,'draft','available'),
          (${unavailable}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'unavailable-product','CART-003','Unavailable Product','An unavailable fixture.','1800','USD',4,1,'published','unavailable'),
          (${euro}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'euro-product','CART-004','Euro Product','A currency fixture.','1800','EUR',4,1,'published','available')`);
      });
      runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      service = createNativeCartService(runtime.db);

      const created = await service.createCart(context);
      expect(created.token).toHaveLength(43);
      expect(created.cart).toMatchObject({ storeId: store, currency: 'USD', version: 0, lines: [] });
      const storedToken = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select encode(token_hash, 'hex') as token_hash from kablet_native_carts where id = ${created.cart.cartId}::uuid and store_id = ${store}::uuid`);
      });
      expect(storedToken.rows[0].token_hash).toBe(createHash('sha256').update(created.token, 'utf8').digest('hex'));
      expect(String(storedToken.rows[0].token_hash)).not.toContain(created.token);
      await expect(service.getCart({ ...context, token: created.token, storeId: randomUUID() })).rejects.toMatchObject({ code: 'cart_not_found' });
      await expect(service.getCart({ ...context, organizationId: randomUUID() })).rejects.toMatchObject({ code: 'cart_not_found' });
      await expect(service.getCart({ ...context, businessId: randomUUID() })).rejects.toMatchObject({ code: 'cart_not_found' });

      const first = await service.addLine({ ...context, token: created.token, productId: product, quantity: 2, idempotencyKey: 'add-1' });
      expect(first.cart).toMatchObject({ version: 1, lines: [expect.objectContaining({ productId: product, quantity: 2, status: 'active', originalPrice: expect.objectContaining({ amountMinor: '2400', priceRevision: 1 }) })] });
      const retry = await service.addLine({ ...context, token: created.token, productId: product, quantity: 2, idempotencyKey: 'add-1' });
      expect(retry.idempotent).toBe(true);
      expect(retry.cart.version).toBe(1);
      await expect(service.addLine({ ...context, token: created.token, productId: product, quantity: 1, idempotencyKey: 'add-1' })).rejects.toMatchObject({ code: 'idempotency_conflict' });
      const duplicate = await service.addLine({ ...context, token: created.token, productId: product, quantity: 1, idempotencyKey: 'add-2' });
      expect(duplicate.cart.lines[0].quantity).toBe(3);
      await expect(service.updateLine({ ...context, token: created.token, lineId: duplicate.cart.lines[0].lineId, quantity: 0, idempotencyKey: 'update-invalid' })).rejects.toMatchObject({ code: 'invalid_mutation' });
      const updatedLine = await service.updateLine({ ...context, token: created.token, lineId: duplicate.cart.lines[0].lineId, quantity: 4, idempotencyKey: 'update-1' });
      expect(updatedLine.cart).toMatchObject({ version: 3, lines: [expect.objectContaining({ lineId: duplicate.cart.lines[0].lineId, quantity: 4 })] });
      const beforeRejectedAdd = await service.getCart({ ...context, token: created.token });
      await expect(service.addLine({ ...context, token: created.token, productId: product, quantity: 2, idempotencyKey: 'add-too-many' })).rejects.toMatchObject({ code: 'insufficient_inventory' });
      const afterRejectedAdd = await service.getCart({ ...context, token: created.token });
      expect(afterRejectedAdd).toMatchObject({ version: beforeRejectedAdd.version, lines: [expect.objectContaining({ lineId: duplicate.cart.lines[0].lineId, quantity: 4 })] });
      const rejectedMutation = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select count(*)::int as count from kablet_native_cart_mutations where cart_id = ${created.cart.cartId}::uuid and idempotency_key = 'add-too-many'`);
      });
      expect(rejectedMutation.rows[0].count).toBe(0);
      const inventory = await runtime.db.execute(sql`select inventory_quantity from kablet_native_products where id = ${product}::uuid`);
      expect(inventory.rows[0].inventory_quantity).toBe(4);

      const lineId = duplicate.cart.lines[0].lineId;
      const beforeRenewal = created.cart.expiresAt.getTime();
      const renewed = await service.getCart({ ...context, token: created.token });
      expect(renewed.expiresAt.getTime()).toBeGreaterThan(beforeRenewal);
      await setProduct(product, { amount: '2600', revision: 2 });
      const stale = await service.getCart({ ...context, token: created.token });
      expect(stale.lines[0]).toMatchObject({ status: 'stale_price', originalPrice: expect.objectContaining({ amountMinor: '2400', priceRevision: 1 }), currentPrice: expect.objectContaining({ amountMinor: '2600', priceRevision: 2 }), priceAcceptance: null });
      const accepted = await service.acceptPrice({ ...context, token: created.token, lineId, idempotencyKey: 'accept-1' });
      expect(accepted.cart.lines[0].priceAcceptance).toMatchObject({ acceptedAmountMinor: '2600', acceptedPriceRevision: 2 });
      await setProduct(product, { amount: '2700', revision: 3 });
      expect((await service.getCart({ ...context, token: created.token })).lines[0].priceAcceptance).toBeNull();

      await expect(service.addLine({ ...context, token: created.token, productId: draft, quantity: 1, idempotencyKey: 'draft' })).rejects.toMatchObject({ code: 'product_unpublished' });
      await expect(service.addLine({ ...context, token: created.token, productId: unavailable, quantity: 1, idempotencyKey: 'unavailable' })).rejects.toMatchObject({ code: 'product_unavailable' });
      await expect(service.addLine({ ...context, token: created.token, productId: euro, quantity: 1, idempotencyKey: 'euro' })).rejects.toMatchObject({ code: 'currency_mismatch' });

      await setProduct(product, { availability: 'unavailable' });
      expect((await service.getCart({ ...context, token: created.token })).lines[0]).toMatchObject({ status: 'unavailable', lineId });
      await setProduct(product, { availability: 'available', status: 'draft' });
      expect((await service.getCart({ ...context, token: created.token })).lines[0]).toMatchObject({ status: 'unpublished', lineId });
      const removedLine = await service.removeLine({ ...context, token: created.token, lineId, idempotencyKey: 'remove-1' });
      expect(removedLine.cart).toMatchObject({ version: 5, lines: [] });
      await setProduct(product, { status: 'published', availability: 'available' });

      const concurrentCart = await service.createCart(context);
      const concurrent = await Promise.allSettled([
        service.addLine({ ...context, token: concurrentCart.token, productId: product, quantity: 1, expectedCartVersion: 0, idempotencyKey: 'concurrent-a' }),
        service.addLine({ ...context, token: concurrentCart.token, productId: product, quantity: 1, expectedCartVersion: 0, idempotencyKey: 'concurrent-b' }),
      ]);
      expect(concurrent.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(concurrent.filter(result => result.status === 'rejected' && (result.reason as { code?: string }).code === 'cart_version_conflict')).toHaveLength(1);
      expect((await service.getCart({ ...context, token: concurrentCart.token })).lines[0].quantity).toBe(1);

      const expiring = await service.createCart(context);
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`update kablet_native_carts set expires_at = now() - interval '1 minute' where id = ${expiring.cart.cartId}::uuid`);
      });
      await expect(service.getCart({ ...context, token: expiring.token })).rejects.toMatchObject({ code: 'cart_expired' });
      const expired = await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select status from kablet_native_carts where id = ${expiring.cart.cartId}::uuid and store_id = ${store}::uuid`);
      });
      expect(expired.rows[0].status).toBe('expired');
    } finally {
      await runtime?.pool.end().catch(() => undefined);
      await bootstrap?.pool.end().catch(() => undefined);
      await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
      await managerPool.end();
    }
  }, 120000);
});
