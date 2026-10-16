import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDb } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const manager = loadTestManagerConfig();
const enabled = Boolean(process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');

describe.skipIf(!enabled)('native cart schema and isolation', () => {
  it('applies the cart migration and enforces ownership, uniqueness, and safe snapshots', async () => {
    const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
    const database = `kablet_cart_${randomBytes(12).toString('hex')}`;
    const organization = randomUUID(); const business = randomUUID(); const store = randomUUID(); const product = randomUUID(); const cart = randomUUID();
    const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
    let bootstrap: ReturnType<typeof createDb> | undefined; let runtime: ReturnType<typeof createDb> | undefined;
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
        await tx.execute(sql`insert into organizations(id,name) values (${organization}::uuid,'Cart Schema Test')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${organization}::uuid,'Cart Schema Test Business')`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${store}::uuid,${organization}::uuid,${business}::uuid,'cart-schema-test','Cart Schema Test Store','USD','published')`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${product}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'cart-product','CART-001','Cart Product','A cart schema fixture.','2400','USD',4,1,'published','available')`);
      });
      runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const tokenHash = Buffer.alloc(32, 7);
      await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into kablet_native_carts(id,organization_id,business_id,store_id,token_hash,currency,expires_at) values (${cart}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${tokenHash},'USD',now()+interval '30 days')`);
        await tx.execute(sql`insert into kablet_native_cart_lines(id,organization_id,business_id,store_id,cart_id,product_id,quantity,sku_snapshot,amount_minor_snapshot,currency_snapshot,price_revision_snapshot) values (${randomUUID()}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${cart}::uuid,${product}::uuid,1,'CART-001',2400,'USD',1)`);
      });
      const columns = await runtime.db.execute(sql`select column_name from information_schema.columns where table_name='kablet_native_carts' and column_name like '%token%'`);
      expect(columns.rows.map(row => String(row.column_name))).toEqual(['token_hash']);
      await expect(runtime.db.transaction(async tx => tx.execute(sql`insert into kablet_native_carts(id,organization_id,business_id,store_id,token_hash,currency,expires_at) values (${randomUUID()}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${tokenHash},'USD',now()+interval '30 days')`))).rejects.toThrow();
      await expect(runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into kablet_native_cart_lines(id,organization_id,business_id,store_id,cart_id,product_id,quantity,sku_snapshot,amount_minor_snapshot,currency_snapshot,price_revision_snapshot) values (${randomUUID()}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${cart}::uuid,${product}::uuid,0,'CART-001',2400,'USD',1)`);
      })).rejects.toThrow();
      const otherOrganization = randomUUID(); const otherBusiness = randomUUID();
      const isolated = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${otherOrganization}, true), set_config('kablet.business_id', ${otherBusiness}, true)`);
        const visible = await tx.execute(sql`select id from kablet_native_carts where id=${cart}::uuid`);
        const updated = await tx.execute(sql`update kablet_native_carts set version=version+1 where id=${cart}::uuid returning id`);
        return { visible: visible.rows.length, updated: updated.rows.length };
      });
      expect(isolated).toEqual({ visible: 0, updated: 0 });
      await expect(bootstrap!.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into kablet_native_cart_lines(id,organization_id,business_id,store_id,cart_id,product_id,quantity,sku_snapshot,amount_minor_snapshot,currency_snapshot,price_revision_snapshot) values (${randomUUID()}::uuid,${organization}::uuid,${business}::uuid,${randomUUID()}::uuid,${cart}::uuid,${product}::uuid,1,'CART-001',2400,'USD',1)`);
      })).rejects.toThrow();
    } finally {
      await runtime?.pool.end().catch(() => undefined);
      await bootstrap?.pool.end().catch(() => undefined);
      await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
      await managerPool.end();
    }
  }, 90000);
});
