import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDb } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');

describe.skipIf(!enabled)('native checkout and reservation schema', () => {
  it('applies the migration and enforces ownership, uniqueness, lifecycle, and non-reservation of stock', async () => {
    const manager = loadTestManagerConfig();
    const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
    const database = `kablet_checkout_${randomBytes(12).toString('hex')}`;
    const organization = randomUUID(); const business = randomUUID(); const otherOrganization = randomUUID(); const otherBusiness = randomUUID();
    const store = randomUUID(); const product = randomUUID(); const cart = randomUUID(); const checkout = randomUUID(); const line = randomUUID(); const reservation = randomUUID();
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
        await tx.execute(sql`insert into organizations(id,name) values (${organization}::uuid,'Checkout Schema Test')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${organization}::uuid,'Checkout Schema Business')`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${store}::uuid,${organization}::uuid,${business}::uuid,'checkout-schema-store','Checkout Schema Store','USD','published')`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${product}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'checkout-schema-product','CHECKOUT-001','Checkout Product','Schema fixture','2400','USD',5,1,'published','available')`);
        await tx.execute(sql`insert into kablet_native_carts(id,organization_id,business_id,store_id,token_hash,currency,expires_at) values (${cart}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${Buffer.alloc(32, 9)},'USD',now()+interval '30 days')`);
        await tx.execute(sql`insert into kablet_native_checkout_sessions(id,organization_id,business_id,store_id,cart_id,cart_version,checkout_revision,fulfillment_type,status,currency,shipping_eligibility,shipping_charge_state,tax_state,server_total_state,expires_at) values (${checkout}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${cart}::uuid,0,1,'physical','created','USD','pending','not_calculated','not_calculated','not_calculated',now()+interval '15 minutes')`);
        await tx.execute(sql`insert into kablet_native_checkout_lines(id,organization_id,business_id,store_id,checkout_id,product_id,fulfillment_type,sku_snapshot,quantity,unit_amount_minor,line_amount_minor,currency_snapshot,price_revision_snapshot,product_title_snapshot) values (${line}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${checkout}::uuid,${product}::uuid,'physical','CHECKOUT-001',2,2400,4800,'USD',1,'Checkout Product')`);
        await tx.execute(sql`insert into kablet_native_inventory_reservations(id,organization_id,business_id,store_id,checkout_id,checkout_line_id,product_id,sku_snapshot,quantity,status,expires_at) values (${reservation}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${checkout}::uuid,${line}::uuid,${product}::uuid,'CHECKOUT-001',2,'active',now()+interval '10 minutes')`);
      });
      runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);

      const privileges = await runtime.db.execute(sql`
        select
          has_table_privilege(current_user, 'kablet_native_checkout_sessions', 'select') as sessions_select,
          has_table_privilege(current_user, 'kablet_native_checkout_sessions', 'update') as sessions_update,
          has_table_privilege(current_user, 'kablet_native_checkout_lines', 'select') as lines_select,
          has_table_privilege(current_user, 'kablet_native_checkout_lines', 'insert') as lines_insert,
          has_table_privilege(current_user, 'kablet_native_inventory_reservations', 'select') as reservations_select,
          has_table_privilege(current_user, 'kablet_native_inventory_reservations', 'update') as reservations_update,
          has_table_privilege(current_user, 'kablet_native_reservation_mutations', 'select') as mutations_select,
          has_table_privilege(current_user, 'kablet_native_reservation_mutations', 'insert') as mutations_insert,
          has_table_privilege(current_user, 'kablet_native_reservation_mutations', 'update') as mutations_update,
          has_table_privilege(current_user, 'kablet_native_reservation_mutations', 'delete') as mutations_delete
      `);
      expect(privileges.rows[0]).toMatchObject({
        sessions_select: true, sessions_update: true,
        lines_select: true, lines_insert: true,
        reservations_select: true, reservations_update: true,
        mutations_select: true, mutations_insert: true, mutations_update: false, mutations_delete: false,
      });

      const visible = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select s.status as checkout_status, r.status as reservation_status, p.inventory_quantity from kablet_native_checkout_sessions s join kablet_native_inventory_reservations r on r.checkout_id=s.id join kablet_native_products p on p.id=r.product_id where s.id=${checkout}::uuid`);
      });
      expect(visible.rows[0]).toMatchObject({ checkout_status: 'created', reservation_status: 'active', inventory_quantity: 5 });

      await expect(bootstrap!.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`update kablet_native_inventory_reservations set quantity=3 where id=${reservation}::uuid`);
      })).rejects.toThrow();

      const isolated = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${otherOrganization}, true), set_config('kablet.business_id', ${otherBusiness}, true)`);
        const sessions = await tx.execute(sql`select id from kablet_native_checkout_sessions where id=${checkout}::uuid`);
        const reservations = await tx.execute(sql`select id from kablet_native_inventory_reservations where id=${reservation}::uuid`);
        const updated = await tx.execute(sql`update kablet_native_inventory_reservations set status='released', released_at=now() where id=${reservation}::uuid returning id`);
        return { sessions: sessions.rows.length, reservations: reservations.rows.length, updated: updated.rows.length };
      });
      expect(isolated).toEqual({ sessions: 0, reservations: 0, updated: 0 });

      await expect(bootstrap!.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into kablet_native_inventory_reservations(id,organization_id,business_id,store_id,checkout_id,checkout_line_id,product_id,sku_snapshot,quantity,status,expires_at) values (${randomUUID()}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${checkout}::uuid,${line}::uuid,${product}::uuid,'CHECKOUT-001',1,'active',now()+interval '10 minutes')`);
      })).rejects.toThrow();

      await bootstrap!.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`update kablet_native_inventory_reservations set status='committed', committed_at=now() where id=${reservation}::uuid`);
      });
      await expect(bootstrap!.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`update kablet_native_inventory_reservations set status='active', committed_at=null where id=${reservation}::uuid`);
      })).rejects.toThrow();

      await expect(runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`update kablet_native_checkout_lines set unit_amount_minor=1 where id=${line}::uuid`);
      })).rejects.toThrow();

      const immutable = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organization}, true), set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select inventory_quantity from kablet_native_products where id=${product}::uuid`);
      });
      expect(immutable.rows[0].inventory_quantity).toBe(5);
    } finally {
      await runtime?.pool.end().catch(() => undefined);
      await bootstrap?.pool.end().catch(() => undefined);
      await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
      await managerPool.end();
    }
  }, 90000);
});
