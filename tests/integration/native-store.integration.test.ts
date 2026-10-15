import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDb, createNativeStoreRepository } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const manager = loadTestManagerConfig();
const enabled = Boolean(process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');

describe.skipIf(!enabled)('native store persistence and public isolation', () => {
  it('resolves only published catalog records and preserves currency-safe values', async () => {
    const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
    const database = `kablet_native_${randomBytes(12).toString('hex')}`;
    const organization = randomUUID(); const business = randomUUID(); const store = randomUUID(); const product = randomUUID(); const draft = randomUUID();
    const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
    let bootstrap: ReturnType<typeof createDb> | undefined; let runtime: ReturnType<typeof createDb> | undefined;
    try {
      await managerPool.query(`create database "${database}" owner "${manager.TEST_MANAGER_USER}"`);
      await managerPool.query(`grant connect, create on database "${database}" to "${process.env.TEST_BOOTSTRAP_USER}"`);
      const target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
      await target.query(`grant usage, create on schema public to "${process.env.TEST_BOOTSTRAP_USER}"`); await target.end();
      bootstrap = createDb(`postgresql://${encodeURIComponent(process.env.TEST_BOOTSTRAP_USER!)}:${encodeURIComponent(process.env.TEST_BOOTSTRAP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const admin = new pg.Pool({ connectionString: process.env.TEST_ROLE_ADMIN_URL, max: 1 });
      await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
      try { await migrate(bootstrap.db, { migrationsFolder }); } finally { await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await admin.end(); }
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${organization}::uuid,'Native Store Test')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${organization}::uuid,'Native Store Test Business')`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${store}::uuid,${organization}::uuid,${business}::uuid,'native-test','Native Test Store','EUR','published')`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,title,description,amount_minor,currency,status,availability) values (${product}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'visible','Visible Product','Visible','999','EUR','published','available')`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,title,description,amount_minor,currency,status,availability) values (${draft}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'draft','Draft Product','Draft','100','EUR','draft','available')`);
      });
      runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const storefront = await createNativeStoreRepository(runtime.db).getPublishedStorefront('native-test');
      expect(storefront).not.toBeNull();
      expect(storefront?.products).toHaveLength(1);
      expect(storefront?.products[0]).toMatchObject({ title: 'Visible Product', amountMinor: '999', currency: 'EUR' });
      await expect(createNativeStoreRepository(runtime.db).getPublishedStorefront('missing-store')).resolves.toBeNull();
      const hidden = await runtime.db.execute(sql`select id from kablet_native_products where id = ${draft}::uuid`);
      expect(hidden.rows).toHaveLength(0);
    } finally { await runtime?.pool.end().catch(() => undefined); await bootstrap?.pool.end().catch(() => undefined); await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined); await managerPool.end(); }
  }, 90000);
});
