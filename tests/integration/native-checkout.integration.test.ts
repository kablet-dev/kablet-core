import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDb, createNativeCartService, createNativeCheckoutReservationService, NativeCheckoutServiceError } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');

function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error(`concurrent checkout test exceeded ${timeoutMs}ms`)), timeoutMs);
    promise.then(value => { clearTimeout(timer); resolvePromise(value); }, error => { clearTimeout(timer); rejectPromise(error); });
  });
}

describe.skipIf(!enabled)('native checkout reservation service', () => {
  it('validates authoritative cart truth and reserves inventory atomically without decrementing stock', async () => {
    const manager = loadTestManagerConfig();
    const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
    const database = `kablet_checkout_runtime_${randomBytes(12).toString('hex')}`;
    const organization = randomUUID(); const business = randomUUID(); const store = randomUUID();
    const product = randomUUID(); const lastUnitProduct = randomUUID(); const lifecycleProduct = randomUUID(); const sameCartProduct = randomUUID(); const multiProduct = randomUUID(); const multiInsufficientProduct = randomUUID(); const lockProductA = randomUUID(); const lockProductB = randomUUID();
    const cartA = randomUUID(); const cartB = randomUUID(); const cartC = randomUUID(); const cartLifecycle = randomUUID(); const cartStale = randomUUID(); const cartQuarantine = randomUUID(); const cartSame = randomUUID(); const cartMulti = randomUUID(); const cartLockA = randomUUID(); const cartLockB = randomUUID(); const cartKeyA = randomUUID(); const cartKeyB = randomUUID();
    const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
    let bootstrap: ReturnType<typeof createDb> | undefined; let runtime: ReturnType<typeof createDb> | undefined;
    const tokenA = randomBytes(32).toString('base64url'); const tokenB = randomBytes(32).toString('base64url'); const tokenC = randomBytes(32).toString('base64url'); const tokenLifecycle = randomBytes(32).toString('base64url'); const tokenStale = randomBytes(32).toString('base64url'); const tokenQuarantine = randomBytes(32).toString('base64url'); const tokenSame = randomBytes(32).toString('base64url'); const tokenMulti = randomBytes(32).toString('base64url'); const tokenLockA = randomBytes(32).toString('base64url'); const tokenLockB = randomBytes(32).toString('base64url'); const tokenKeyA = randomBytes(32).toString('base64url'); const tokenKeyB = randomBytes(32).toString('base64url');
    const lockFirst = lockProductA.localeCompare(lockProductB) < 0 ? lockProductA : lockProductB;
    const lockSecond = lockFirst === lockProductA ? lockProductB : lockProductA;
    const context = { organizationId: organization, businessId: business, storeId: store };
    const address = { recipientName: 'A Visitor', line1: '1 Test Street', line2: null, city: 'Test City', region: 'TS', postalCode: '00001', countryCode: 'US' };
    const contact = { email: 'visitor@example.test', name: 'A Visitor', phone: null };
    const policy = async (input: { lines: Array<{ lineAmountMinor: string }>; currency: string }) => ({
      shippingEligibility: 'eligible' as const,
      shippingCharge: { state: 'calculated' as const, amountMinor: '0', currency: input.currency },
      tax: { state: 'calculated' as const, amountMinor: '0', currency: input.currency },
      serverTotal: { state: 'calculated' as const, amountMinor: input.lines.reduce((sum, line) => (BigInt(sum) + BigInt(line.lineAmountMinor)).toString(), '0'), currency: input.currency },
    });
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
        await tx.execute(sql`insert into organizations(id,name) values (${organization}::uuid,'Checkout Runtime Test')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${organization}::uuid,'Checkout Runtime Business')`);
        await tx.execute(sql`insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,primary_currency,status) values (${store}::uuid,${organization}::uuid,${business}::uuid,'checkout-runtime-store','Checkout Runtime Store','USD','published')`);
        await tx.execute(sql`insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,amount_minor,currency,inventory_quantity,price_revision,status,availability) values (${product}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'checkout-product','CHECKOUT-RUNTIME-001','Checkout Product','Runtime fixture','2400','USD',4,1,'published','available'),(${lastUnitProduct}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'last-unit-product','CHECKOUT-RUNTIME-002','Last Unit Product','Runtime fixture','1200','USD',1,1,'published','available'),(${lifecycleProduct}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'lifecycle-product','CHECKOUT-RUNTIME-003','Lifecycle Product','Runtime fixture','900','USD',1,1,'published','available'),(${sameCartProduct}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'same-cart-product','CHECKOUT-RUNTIME-004','Same Cart Product','Runtime fixture','700','USD',1,1,'published','available'),(${multiProduct}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'multi-product','CHECKOUT-RUNTIME-005','Multi Product','Runtime fixture','800','USD',1,1,'published','available'),(${multiInsufficientProduct}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'multi-insufficient-product','CHECKOUT-RUNTIME-006','Multi Insufficient Product','Runtime fixture','600','USD',1,1,'published','available'),(${lockProductA}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'lock-product-a','CHECKOUT-RUNTIME-007','Lock Product A','Runtime fixture','500','USD',1,1,'published','available'),(${lockProductB}::uuid,${store}::uuid,${organization}::uuid,${business}::uuid,'lock-product-b','CHECKOUT-RUNTIME-008','Lock Product B','Runtime fixture','400','USD',1,1,'published','available')`);
        const carts = [[cartA, tokenA, product, 2], [cartB, tokenB, lastUnitProduct, 1], [cartC, tokenC, lastUnitProduct, 1], [cartLifecycle, tokenLifecycle, lifecycleProduct, 1], [cartStale, tokenStale, product, 1], [cartQuarantine, tokenQuarantine, lifecycleProduct, 1], [cartSame, tokenSame, sameCartProduct, 1], [cartMulti, tokenMulti, multiProduct, 1], [cartLockA, tokenLockA, lockFirst, 1], [cartLockB, tokenLockB, lockSecond, 1], [cartKeyA, tokenKeyA, product, 1], [cartKeyB, tokenKeyB, product, 1]] as const;
        for (const [cart, token, productId, quantity] of carts) {
          await tx.execute(sql`insert into kablet_native_carts(id,organization_id,business_id,store_id,token_hash,currency,expires_at) values (${cart}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${createHash('sha256').update(token, 'utf8').digest()},'USD',now()+interval '30 days')`);
          await tx.execute(sql`insert into kablet_native_cart_lines(id,organization_id,business_id,store_id,cart_id,product_id,quantity,sku_snapshot,amount_minor_snapshot,currency_snapshot,price_revision_snapshot) select ${randomUUID()}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${cart}::uuid,id,${quantity},sku,amount_minor,currency,price_revision from kablet_native_products where id=${productId}::uuid`);
        }
        for (const [cart, productId] of [[cartMulti, multiInsufficientProduct], [cartLockA, lockSecond], [cartLockB, lockFirst]] as const) {
          await tx.execute(sql`insert into kablet_native_cart_lines(id,organization_id,business_id,store_id,cart_id,product_id,quantity,sku_snapshot,amount_minor_snapshot,currency_snapshot,price_revision_snapshot,created_at) select ${randomUUID()}::uuid,${organization}::uuid,${business}::uuid,${store}::uuid,${cart}::uuid,id,1,sku,amount_minor,currency,price_revision,now()+interval '1 second' from kablet_native_products where id=${productId}::uuid`);
        }
      });
      runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const preflightResult = await runtime.db.execute(sql`
        select
          current_user,
          session_user,
          current_database(),
          to_regclass('public.kablet_native_reservation_mutations')::text as reservation_mutations_table,
          has_table_privilege(current_user, 'public.kablet_native_reservation_mutations', 'SELECT') as can_select_mutations,
          has_table_privilege(current_user, 'public.kablet_native_reservation_mutations', 'INSERT') as can_insert_mutations,
          has_table_privilege(current_user, 'public.kablet_native_reservation_mutations', 'UPDATE') as can_update_mutations,
          c.relrowsecurity,
          c.relforcerowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'kablet_native_reservation_mutations'
      `);
      expect(preflightResult.rows, 'service database preflight returned no reservation table metadata').toHaveLength(1);
      const preflight = preflightResult.rows[0] as Record<string, unknown>;
      expect(preflight.current_user, 'service runtime role is not kablet_dev').toBe('kablet_dev');
      expect(preflight.session_user, 'service session role is not kablet_dev').toBe('kablet_dev');
      expect(preflight.current_database, 'service connection is not using its disposable database').toBe(database);
      expect(preflight.reservation_mutations_table, 'reservation mutations table is missing').toBe('kablet_native_reservation_mutations');
      expect(preflight.can_select_mutations, 'kablet_dev lacks SELECT on reservation mutations').toBe(true);
      expect(preflight.can_insert_mutations, 'kablet_dev lacks INSERT on reservation mutations').toBe(true);
      expect(preflight.can_update_mutations, 'kablet_dev unexpectedly has UPDATE on reservation mutations').toBe(false);
      expect(preflight.relrowsecurity, 'reservation mutations RLS is disabled').toBe(true);
      expect(preflight.relforcerowsecurity, 'reservation mutations FORCE RLS is disabled').toBe(true);
      const migrationResult = await bootstrap.db.execute(sql`select exists (select 1 from "drizzle"."__drizzle_migrations" where created_at = 1762905600000) as migration_0042_applied`);
      expect(migrationResult.rows[0].migration_0042_applied, 'migration 0042 is absent from the service database').toBe(true);
      const service = createNativeCheckoutReservationService(runtime.db, { calculateShippingAndTax: policy });
      const staleLineResult = await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`);
        return tx.execute(sql`select id from kablet_native_cart_lines where organization_id=${organization}::uuid and business_id=${business}::uuid and store_id=${store}::uuid and cart_id=${cartStale}::uuid`);
      });
      const staleLineId = String((staleLineResult.rows[0] as Record<string, unknown>).id);

      const created = await service.confirmReservation({ ...context, token: tokenA, idempotencyKey: 'reservation-a', contact, shippingAddress: address });
      expect(created.idempotent).toBe(false);
      expect(created.checkout.status).toBe('reserved');
      expect(created.reservations).toHaveLength(1);
      expect(created.reservations[0].expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
      expect(created.reservations[0].expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
      await expect(service.confirmReservation({ ...context, storeId: randomUUID(), token: tokenA, idempotencyKey: 'wrong-store', contact, shippingAddress: address })).rejects.toBeInstanceOf(Error);
      await expect(service.confirmReservation({ ...context, organizationId: randomUUID(), businessId: randomUUID(), token: tokenA, idempotencyKey: 'wrong-tenant', contact, shippingAddress: address })).rejects.toBeInstanceOf(Error);
      const stockAfterReservation = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select inventory_quantity from kablet_native_products where id=${product}::uuid`); });
      expect(stockAfterReservation.rows[0].inventory_quantity).toBe(4);

      await expect(service.confirmReservation({ ...context, token: tokenA, idempotencyKey: 'reservation-a', contact, shippingAddress: address })).resolves.toMatchObject({ idempotent: true, checkout: { checkoutId: created.checkout.checkoutId } });
      await expect(service.confirmReservation({ ...context, token: tokenA, idempotencyKey: 'reservation-a', contact: { ...contact, email: 'other@example.test' }, shippingAddress: address })).rejects.toMatchObject({ code: 'idempotency_conflict' });

      const cartService = createNativeCartService(runtime.db);
      let cartWasMutatedDuringPolicy = false;
      const staleVersionService = createNativeCheckoutReservationService(runtime.db, {
        calculateShippingAndTax: async input => {
          if (!cartWasMutatedDuringPolicy) {
            cartWasMutatedDuringPolicy = true;
            await cartService.updateLine({ ...context, token: tokenStale, lineId: staleLineId, quantity: 1, expectedCartVersion: 0, idempotencyKey: 'stale-version-bump' });
          }
          return policy(input);
        },
      });
      await expect(staleVersionService.confirmReservation({ ...context, token: tokenStale, idempotencyKey: 'stale-cart-version', contact, shippingAddress: address })).rejects.toMatchObject({ code: 'cart_version_conflict' });
      const staleSideEffects = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*) from kablet_native_checkout_sessions where cart_id=${cartStale}::uuid)::int as checkout_count, (select count(*) from kablet_native_inventory_reservations where checkout_id in (select id from kablet_native_checkout_sessions where cart_id=${cartStale}::uuid))::int as reservation_count`); });
      expect(staleSideEffects.rows[0]).toMatchObject({ checkout_count: 0, reservation_count: 0 });

      const sameCartConcurrent = await withTimeout(Promise.allSettled([
        service.confirmReservation({ ...context, token: tokenSame, idempotencyKey: 'same-cart-concurrent', contact, shippingAddress: address }),
        service.confirmReservation({ ...context, token: tokenSame, idempotencyKey: 'same-cart-concurrent', contact, shippingAddress: address }),
      ]));
      const sameCartFulfilled = sameCartConcurrent.filter(result => result.status === 'fulfilled').map(result => result.value);
      expect(sameCartFulfilled).toHaveLength(2);
      expect(sameCartFulfilled.map(result => result.idempotent).sort()).toEqual([false, true]);
      expect(new Set(sameCartFulfilled.map(result => result.checkout.checkoutId)).size).toBe(1);
      const sameCartRows = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*) from kablet_native_checkout_sessions where cart_id=${cartSame}::uuid)::int as checkout_count, (select count(*) from kablet_native_inventory_reservations where checkout_id in (select id from kablet_native_checkout_sessions where cart_id=${cartSame}::uuid))::int as reservation_count, (select count(*) from kablet_native_reservation_mutations where checkout_id in (select id from kablet_native_checkout_sessions where cart_id=${cartSame}::uuid))::int as mutation_count`); });
      expect(sameCartRows.rows[0]).toMatchObject({ checkout_count: 1, reservation_count: 1, mutation_count: 1 });

      const crossCartSameKey = await withTimeout(Promise.allSettled([
        service.confirmReservation({ ...context, token: tokenKeyA, idempotencyKey: 'cross-cart-same-key', contact, shippingAddress: address }),
        service.confirmReservation({ ...context, token: tokenKeyB, idempotencyKey: 'cross-cart-same-key', contact, shippingAddress: address }),
      ]));
      const crossCartFulfilled = crossCartSameKey.filter(result => result.status === 'fulfilled').map(result => result.value);
      expect(crossCartFulfilled).toHaveLength(2);
      expect(crossCartFulfilled.every(result => result.idempotent === false)).toBe(true);
      expect(new Set(crossCartFulfilled.map(result => result.checkout.checkoutId)).size).toBe(2);
      const crossCartRows = await runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`);
        return tx.execute(sql`select cart_id, checkout_id from kablet_native_reservation_mutations where cart_id in (${cartKeyA}::uuid, ${cartKeyB}::uuid) order by cart_id`);
      });
      expect(crossCartRows.rows).toHaveLength(2);
      expect(new Set(crossCartRows.rows.map(row => String((row as Record<string, unknown>).checkout_id))).size).toBe(2);

      let multiInventoryReduced = false;
      const multiProductService = createNativeCheckoutReservationService(runtime.db, {
        calculateShippingAndTax: async input => {
          if (!multiInventoryReduced) {
            multiInventoryReduced = true;
            await bootstrap!.db.transaction(async tx => {
              await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`);
              await tx.execute(sql`update kablet_native_products set inventory_quantity = 0 where id = ${multiInsufficientProduct}::uuid and organization_id = ${organization}::uuid and business_id = ${business}::uuid and store_id = ${store}::uuid`);
            });
          }
          return policy(input);
        },
      });
      await expect(multiProductService.confirmReservation({ ...context, token: tokenMulti, idempotencyKey: 'multi-product-insufficient', contact, shippingAddress: address })).rejects.toMatchObject({ code: 'insufficient_inventory' });
      const multiRollback = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*) from kablet_native_checkout_sessions where cart_id=${cartMulti}::uuid)::int as checkout_count, (select count(*) from kablet_native_cart_mutations where cart_id=${cartMulti}::uuid)::int as cart_mutation_count, (select count(*) from kablet_native_reservation_mutations where checkout_id in (select id from kablet_native_checkout_sessions where cart_id=${cartMulti}::uuid))::int as idempotency_count, (select count(*) from kablet_native_inventory_reservations where checkout_id in (select id from kablet_native_checkout_sessions where cart_id=${cartMulti}::uuid))::int as reservation_count`); });
      expect(multiRollback.rows[0]).toMatchObject({ checkout_count: 0, cart_mutation_count: 0, idempotency_count: 0, reservation_count: 0 });

      const oppositeOrder = await withTimeout(Promise.allSettled([
        service.confirmReservation({ ...context, token: tokenLockA, idempotencyKey: 'opposite-order-a', contact, shippingAddress: address }),
        service.confirmReservation({ ...context, token: tokenLockB, idempotencyKey: 'opposite-order-b', contact, shippingAddress: address }),
      ]));
      expect(oppositeOrder.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(oppositeOrder.filter(result => result.status === 'rejected' && (result.reason as NativeCheckoutServiceError).code === 'insufficient_inventory')).toHaveLength(1);

      const concurrent = await Promise.allSettled([
        service.confirmReservation({ ...context, token: tokenB, idempotencyKey: 'reservation-last-b', contact, shippingAddress: address }),
        service.confirmReservation({ ...context, token: tokenC, idempotencyKey: 'reservation-last-c', contact, shippingAddress: address }),
      ]);
      expect(concurrent.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(concurrent.filter(result => result.status === 'rejected' && (result.reason as NativeCheckoutServiceError).code === 'insufficient_inventory')).toHaveLength(1);

      const lifecycle = await service.confirmReservation({ ...context, token: tokenLifecycle, idempotencyKey: 'reservation-lifecycle', contact, shippingAddress: address });
      const released = await service.releaseReservation(context, lifecycle.reservations[0].reservationId);
      expect(released.reservation.status).toBe('released');
      await expect(service.releaseReservation(context, lifecycle.reservations[0].reservationId)).resolves.toMatchObject({ idempotent: true });

      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`update kablet_native_inventory_reservations set expires_at=now()-interval '1 minute' where id=${created.reservations[0].reservationId}::uuid`);
      });
      await expect(service.confirmReservation({ ...context, token: tokenStale, idempotencyKey: 'reservation-expired-reuse', contact, shippingAddress: address })).resolves.toMatchObject({ idempotent: false });
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`update kablet_native_products set amount_minor=2500, price_revision=2 where id=${product}::uuid`);
      });
      await expect(service.confirmReservation({ ...context, token: tokenStale, idempotencyKey: 'reservation-stale', contact, shippingAddress: address })).rejects.toMatchObject({ code: 'price_changed' });
      await expect(service.expireReservation(context, created.reservations[0].reservationId)).resolves.toMatchObject({ reservation: { status: 'expired' } });
      const quarantineCandidate = await service.confirmReservation({ ...context, token: tokenLifecycle, idempotencyKey: 'reservation-quarantine-new', contact, shippingAddress: address });
      await expect(service.quarantineReservation(context, quarantineCandidate.reservations[0].reservationId)).resolves.toMatchObject({ reservation: { status: 'unknown' } });
      await expect(service.confirmReservation({ ...context, token: tokenQuarantine, idempotencyKey: 'reservation-quarantine-blocked', contact, shippingAddress: address })).rejects.toMatchObject({ code: 'insufficient_inventory' });
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`update kablet_native_inventory_reservations set expires_at=now()-interval '1 minute' where id=${quarantineCandidate.reservations[0].reservationId}::uuid`);
      });
      await expect(service.confirmReservation({ ...context, token: tokenQuarantine, idempotencyKey: 'reservation-quarantine-after-expiry', contact, shippingAddress: address })).rejects.toMatchObject({ code: 'insufficient_inventory' });
      await expect(service.releaseReservation(context, quarantineCandidate.reservations[0].reservationId)).rejects.toMatchObject({ code: 'reservation_quarantined' });
      await expect(service.expireReservation(context, quarantineCandidate.reservations[0].reservationId)).rejects.toMatchObject({ code: 'reservation_quarantined' });
      const quarantinedStock = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${organization},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select inventory_quantity from kablet_native_products where id=${lifecycleProduct}::uuid`); });
      expect(quarantinedStock.rows[0].inventory_quantity).toBe(1);
    } finally {
      await runtime?.pool.end().catch(() => undefined);
      await bootstrap?.pool.end().catch(() => undefined);
      await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
      await managerPool.end();
    }
  }, 120000);
});
