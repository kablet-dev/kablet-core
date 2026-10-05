import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createBusinessTruthRepository, createDb } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');
const manager = loadTestManagerConfig();
const baseConnection = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;

function databaseName() { return `kablet_test_${randomBytes(16).toString('hex')}`; }

function postgresCause(error: unknown): { code?: string; message?: string } | undefined {
  let current: unknown = error;
  while (current && typeof current === 'object') {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === 'P0001' || (typeof candidate.message === 'string' && (candidate.message.includes('only an approved revision') || candidate.message.includes('approved revisions are immutable')))) {
      return { code: typeof candidate.code === 'string' ? candidate.code : undefined, message: typeof candidate.message === 'string' ? candidate.message : undefined };
    }
    current = candidate.cause;
  }
  return undefined;
}

async function provision() {
  const managerPool = new pg.Pool({ connectionString: `${baseConnection}/postgres`, max: 1 });
  const name = databaseName();
  try {
    const identity = await managerPool.query('select current_user, current_database()');
    if (identity.rows[0].current_user !== 'kablet_test_manager' || identity.rows[0].current_database !== 'postgres') throw new Error('Unsafe test-manager identity');
    await managerPool.query(`CREATE DATABASE "${name}" OWNER "kablet_test_manager"`);
    if (!bootstrapUser || !bootstrapPassword) throw new Error('TEST_BOOTSTRAP_USER and TEST_BOOTSTRAP_PASSWORD are required for trusted migration bootstrap');
    await managerPool.query(`GRANT CONNECT, CREATE ON DATABASE "${name}" TO "${bootstrapUser}"`);
    const managerTarget = new pg.Pool({ connectionString: `${baseConnection}/${name}`, max: 1 });
    try {
      await managerTarget.query(`GRANT USAGE, CREATE ON SCHEMA public TO "${bootstrapUser}"`);
      await managerTarget.query('GRANT USAGE, CREATE ON SCHEMA public TO kablet_privacy_owner');
    } finally { await managerTarget.end(); }
    const bootstrapConnection = `postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${name}`;
    return { name, managerPool, url: bootstrapConnection };
  } catch (error) {
    await managerPool.query(`DROP DATABASE IF EXISTS "${name}"`);
    await managerPool.end();
    throw error;
  }
}

async function dispose(resource: Awaited<ReturnType<typeof provision>>) {
  const target = new pg.Pool({ connectionString: `${baseConnection}/${resource.name}`, max: 1 });
  const identity = await target.query('select current_database(), current_user');
  await target.end();
  if (identity.rows[0].current_database !== resource.name || identity.rows[0].current_user !== 'kablet_test_manager') throw new Error('Unsafe cleanup target');
  const managerIdentity = await resource.managerPool.query('select current_user, current_database()');
  if (managerIdentity.rows[0].current_user !== 'kablet_test_manager' || managerIdentity.rows[0].current_database !== 'postgres') throw new Error('Unsafe cleanup identity');
  await resource.managerPool.query(`DROP DATABASE "${resource.name}"`);
  await resource.managerPool.end();
}

