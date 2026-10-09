import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createAiIntentRepository, createBusinessTruthRepository, createDb } from '@kablet/db';
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
        const aiSecurity = await db.execute(sql`select c.relname,c.relrowsecurity,c.relforcerowsecurity,has_table_privilege('kablet_dev',c.oid,'SELECT') as runtime_select,has_table_privilege('kablet_dev',c.oid,'INSERT') as runtime_insert,has_table_privilege('kablet_dev',c.oid,'UPDATE') as runtime_update,has_table_privilege('kablet_dev',c.oid,'DELETE') as runtime_delete,case when c.relname='ai_intent_invocations' then has_column_privilege('kablet_privacy_owner',c.oid,'visitor_identity_id','UPDATE') else false end as privacy_identity_update,case when c.relname='ai_intent_invocations' then has_column_privilege('kablet_privacy_owner',c.oid,'input_fingerprint','UPDATE') else false end as privacy_fingerprint_update from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('ai_intent_accounting_periods','ai_intent_invocations') order by c.relname`);
        expect(aiSecurity.rows).toHaveLength(2);
        expect(aiSecurity.rows[0]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, runtime_select: true, runtime_insert: true, runtime_update: true, runtime_delete: false, privacy_identity_update: false, privacy_fingerprint_update: false });
        expect(aiSecurity.rows[1]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, runtime_select: true, runtime_insert: true, runtime_update: true, runtime_delete: false, privacy_identity_update: true, privacy_fingerprint_update: true });
        const aiConstraints = await db.execute(sql`select table_name,constraint_name from information_schema.table_constraints where table_schema='public' and table_name in ('ai_intent_accounting_periods','ai_intent_invocations') and constraint_type in ('UNIQUE','FOREIGN KEY','CHECK')`);
        expect(aiConstraints.rows.length).toBeGreaterThanOrEqual(8);
        const aiFunctionSecurity = await db.execute(sql`select p.proname, r.rolname as owner, has_function_privilege('public', p.oid, 'EXECUTE') as public_execute, has_function_privilege('kablet_test_bootstrap', p.oid, 'EXECUTE') as bootstrap_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='public' and p.proname in ('kablet_ai_period_immutable','kablet_ai_invocation_transition','kablet_visitor_privacy_delete') order by p.proname`);
        expect(aiFunctionSecurity.rows).toHaveLength(3);
        for (const row of aiFunctionSecurity.rows) expect(row).toMatchObject({ owner: 'kablet_privacy_owner', public_execute: false, bootstrap_execute: false });
        const aiTriggers = await db.execute(sql`select c.relname, count(t.oid)::int as trigger_count from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_trigger t on t.tgrelid=c.oid and not t.tgisinternal and t.tgname in ('ai_intent_accounting_periods_immutable','ai_intent_invocations_transition') where n.nspname='public' and c.relname in ('ai_intent_accounting_periods','ai_intent_invocations') group by c.relname order by c.relname`);
        expect(aiTriggers.rows).toEqual([{ relname: 'ai_intent_accounting_periods', trigger_count: 1 }, { relname: 'ai_intent_invocations', trigger_count: 1 }]);
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

  it('proves AI invocation isolation, transition immutability, accounting constraints, and privacy anonymization', async () => {
    let resource: Awaited<ReturnType<typeof provision>> | undefined;
    let bootstrapPool: pg.Pool | undefined;
    let runtimePool: pg.Pool | undefined;
    try {
      resource = await provision();
      const bootstrap = createDb(resource.url); bootstrapPool = bootstrap.pool;
      if (!roleAdminUrl || !process.env.TEST_APP_PASSWORD) throw new Error('TEST_ROLE_ADMIN_URL and TEST_APP_PASSWORD are required for AI runtime coverage');
      const roleAdmin = new pg.Pool({ connectionString: roleAdminUrl, max: 1 });
      try {
        await roleAdmin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
        await migrate(bootstrap.db, { migrationsFolder });
      } finally { await roleAdmin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await roleAdmin.end(); }
      await bootstrap.db.execute(sql`grant usage on schema public to kablet_dev`);
      await bootstrap.db.execute(sql`grant select,insert,update,delete on organizations,businesses,visitor_identities,visitor_sessions,interaction_sessions,ai_intent_accounting_periods,ai_intent_invocations to kablet_dev`);
      const runtimeUrl = `postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${resource.name}`;
      const runtime = createDb(runtimeUrl); runtimePool = runtime.pool;
      const org = randomUUID(), business = randomUUID(), otherBusiness = randomUUID(), visitor = randomUUID(), session = randomUUID(), interaction = randomUUID(), daily = randomUUID(), monthly = randomUUID(), otherDaily = randomUUID(), otherMonthly = randomUUID(), invocation = randomUUID(), unknownInvocation = randomUUID();
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'AI Org')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'AI Business'),(${otherBusiness}::uuid,${org}::uuid,'Other Business')`);
        await tx.execute(sql`insert into visitor_identities(id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into visitor_sessions(id,organization_id,business_id,visitor_identity_id) values (${session}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid)`);
        await tx.execute(sql`insert into interaction_sessions(id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${interaction}::uuid,decode('00112233445566778899aabbccddeeff','hex'),${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,now()+interval '1 day')`);
      });
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`insert into ai_intent_accounting_periods(id,organization_id,business_id,period_kind,period_start,period_end,max_units) values (${daily}::uuid,${org}::uuid,${business}::uuid,'daily',current_date,current_date+1,100),(${monthly}::uuid,${org}::uuid,${business}::uuid,'monthly',date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month')::date,100)`);
      });
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${otherBusiness},true)`);
        await tx.execute(sql`insert into ai_intent_accounting_periods(id,organization_id,business_id,period_kind,period_start,period_end,max_units) values (${otherDaily}::uuid,${org}::uuid,${otherBusiness}::uuid,'daily',current_date,current_date+1,100),(${otherMonthly}::uuid,${org}::uuid,${otherBusiness}::uuid,'monthly',date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month')::date,100)`);
      });
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`insert into ai_intent_invocations(id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,idempotency_key,input_fingerprint,status,interpreter_version,reserved_units,daily_period_id,monthly_period_id) values (${invocation}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,${interaction}::uuid,'ai-1',decode('0102','hex'),'claimed','test-adapter',10,${daily}::uuid,${monthly}::uuid),(${unknownInvocation}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,${interaction}::uuid,'ai-unknown',decode('0304','hex'),'claimed','test-adapter',7,${daily}::uuid,${monthly}::uuid)`);
      });
      const visible = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select id,interaction_session_id,status,reserved_units from ai_intent_invocations where id=${invocation}::uuid`); });
      expect(visible.rows).toEqual([{ id: invocation, interaction_session_id: interaction, status: 'claimed', reserved_units: '10' }]);
      const hidden = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${otherBusiness},true)`); return tx.execute(sql`select count(*)::int as count from ai_intent_invocations where id=${invocation}::uuid`); });
      expect(hidden.rows[0].count).toBe(0);
      const crossBusinessUpdate = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${otherBusiness},true)`); return tx.execute(sql`update ai_intent_invocations set reserved_units=1 where id=${invocation}::uuid`); });
      expect(crossBusinessUpdate.rowCount).toBe(0);
      const unchangedAfterCrossBusinessUpdate = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select reserved_units from ai_intent_invocations where id=${invocation}::uuid`); });
      expect(unchangedAfterCrossBusinessUpdate.rows[0].reserved_units).toBe('10');
      for (const statement of [sql`update ai_intent_invocations set idempotency_key='changed' where id=${invocation}::uuid`, sql`update ai_intent_invocations set input_fingerprint=decode('ff','hex') where id=${invocation}::uuid`, sql`update ai_intent_invocations set daily_period_id=${otherDaily}::uuid where id=${invocation}::uuid`, sql`update ai_intent_invocations set visitor_identity_id=null where id=${invocation}::uuid`]) {
        await expect(runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(statement); })).rejects.toThrow();
      }
      await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update ai_intent_invocations set status='succeeded',normalized_intent='unclear',reason_code='ambiguous',consumed_units=4,completed_at=now() where id=${invocation}::uuid`); });
      const afterSucceeded = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select interaction_session_id,status from ai_intent_invocations where id=${invocation}::uuid`); });
      expect(afterSucceeded.rows[0]).toMatchObject({ interaction_session_id: interaction, status: 'succeeded' });
      await expect(runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update ai_intent_invocations set consumed_units=5 where id=${invocation}::uuid`); })).rejects.toThrow();
      const replayIdentity = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select interaction_session_id,idempotency_key,input_fingerprint,interpreter_version from ai_intent_invocations where id=${invocation}::uuid`); });
      expect(replayIdentity.rows[0]).toMatchObject({ interaction_session_id: interaction, idempotency_key: 'ai-1', interpreter_version: 'test-adapter' });
      const terminalReplay = await createAiIntentRepository(runtime.db).claim({ organizationId: org, businessId: business, interactionSessionId: replayIdentity.rows[0].interaction_session_id, idempotencyKey: replayIdentity.rows[0].idempotency_key, inputFingerprint: Uint8Array.from(replayIdentity.rows[0].input_fingerprint), interpreterVersion: replayIdentity.rows[0].interpreter_version, reservationUnits: 10 });
      expect(terminalReplay).toMatchObject({ outcome: 'replay', invocationId: invocation, status: 'succeeded', reservedUnits: 10 });
      await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update ai_intent_invocations set status='unknown',uncertain_units=7,completed_at=now() where id=${unknownInvocation}::uuid`); });
      const unknownReplay = await createAiIntentRepository(runtime.db).claim({ organizationId: org, businessId: business, interactionSessionId: interaction, idempotencyKey: 'ai-unknown', inputFingerprint: Uint8Array.from([3, 4]), interpreterVersion: 'test-adapter', reservationUnits: 7 });
      expect(unknownReplay).toMatchObject({ outcome: 'replay', invocationId: unknownInvocation, status: 'unknown', reservedUnits: 7 });
      const beforePrivacy = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select visitor_identity_id,visitor_session_id,interaction_session_id,input_fingerprint,reserved_units,uncertain_units from ai_intent_invocations where id=${unknownInvocation}::uuid`); });
      expect(beforePrivacy.rows[0].visitor_identity_id).toBe(visitor);
      await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`select public.kablet_visitor_privacy_delete(${org}::uuid,${visitor}::uuid)`); });
      const afterPrivacy = await bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select id,visitor_identity_id,visitor_session_id,interaction_session_id,input_fingerprint,reserved_units,consumed_units,released_units,uncertain_units,daily_period_id,monthly_period_id,status from ai_intent_invocations where id in (${invocation}::uuid,${unknownInvocation}::uuid) order by id`); });
      expect(afterPrivacy.rows).toHaveLength(2);
      for (const row of afterPrivacy.rows) expect(row).toMatchObject({ visitor_identity_id: null, visitor_session_id: null, interaction_session_id: null, input_fingerprint: null, daily_period_id: daily, monthly_period_id: monthly });
      expect(afterPrivacy.rows.find(row => row.id === invocation)).toMatchObject({ reserved_units: '10', consumed_units: '4', released_units: '0', uncertain_units: '0', status: 'succeeded' });
      expect(afterPrivacy.rows.find(row => row.id === unknownInvocation)).toMatchObject({ reserved_units: '7', consumed_units: '0', released_units: '0', uncertain_units: '7', status: 'unknown' });
      await expect(createAiIntentRepository(runtime.db).claim({ organizationId: org, businessId: business, interactionSessionId: interaction, idempotencyKey: 'ai-unknown', inputFingerprint: Uint8Array.from([3, 4]), interpreterVersion: 'test-adapter', reservationUnits: 7 })).resolves.toMatchObject({ outcome: 'session_invalid' });
      const businessBView = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${otherBusiness},true)`); return tx.execute(sql`select count(*)::int as count from ai_intent_invocations where id in (${invocation}::uuid,${unknownInvocation}::uuid)`); });
      expect(businessBView.rows[0].count).toBe(0);
      await expect(bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`insert into ai_intent_accounting_periods(id,organization_id,business_id,period_kind,period_start,period_end,max_units) values (${randomUUID()}::uuid,${org}::uuid,${business}::uuid,'daily',current_date,current_date+1,-1)`); })).rejects.toThrow();
      await expect(bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update ai_intent_accounting_periods set period_start=period_start+1 where id=${daily}::uuid`); })).rejects.toThrow();
      await expect(bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`delete from ai_intent_accounting_periods where id=${daily}::uuid`); })).rejects.toThrow();
    } finally {
      await bootstrapPool?.end(); await runtimePool?.end(); if (resource) await dispose(resource);
    }
  }, 90000);

  it('atomically claims, replays, conflicts, and enforces persisted period budgets', async () => {
    let resource: Awaited<ReturnType<typeof provision>> | undefined;
    let bootstrapPool: pg.Pool | undefined;
    let runtimePool: pg.Pool | undefined;
    try {
      resource = await provision();
      const bootstrap = createDb(resource.url); bootstrapPool = bootstrap.pool;
      if (!roleAdminUrl || !process.env.TEST_APP_PASSWORD) throw new Error('TEST_ROLE_ADMIN_URL and TEST_APP_PASSWORD are required for AI claim coverage');
      const roleAdmin = new pg.Pool({ connectionString: roleAdminUrl, max: 1 });
      try { await roleAdmin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false'); await migrate(bootstrap.db, { migrationsFolder }); }
      finally { await roleAdmin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await roleAdmin.end(); }
      await bootstrap.db.execute(sql`grant usage on schema public to kablet_dev`);
      await bootstrap.db.execute(sql`grant select,insert,update,delete on organizations,businesses,visitor_identities,visitor_sessions,interaction_sessions,ai_intent_accounting_periods,ai_intent_invocations to kablet_dev`);
      const runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${resource.name}`); runtimePool = runtime.pool;
      const org = randomUUID(), business = randomUUID(), visitor = randomUUID(), visitorSession = randomUUID(), interactionSession = randomUUID(), secondInteractionSession = randomUUID(), daily = randomUUID(), monthly = randomUUID();
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Claim Org')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'Claim Business')`);
        await tx.execute(sql`insert into visitor_identities(id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into visitor_sessions(id,organization_id,business_id,visitor_identity_id) values (${visitorSession}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid)`);
        await tx.execute(sql`insert into interaction_sessions(id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${interactionSession}::uuid,decode('11223344556677889900aabbccddeeff','hex'),${org}::uuid,${business}::uuid,${visitor}::uuid,${visitorSession}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into interaction_sessions(id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${secondInteractionSession}::uuid,decode('ffeeddccbbaa00998877665544332211','hex'),${org}::uuid,${business}::uuid,${visitor}::uuid,${visitorSession}::uuid,now()+interval '1 day')`);
      });
      await bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`insert into ai_intent_accounting_periods(id,organization_id,business_id,period_kind,period_start,period_end,max_units) values (${daily}::uuid,${org}::uuid,${business}::uuid,'daily',current_date,current_date+1,10),(${monthly}::uuid,${org}::uuid,${business}::uuid,'monthly',date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month')::date,10)`); });
      const repository = createAiIntentRepository(runtime.db);
      const base = { organizationId: org, businessId: business, interactionSessionId: interactionSession, idempotencyKey: 'claim-1', inputFingerprint: Uint8Array.from([1, 2, 3]), interpreterVersion: 'test', reservationUnits: 6 };
      await bootstrap.db.execute(sql`create or replace function public.test_ai_claim_insert_failure() returns trigger language plpgsql as $$ begin if NEW.idempotency_key='rollback-after-reservation' then raise exception 'test-only invocation insertion failure'; end if; return NEW; end $$`);
      await bootstrap.db.execute(sql`create trigger test_ai_claim_insert_failure before insert on ai_intent_invocations for each row execute function public.test_ai_claim_insert_failure()`);
      const beforeRollback = await bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select reserved_units from ai_intent_accounting_periods where id=${daily}::uuid)::int as daily_reserved,(select reserved_units from ai_intent_accounting_periods where id=${monthly}::uuid)::int as monthly_reserved,(select count(*) from ai_intent_invocations)::int as invocations`); });
      let rollbackError: unknown;
      try { await repository.claim({ ...base, idempotencyKey: 'rollback-after-reservation', inputFingerprint: Uint8Array.from([8]), reservationUnits: 1 }); } catch (error) { rollbackError = error; }
      expect(rollbackError).toBeTruthy();
      const rollbackCause = postgresCause(rollbackError);
      expect(rollbackCause?.code).toBe('P0001');
      expect(rollbackCause?.message).toContain('test-only invocation insertion failure');
      const afterRollback = await bootstrap.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select reserved_units from ai_intent_accounting_periods where id=${daily}::uuid)::int as daily_reserved,(select reserved_units from ai_intent_accounting_periods where id=${monthly}::uuid)::int as monthly_reserved,(select count(*) from ai_intent_invocations)::int as invocations`); });
      expect(afterRollback.rows[0]).toEqual(beforeRollback.rows[0]);
      await bootstrap.db.execute(sql`drop trigger test_ai_claim_insert_failure on ai_intent_invocations`);
      await bootstrap.db.execute(sql`drop function public.test_ai_claim_insert_failure()`);
      const created = await repository.claim(base);
      expect(created.outcome).toBe('created');
      const replay = await repository.claim(base);
      expect(replay).toMatchObject({ outcome: 'replay', invocationId: (created as { invocationId: string }).invocationId, reservedUnits: 6 });
      await expect(repository.claim({ ...base, inputFingerprint: Uint8Array.from([9]) })).resolves.toMatchObject({ outcome: 'idempotency_conflict' });
      const independentClaim = async (claimInput: typeof base) => { const connection = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${resource!.name}`); try { return await createAiIntentRepository(connection.db).claim(claimInput); } finally { await connection.pool.end(); } };
      const identicalClaims = await Promise.all(Array.from({ length: 10 }, () => independentClaim({ ...base, idempotencyKey: 'concurrent-identical', inputFingerprint: Uint8Array.from([5]), reservationUnits: 1 })));
      expect(identicalClaims.filter(result => result.outcome === 'created')).toHaveLength(1);
      expect(identicalClaims.filter(result => result.outcome === 'replay')).toHaveLength(9);
      const conflictingClaims = await Promise.all(Array.from({ length: 10 }, (_, index) => independentClaim({ ...base, idempotencyKey: 'concurrent-conflict', inputFingerprint: Uint8Array.from([index + 20]), reservationUnits: 1 })));
      expect(conflictingClaims.filter(result => result.outcome === 'created')).toHaveLength(1);
      expect(conflictingClaims.filter(result => result.outcome === 'idempotency_conflict')).toHaveLength(9);
      const finalUnitClaims = await Promise.all(Array.from({ length: 10 }, (_, index) => independentClaim({ ...base, interactionSessionId: index % 2 === 0 ? interactionSession : secondInteractionSession, idempotencyKey: `final-unit-${index}`, inputFingerprint: Uint8Array.from([50 + index]), reservationUnits: 1 })));
      expect(finalUnitClaims.filter(result => result.outcome === 'created')).toHaveLength(2);
      expect(finalUnitClaims.filter(result => result.outcome === 'budget_exhausted')).toHaveLength(8);
      await expect(repository.claim({ ...base, idempotencyKey: 'claim-2', inputFingerprint: Uint8Array.from([4]), reservationUnits: 5 })).resolves.toMatchObject({ outcome: 'budget_exhausted' });
      const persisted = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select count(*)::int as invocations,(select reserved_units from ai_intent_accounting_periods where id=${daily}::uuid)::int as daily_reserved,(select reserved_units from ai_intent_accounting_periods where id=${monthly}::uuid)::int as monthly_reserved from ai_intent_invocations`); });
      expect(persisted.rows[0]).toMatchObject({ invocations: 5, daily_reserved: 10, monthly_reserved: 10 });
      await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update ai_intent_accounting_periods set released_units=2 where id in (${daily}::uuid,${monthly}::uuid)`); });
      const releasedCapacity = await repository.claim({ ...base, idempotencyKey: 'released-capacity', inputFingerprint: Uint8Array.from([77]), reservationUnits: 2 });
      expect(releasedCapacity.outcome).toBe('created');
      const releasedCounters = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select reserved_units,released_units from ai_intent_accounting_periods where id=${daily}::uuid`); });
      expect(releasedCounters.rows[0]).toMatchObject({ reserved_units: '12', released_units: '2' });
      await expect(runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update ai_intent_accounting_periods set released_units=13 where id=${daily}::uuid`); })).rejects.toThrow();

      await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update ai_intent_accounting_periods set released_units=4 where id=${daily}::uuid`); await tx.execute(sql`update ai_intent_accounting_periods set released_units=2 where id=${monthly}::uuid`); });
      const beforeMonthlyExhaustion = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*)::int from ai_intent_invocations) as invocations,(select reserved_units from ai_intent_accounting_periods where id=${daily}::uuid) as daily_reserved,(select reserved_units from ai_intent_accounting_periods where id=${monthly}::uuid) as monthly_reserved`); });
      await expect(repository.claim({ ...base, idempotencyKey: 'monthly-still-exhausted', inputFingerprint: Uint8Array.from([78]), reservationUnits: 1 })).resolves.toMatchObject({ outcome: 'budget_exhausted', period: 'monthly' });
      const afterMonthlyExhaustion = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*)::int from ai_intent_invocations) as invocations,(select reserved_units from ai_intent_accounting_periods where id=${daily}::uuid) as daily_reserved,(select reserved_units from ai_intent_accounting_periods where id=${monthly}::uuid) as monthly_reserved`); });
      expect(afterMonthlyExhaustion.rows[0]).toEqual(beforeMonthlyExhaustion.rows[0]);
      await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update ai_intent_accounting_periods set released_units=3 where id=${monthly}::uuid`); });
      await expect(repository.claim({ ...base, idempotencyKey: 'monthly-restored', inputFingerprint: Uint8Array.from([79]), reservationUnits: 1 })).resolves.toMatchObject({ outcome: 'created' });

      await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update ai_intent_accounting_periods set released_units=3 where id=${daily}::uuid`); await tx.execute(sql`update ai_intent_accounting_periods set released_units=4 where id=${monthly}::uuid`); });
      const beforeDailyExhaustion = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*)::int from ai_intent_invocations) as invocations,(select reserved_units from ai_intent_accounting_periods where id=${daily}::uuid) as daily_reserved,(select reserved_units from ai_intent_accounting_periods where id=${monthly}::uuid) as monthly_reserved`); });
      await expect(repository.claim({ ...base, idempotencyKey: 'daily-still-exhausted', inputFingerprint: Uint8Array.from([80]), reservationUnits: 1 })).resolves.toMatchObject({ outcome: 'budget_exhausted', period: 'daily' });
      const afterDailyExhaustion = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*)::int from ai_intent_invocations) as invocations,(select reserved_units from ai_intent_accounting_periods where id=${daily}::uuid) as daily_reserved,(select reserved_units from ai_intent_accounting_periods where id=${monthly}::uuid) as monthly_reserved`); });
      expect(afterDailyExhaustion.rows[0]).toEqual(beforeDailyExhaustion.rows[0]);
      await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update ai_intent_accounting_periods set released_units=4 where id=${daily}::uuid`); });
      await expect(repository.claim({ ...base, idempotencyKey: 'daily-restored', inputFingerprint: Uint8Array.from([81]), reservationUnits: 1 })).resolves.toMatchObject({ outcome: 'created' });
    } finally { await bootstrapPool?.end(); await runtimePool?.end(); if (resource) await dispose(resource); }
  }, 90000);

  it('uses the injected UTC claim clock for daily and monthly rollover attribution', async () => {
    let resource: Awaited<ReturnType<typeof provision>> | undefined;
    let bootstrapPool: pg.Pool | undefined;
    let runtimePool: pg.Pool | undefined;
    try {
      resource = await provision();
      const bootstrap = createDb(resource.url); bootstrapPool = bootstrap.pool;
      if (!roleAdminUrl || !process.env.TEST_APP_PASSWORD) throw new Error('TEST_ROLE_ADMIN_URL and TEST_APP_PASSWORD are required for rollover coverage');
      const roleAdmin = new pg.Pool({ connectionString: roleAdminUrl, max: 1 });
      try { await roleAdmin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false'); await migrate(bootstrap.db, { migrationsFolder }); }
      finally { await roleAdmin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await roleAdmin.end(); }
      await bootstrap.db.execute(sql`grant usage on schema public to kablet_dev`);
      await bootstrap.db.execute(sql`grant select,insert,update,delete on organizations,businesses,visitor_identities,visitor_sessions,interaction_sessions,ai_intent_accounting_periods,ai_intent_invocations to kablet_dev`);
      const runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${resource.name}`); runtimePool = runtime.pool;
      const org = randomUUID(), business = randomUUID(), visitor = randomUUID(), visitorSession = randomUUID(), interactionSession = randomUUID();
      const daily080 = randomUUID(), daily090 = randomUUID(), daily310 = randomUUID(), daily110 = randomUUID(), monthly10 = randomUUID(), monthly11 = randomUUID();
      await bootstrap.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Rollover Org')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'Rollover Business')`);
        await tx.execute(sql`insert into visitor_identities(id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${org}::uuid,${business}::uuid,'2026-12-01T00:00:00Z')`);
        await tx.execute(sql`insert into visitor_sessions(id,organization_id,business_id,visitor_identity_id,last_seen_at) values (${visitorSession}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,'2026-10-08T23:59:59Z')`);
        await tx.execute(sql`insert into interaction_sessions(id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${interactionSession}::uuid,decode('1234567890abcdef1234567890abcdef','hex'),${org}::uuid,${business}::uuid,${visitor}::uuid,${visitorSession}::uuid,'2026-12-01T00:00:00Z')`);
        await tx.execute(sql`insert into ai_intent_accounting_periods(id,organization_id,business_id,period_kind,period_start,period_end,max_units) values (${daily080}::uuid,${org}::uuid,${business}::uuid,'daily','2026-10-08','2026-10-09',100),(${daily090}::uuid,${org}::uuid,${business}::uuid,'daily','2026-10-09','2026-10-10',100),(${daily310}::uuid,${org}::uuid,${business}::uuid,'daily','2026-10-31','2026-11-01',100),(${daily110}::uuid,${org}::uuid,${business}::uuid,'daily','2026-11-01','2026-11-02',100),(${monthly10}::uuid,${org}::uuid,${business}::uuid,'monthly','2026-10-01','2026-11-01',100),(${monthly11}::uuid,${org}::uuid,${business}::uuid,'monthly','2026-11-01','2026-12-01',100)`);
      });
      const repository = createAiIntentRepository(runtime.db, () => new Date('2026-10-08T23:59:59Z'));
      const common = { organizationId: org, businessId: business, interactionSessionId: interactionSession, interpreterVersion: 'rollover-test', reservationUnits: 3 };
      const dayBefore = await repository.claim({ ...common, idempotencyKey: 'utc-day-before', inputFingerprint: Uint8Array.from([1]), });
      const dayAfter = await createAiIntentRepository(runtime.db, () => new Date('2026-10-09T00:00:01Z')).claim({ ...common, idempotencyKey: 'utc-day-after', inputFingerprint: Uint8Array.from([2]) });
      const monthBefore = await createAiIntentRepository(runtime.db, () => new Date('2026-10-31T23:59:59Z')).claim({ ...common, idempotencyKey: 'utc-month-before', inputFingerprint: Uint8Array.from([3]) });
      const monthAfter = await createAiIntentRepository(runtime.db, () => new Date('2026-11-01T00:00:01Z')).claim({ ...common, idempotencyKey: 'utc-month-after', inputFingerprint: Uint8Array.from([4]) });
      expect(dayBefore.outcome).toBe('created'); expect(dayAfter.outcome).toBe('created'); expect(monthBefore.outcome).toBe('created'); expect(monthAfter.outcome).toBe('created');
      const rows = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select id,daily_period_id,monthly_period_id,claimed_at from ai_intent_invocations where id in (${(dayBefore as { invocationId: string }).invocationId}::uuid,${(dayAfter as { invocationId: string }).invocationId}::uuid,${(monthBefore as { invocationId: string }).invocationId}::uuid,${(monthAfter as { invocationId: string }).invocationId}::uuid) order by claimed_at`); });
      expect(rows.rows.map(row => row.daily_period_id)).toEqual([daily080, daily090, daily310, daily110]);
      expect(rows.rows.map(row => row.monthly_period_id)).toEqual([monthly10, monthly10, monthly10, monthly11]);
      const counters = await runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select id,reserved_units from ai_intent_accounting_periods where id in (${daily080}::uuid,${daily090}::uuid,${daily310}::uuid,${daily110}::uuid,${monthly10}::uuid,${monthly11}::uuid) order by id`); });
      expect(counters.rows.filter(row => [daily080, daily090, daily310, daily110].includes(row.id)).every(row => row.reserved_units === '3')).toBe(true);
      expect(counters.rows.find(row => row.id === monthly10)?.reserved_units).toBe('9');
      expect(counters.rows.find(row => row.id === monthly11)?.reserved_units).toBe('3');
    } finally { await bootstrapPool?.end(); await runtimePool?.end(); if (resource) await dispose(resource); }
  }, 90000);
});