describe('disposable PostgreSQL integration', () => {
  it('migrates, verifies transactions, and isolates databases', async () => {
    let first: Awaited<ReturnType<typeof provision>> | undefined;
    let second: Awaited<ReturnType<typeof provision>> | undefined;
    const pools: pg.Pool[] = [];
    try {
      first = await provision();
      second = await provision();
      for (const resource of [first, second]) {
        const { db, pool } = createDb(resource.url); pools.push(pool);
        if (!roleAdminUrl) throw new Error('TEST_ROLE_ADMIN_URL is required to revoke bootstrap privacy-owner SET access after migrations');
        const roleAdmin = new pg.Pool({ connectionString: roleAdminUrl, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000 });
        try {
          await roleAdmin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
          await migrate(db, { migrationsFolder }); await migrate(db, { migrationsFolder });
        } finally {
          await roleAdmin.query('revoke kablet_privacy_owner from kablet_test_bootstrap');
          await roleAdmin.end();
        }
        if ((await resource.managerPool.query("select pg_has_role('kablet_test_bootstrap', 'kablet_privacy_owner', 'SET') as can_set")).rows[0].can_set) throw new Error('bootstrap privacy-owner SET access remains after trusted post-migration revocation');
        const contactSecurity = await db.execute(sql`select c.relname, c.relrowsecurity, c.relforcerowsecurity, has_table_privilege('kablet_dev', c.oid, 'SELECT') as runtime_select, has_table_privilege('kablet_dev', c.oid, 'INSERT') as runtime_insert, has_table_privilege('kablet_dev', c.oid, 'UPDATE') as runtime_update, has_table_privilege('kablet_dev', c.oid, 'DELETE') as runtime_delete from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('visitor_contact_records','visitor_consents') order by c.relname`);
        expect(contactSecurity.rows).toHaveLength(2);
        for (const row of contactSecurity.rows) expect(row).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, runtime_select: true, runtime_insert: true, runtime_update: false, runtime_delete: false });
        const immutableFunction = await db.execute(sql`select has_function_privilege('public', 'public.kablet_visitor_immutable()', 'EXECUTE') as public_execute, has_function_privilege('kablet_test_bootstrap', 'public.kablet_visitor_immutable()', 'EXECUTE') as bootstrap_execute`);
        expect(immutableFunction.rows[0]).toMatchObject({ public_execute: false, bootstrap_execute: false });
        const contactTriggers = await db.execute(sql`select c.relname, count(t.oid)::int as trigger_count from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_trigger t on t.tgrelid=c.oid and not t.tgisinternal and t.tgname in ('visitor_contact_records_immutable','visitor_consents_immutable') where n.nspname='public' and c.relname in ('visitor_contact_records','visitor_consents') group by c.relname order by case c.relname when 'visitor_contact_records' then 1 when 'visitor_consents' then 2 end`);
        expect(contactTriggers.rows).toEqual([{ relname: 'visitor_contact_records', trigger_count: 1 }, { relname: 'visitor_consents', trigger_count: 1 }]);
        expect((await db.execute(sql`insert into infrastructure_ledger default values returning id`)).rows).toHaveLength(1);
        await expect(db.transaction(async tx => { await tx.execute(sql`insert into infrastructure_ledger default values`); throw new Error('rollback-check'); })).rejects.toThrow('rollback-check');
      }
      const isolated = createDb(first.url); pools.push(isolated.pool);
      expect((await isolated.db.execute(sql`select count(*)::int as count from infrastructure_ledger`)).rows[0].count).toBe(1);
    } finally {
      await Promise.allSettled(pools.map(pool => pool.end()));
      if (second) await dispose(second); if (first) await dispose(first);
    }
  }, 90000);

  it('enforces Business Truth publication and revision invariants', async () => {
    let resource: Awaited<ReturnType<typeof provision>> | undefined;
    const pools: pg.Pool[] = [];
    try {
      resource = await provision();
      const { db, pool } = createDb(resource.url); pools.push(pool);
      if (!roleAdminUrl) throw new Error('TEST_ROLE_ADMIN_URL is required to revoke bootstrap privacy-owner SET access after migrations');
      const roleAdmin = new pg.Pool({ connectionString: roleAdminUrl, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000 });
      try {
        await roleAdmin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
        await migrate(db, { migrationsFolder });
      } finally {
        await roleAdmin.query('revoke kablet_privacy_owner from kablet_test_bootstrap');
        await roleAdmin.end();
      }
      if ((await resource.managerPool.query("select pg_has_role('kablet_test_bootstrap', 'kablet_privacy_owner', 'SET') as can_set")).rows[0].can_set) throw new Error('bootstrap privacy-owner SET access remains after trusted post-migration revocation');
      const tables = await db.execute(sql`select table_name from information_schema.tables where table_schema = 'public' and table_name in ('organizations','businesses','business_offerings','business_offering_revisions','offering_publications')`);
      expect(tables.rows).toHaveLength(5);
      const org = '11111111-1111-4111-8111-111111111111';
      const otherOrg = '22222222-2222-4222-8222-222222222222';
      const business = '33333333-3333-4333-8333-333333333333';
      const offering = '44444444-4444-4444-8444-444444444444';
      const revision = '55555555-5555-4555-8555-555555555555';
      await db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
        await tx.execute(sql`insert into organizations (id, name) values (${org}::uuid, 'Test Org')`);
        await tx.execute(sql`insert into businesses (id, organization_id, name) values (${business}::uuid, ${org}::uuid, 'Test Business')`);
        await tx.execute(sql`insert into business_offerings (id, business_id, name) values (${offering}::uuid, ${business}::uuid, 'Test Offering')`);
        await tx.execute(sql`insert into business_offering_revisions (id, offering_id, revision_number, name, description, pricing_kind, visibility, approval_status, provenance_source_type, provenance_source_reference, provenance_captured_at, provenance_captured_by) values (${revision}::uuid, ${offering}::uuid, 1, 'Draft', 'Description', 'unknown', 'public', 'draft', 'owner_input', 'fixture', now(), 'test')`);
      });
      let rejected: unknown;
      try {
        await db.transaction(async tx => {
          await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
          await tx.execute(sql`insert into offering_publications (offering_id, revision_id) values (${offering}::uuid, ${revision}::uuid)`);
        });
      } catch (error) { rejected = error; }
      expect(rejected).toBeTruthy();
      const postgresError = postgresCause(rejected);
      expect(postgresError?.code).toBe('P0001');
      expect(postgresError?.message).toContain('only an approved revision belonging to the offering may be published');
      const publicationCount = await db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`); return tx.execute(sql`select count(*)::int as count from offering_publications`); });
      expect(publicationCount.rows[0].count).toBe(0);
      const approval = await db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
        return tx.execute(sql`update business_offering_revisions set approval_status = 'approved' where id = ${revision}::uuid returning approval_status, offering_id`);
      });
      expect(approval.rows[0]).toMatchObject({ approval_status: 'approved', offering_id: offering });
      const repository = createBusinessTruthRepository(db);
      await repository.publish(org, offering, revision);
      expect((await repository.getPublicOffering(org, offering))?.revision_id).toBe(revision);
      await expect(repository.getPublicOffering(otherOrg, offering)).resolves.toBeNull();
      let immutabilityFailure: unknown;
      try {
        await db.transaction(async tx => {
          await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
          await tx.execute(sql`update business_offering_revisions set name = 'changed' where id = ${revision}::uuid`);
        });
      } catch (error) { immutabilityFailure = error; }
      expect(immutabilityFailure).toBeTruthy();
      const immutabilityError = postgresCause(immutabilityFailure);
      expect(immutabilityError?.code).toBe('P0001');
      expect(immutabilityError?.message).toContain('approved revisions are immutable');
      const unchanged = await db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
        return tx.execute(sql`select id, name, approval_status from business_offering_revisions where id = ${revision}::uuid`);
      });
      expect(unchanged.rows).toHaveLength(1);
      expect(unchanged.rows[0]).toMatchObject({ id: revision, name: 'Draft', approval_status: 'approved' });
      await repository.unpublish(org, offering);
      await expect(repository.getPublicOffering(org, offering)).resolves.toBeNull();
    } finally {
      await Promise.allSettled(pools.map(pool => pool.end()));
      if (resource) await dispose(resource);
    }
  }, 30000);
});
