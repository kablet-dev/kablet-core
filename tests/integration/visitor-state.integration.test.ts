import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createBusinessTruthRepository, createDb, createVisitorStateRepository } from '@kablet/db';
import { reduceVisitorStateFromEvidence } from '@kablet/domain';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const manager = loadTestManagerConfig();
const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
const migrationsFolder = `${process.cwd()}\\packages\\db\\drizzle`;
const org = '11111111-1111-4111-8111-111111111111';
const otherOrg = '22222222-2222-4222-8222-222222222222';
const appPassword = process.env.TEST_APP_PASSWORD;
const unauthorizedUser = process.env.TEST_UNAUTHORIZED_USER;
const unauthorizedPassword = process.env.TEST_UNAUTHORIZED_PASSWORD;
const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;

function errorChainIncludes(error: unknown, text: string) {
  let current: unknown = error;
  while (current) {
    if (current instanceof Error && current.message.includes(text)) return true;
    if (typeof current === 'object' && current !== null && 'cause' in current) current = (current as { cause?: unknown }).cause;
    else break;
  }
  return false;
}

async function disposable() {
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  const identity = await managerPool.query('select current_user,current_database()');
  if (identity.rows[0].current_user !== 'kablet_test_manager' || identity.rows[0].current_database !== 'postgres') throw Error('unsafe test manager');
  const name = `kablet_test_${randomBytes(16).toString('hex')}`;
  await managerPool.query(`create database "${name}" owner "kablet_test_manager"`);
  if (!bootstrapUser || !bootstrapPassword) throw new Error('TEST_BOOTSTRAP_USER and TEST_BOOTSTRAP_PASSWORD are required for trusted migration bootstrap');
  await managerPool.query(`grant connect, create on database "${name}" to "${bootstrapUser}"`);
  const managerTarget = new pg.Pool({ connectionString: `${base}/${name}`, max: 1 });
  try {
    await managerTarget.query(`grant usage, create on schema public to "${bootstrapUser}"`);
    await managerTarget.query(`grant usage, create on schema public to kablet_privacy_owner`);
    const preflight = await managerTarget.query(`select current_database() as database, has_schema_privilege($1,'public','USAGE') as bootstrap_usage, has_schema_privilege($1,'public','CREATE') as bootstrap_create, has_schema_privilege('kablet_privacy_owner','public','USAGE') as privacy_usage, has_schema_privilege('kablet_privacy_owner','public','CREATE') as privacy_create`, [bootstrapUser]);
    const row = preflight.rows[0];
    if (row.database !== name) throw new Error(`bootstrap privilege preflight database mismatch: ${row.database}`);
    if (!row.bootstrap_usage || !row.bootstrap_create) throw new Error('bootstrap privilege preflight failed: bootstrap role lacks public schema USAGE/CREATE');
    if (!row.privacy_usage || !row.privacy_create) throw new Error('bootstrap privilege preflight failed: privacy owner lacks public schema USAGE/CREATE');
  } finally { await managerTarget.end(); }
  const bootstrapBase = `postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
  const db = createDb(`${bootstrapBase}/${name}`);
  try {
    if (!roleAdminUrl) throw new Error('TEST_ROLE_ADMIN_URL is required to revoke bootstrap privacy-owner SET access after migrations');
    const roleAdmin = new pg.Pool({ connectionString: roleAdminUrl, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000 });
    try {
      await roleAdmin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
      await migrate(db.db, { migrationsFolder });
      await migrate(db.db, { migrationsFolder });
    } finally {
      await roleAdmin.query('revoke kablet_privacy_owner from kablet_test_bootstrap');
      await roleAdmin.end();
    }
    const postBootstrap = await managerPool.query("select pg_has_role('kablet_test_bootstrap', 'kablet_privacy_owner', 'SET') as can_set");
    if (postBootstrap.rows[0].can_set) throw new Error('bootstrap privacy-owner SET access remains after trusted post-migration revocation');
    return { name, managerPool, db };
  } catch (error) {
    await db.pool.end();
    await managerPool.query(`drop database "${name}"`);
    await managerPool.end();
    throw error;
  }
}

async function cleanup(resource: Awaited<ReturnType<typeof disposable>>) {
  await resource.db.pool.end();
  const target = new pg.Pool({ connectionString: `${base}/${resource.name}`, max: 1 });
  const identity = await target.query('select current_database(),current_user');
  await target.end();
  if (identity.rows[0].current_database !== resource.name || identity.rows[0].current_user !== 'kablet_test_manager') throw Error('unsafe cleanup target');
  await resource.managerPool.query(`drop database "${resource.name}"`);
  await resource.managerPool.end();
}

async function grantRuntimePrivileges(resource: Awaited<ReturnType<typeof disposable>>) {
  if (!bootstrapUser || !bootstrapPassword) throw new Error('trusted bootstrap credentials are required');
  const bootstrapBase = `postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
  const admin = new pg.Pool({ connectionString: `${bootstrapBase}/${resource.name}`, max: 1 });
  await admin.query('grant usage on schema public to kablet_dev');
  await admin.query('grant select,insert,update,delete on organizations,businesses,business_offerings,business_offering_revisions,offering_publications,visitor_identities,visitor_sessions,visitor_observations,visitor_state_revisions,visitor_states to kablet_dev');
  await admin.end();
}

async function fixture(db: ReturnType<typeof createDb>) {
  const business = randomUUID();
  await db.db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
    await tx.execute(sql`insert into organizations(id,name) values(${org}::uuid,'Org')`);
    await tx.execute(sql`insert into businesses(id,organization_id,name) values(${business}::uuid,${org}::uuid,'Business')`);
  });
  return business;
}

function observation(visitorIdentityId: string, sessionId: string, businessId: string, key = randomUUID(), kind = 'intent.expressed') {
  return { id: randomUUID(), organizationId: org, businessId, visitorIdentityId, sessionId, kind, value: { type: 'intent', value: 'explore_offerings' }, idempotencyKey: key, observedAt: new Date(), sourceType: 'visitor', sourceReference: 'integration-test' };
}

async function createPublishedOffering(db: ReturnType<typeof createDb>, businessId: string, approved = true) {
  const offeringId = randomUUID();
  const revisionId = randomUUID();
  await db.db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
    await tx.execute(sql`insert into business_offerings(id,business_id,name) values (${offeringId}::uuid,${businessId}::uuid,'Offering')`);
    await tx.execute(sql`insert into business_offering_revisions(id,offering_id,revision_number,name,description,pricing_kind,visibility,approval_status,provenance_source_type,provenance_source_reference,provenance_captured_at,provenance_captured_by) values (${revisionId}::uuid,${offeringId}::uuid,1,'Offering','Description','unknown','public',${approved ? 'approved' : 'draft'},'owner_input','fixture',now(),'test')`);
  });
  if (approved) await createBusinessTruthRepository(db.db).publish(org, offeringId, revisionId);
  return { offeringId, revisionId };
}

describe('Visitor State disposable PostgreSQL integration', () => {
  it('creates version zero, ingests version one, and replays idempotently', async () => {
    const r = await disposable();
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, business, visitor);
      const first = observation(visitor, session, business);
      const accepted = await repo.ingest(org, first);
      expect(accepted.revisionId).toBeTruthy();
      expect((await repo.ingest(org, first)).idempotent).toBe(true);
      const state = await r.db.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`select set_config('kablet.business_id',${business},true)`);
        return tx.execute(sql`select version from visitor_states where visitor_identity_id=${visitor}::uuid`);
      });
      expect(Number(state.rows[0].version)).toBe(1);
    } finally { await cleanup(r); }
  }, 90000);

  it('rejects mismatched ownership and missing tenant context', async () => {
    const r = await disposable();
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, business, visitor);
      await expect(repo.ingest(otherOrg, observation(visitor, session, business))).rejects.toThrow();
      const hidden = await r.db.db.execute(sql`select count(*)::int as count from visitor_identities`);
      expect(Number(hidden.rows[0].count)).toBe(0);
      await expect(repo.createSession(org, randomUUID(), visitor)).rejects.toThrow();
    } finally { await cleanup(r); }
  }, 90000);

  it('preserves immutable evidence and rejects confirmed overwrite', async () => {
    const r = await disposable();
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, business, visitor);
      const first = observation(visitor, session, business);
      await repo.ingest(org, first);
      await repo.ingest(org, observation(visitor, session, business, randomUUID(), 'intent.confirmed'));
      const conflicting = { ...observation(visitor, session, business), value: { type: 'intent', value: 'request_information' } };
      await expect(repo.ingest(org, conflicting)).rejects.toThrow();
      const evidence = await r.db.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`select set_config('kablet.business_id',${business},true)`);
        return tx.execute(sql`select id, source_reference from visitor_observations where id=${first.id}::uuid`);
      });
      expect(evidence.rows).toHaveLength(1);
      expect(evidence.rows[0].source_reference).toBe('integration-test');
    } finally { await cleanup(r); }
  }, 90000);

  it('deletes visitor privacy lineage and blocks future ingestion', async () => {
    const r = await disposable();
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, business, visitor);
      await repo.ingest(org, observation(visitor, session, business));
      if (!appPassword) throw new Error('TEST_APP_PASSWORD is required for authorized privacy coverage');
      await grantRuntimePrivileges(r);
      const runtimeUrl = `${base.replace('kablet_test_manager', 'kablet_dev').replace(encodeURIComponent(manager.TEST_MANAGER_PASSWORD), encodeURIComponent(appPassword))}/${r.name}`;
      const runtimeDb = createDb(runtimeUrl);
      try {
        expect(await createVisitorStateRepository(runtimeDb.db).anonymize(org, visitor, business)).toBe(true);
      } finally { await runtimeDb.pool.end(); }
      const counts = await r.db.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`select set_config('kablet.business_id',${business},true)`);
        return tx.execute(sql`select (select count(*) from visitor_identities where id=${visitor}::uuid) as identities,(select count(*) from visitor_observations where visitor_identity_id=${visitor}::uuid) as observations,(select count(*) from visitor_state_revisions where visitor_identity_id=${visitor}::uuid) as revisions`);
      });
      expect(Number(counts.rows[0].identities)).toBe(0);
      expect(Number(counts.rows[0].observations)).toBe(0);
      expect(Number(counts.rows[0].revisions)).toBe(0);
      await expect(repo.ingest(org, observation(visitor, session, business))).rejects.toThrow();
    } finally { await cleanup(r); }
  }, 90000);

  it('rolls back stale state transitions atomically', async () => {
    const r = await disposable();
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, business, visitor);
      const first = { ...observation(visitor, session, business), expectedVersion: 0 };
      const competing = { ...observation(visitor, session, business), expectedVersion: 0 };
      await expect(repo.ingest(org, first)).resolves.toMatchObject({ idempotent: false });
      await expect(repo.ingest(org, competing)).rejects.toThrow('stale-version conflict');
      const counts = await r.db.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`); await tx.execute(sql`select set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select version from visitor_states where visitor_identity_id=${visitor}::uuid) as version,(select count(*) from visitor_observations where visitor_identity_id=${visitor}::uuid) as observations,(select count(*) from visitor_state_revisions where visitor_identity_id=${visitor}::uuid) as revisions`); });
      expect(Number(counts.rows[0].version)).toBe(1);
      expect(Number(counts.rows[0].observations)).toBe(1);
      expect(Number(counts.rows[0].revisions)).toBe(2);
      await expect(repo.ingest(org, first)).resolves.toMatchObject({ idempotent: true });
    } finally { await cleanup(r); }
  }, 90000);

  it('verifies restricted application-role immutability and RLS', async () => {
    if (!appPassword) throw new Error('TEST_APP_PASSWORD is required for restricted-role integration coverage');
    const r = await disposable();
    let appPool: pg.Pool | undefined;
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, business, visitor);
      const first = observation(visitor, session, business);
      await repo.ingest(org, first);
      await grantRuntimePrivileges(r);
      appPool = new pg.Pool({ connectionString: `${base.replace('kablet_test_manager', 'kablet_dev').replace(encodeURIComponent(manager.TEST_MANAGER_PASSWORD), encodeURIComponent(appPassword))}/${r.name}`, max: 1 });
      const client = await appPool.connect();
      try {
        await client.query('begin');
        const missingContext = await client.query('select id from visitor_observations where id = $1 and visitor_identity_id = $2', [first.id, visitor]);
        expect(missingContext.rowCount).toBe(0);
        await client.query('rollback');
        await client.query('begin');
        await client.query('select set_config($1,$2,true)', ['kablet.organization_id', org]);
        await client.query('select set_config($1,$2,true)', ['kablet.business_id', business]);
        const identity = await client.query('select current_user, rolsuper, rolbypassrls from pg_roles where rolname = current_user');
        expect(identity.rows[0]).toMatchObject({ current_user: 'kablet_dev', rolsuper: false, rolbypassrls: false });
        const visible = await client.query('select id from visitor_observations where id = $1 and visitor_identity_id = $2', [first.id, visitor]);
        expect(visible.rowCount).toBe(1);
        await expect(client.query('update visitor_observations set source_reference=$1 where id=$2', ['changed', first.id])).rejects.toMatchObject({ code: 'P0001' });
        await client.query('rollback');
        await client.query('begin');
        await client.query('select set_config($1,$2,true)', ['kablet.organization_id', org]);
        await client.query('select set_config($1,$2,true)', ['kablet.business_id', business]);
        await expect(client.query('delete from visitor_observations where id=$1', [first.id])).rejects.toMatchObject({ code: 'P0001' });
        await client.query('rollback');
        await client.query('begin');
        await client.query('select set_config($1,$2,true)', ['kablet.organization_id', org]);
        await client.query('select set_config($1,$2,true)', ['kablet.business_id', business]);
        const unchanged = await client.query('select source_reference from visitor_observations where id=$1', [first.id]);
        expect(unchanged.rows).toHaveLength(1);
        expect(unchanged.rows[0].source_reference).toBe('integration-test');
        await client.query('rollback');
      } finally { client.release(); }
    } finally {
      if (appPool) await appPool.end();
      await cleanup(r);
    }
  }, 90000);

  it('rejects same-organization cross-business offering selection', async () => {
    const r = await disposable();
    try {
      const businessA = await fixture(r.db);
      const businessB = randomUUID();
      await r.db.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`); await tx.execute(sql`insert into businesses(id,organization_id,name) values (${businessB}::uuid,${org}::uuid,'Business B')`); });
      const bOffering = await createPublishedOffering(r.db, businessB);
      const aOffering = await createPublishedOffering(r.db, businessA);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, businessA, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, businessA, visitor);
      const cross = { ...observation(visitor, session, businessA, randomUUID(), 'offering.selected'), value: { type: 'offering', offeringId: bOffering.offeringId, publishedRevisionId: bOffering.revisionId } };
      await expect(repo.ingest(org, cross)).rejects.toThrow('not currently published for this business');
      const valid = { ...observation(visitor, session, businessA, randomUUID(), 'offering.selected'), value: { type: 'offering', offeringId: aOffering.offeringId, publishedRevisionId: aOffering.revisionId } };
      await expect(repo.ingest(org, valid)).resolves.toMatchObject({ idempotent: false });
    } finally { await cleanup(r); }
  }, 90000);

  it('enforces composite correction lineage and deterministic invalidation', async () => {
    const r = await disposable();
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitorA = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const visitorB = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const sessionA = await repo.createSession(org, business, visitorA);
      const sessionB = await repo.createSession(org, business, visitorB);
      const source = observation(visitorB, sessionB, business);
      await repo.ingest(org, source);
      const invalidCross = { ...observation(visitorA, sessionA, business, randomUUID(), 'intent.expressed'), correctionOfObservationId: source.id };
      await expect(repo.ingest(org, invalidCross)).rejects.toThrow('correction target');
      await expect(r.db.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`); await tx.execute(sql`select set_config('kablet.business_id',${business},true)`); await tx.execute(sql`insert into visitor_observations(id,organization_id,business_id,visitor_identity_id,session_id,kind,value,idempotency_key,observed_at,source_type,source_reference,correction_of_observation_id) values (${randomUUID()}::uuid,${org}::uuid,${business}::uuid,${visitorA}::uuid,${sessionA}::uuid,'intent.expressed','{"type":"intent","value":"explore_offerings"}'::jsonb,${randomUUID()},now(),'visitor','test',${source.id}::uuid)`); })).rejects.toMatchObject({ cause: { code: '23503', constraint: 'visitor_observations_correction_scope_fkey' } });
      const accepted = observation(visitorA, sessionA, business);
      await repo.ingest(org, accepted);
      const invalidation = { ...observation(visitorA, sessionA, business, randomUUID(), 'observation.invalidated'), value: { type: 'none' }, correctionOfObservationId: accepted.id };
      await repo.ingest(org, invalidation);
      const state = await r.db.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`); await tx.execute(sql`select set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select state from visitor_state_revisions where visitor_identity_id=${visitorA}::uuid order by version desc limit 1`); });
      expect(state.rows[0].state.intent).toBeNull();
      const replay = await repo.ingest(org, invalidation);
      expect(replay.idempotent).toBe(true);
    } finally { await cleanup(r); }
  }, 90000);

  it('serializes two simultaneous expected-version transitions', async () => {
    const r = await disposable();
    let secondDb: ReturnType<typeof createDb> | undefined;
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, business, visitor);
      if (!bootstrapUser || !bootstrapPassword) throw new Error('trusted bootstrap credentials are required');
      const bootstrapBase = `postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
      secondDb = createDb(`${bootstrapBase}/${r.name}`);
      const secondRepo = createVisitorStateRepository(secondDb.db);
      const a = { ...observation(visitor, session, business, randomUUID()), expectedVersion: 0 };
      const b = { ...observation(visitor, session, business, randomUUID()), expectedVersion: 0 };
      const results = await Promise.allSettled([repo.ingest(org, a), secondRepo.ingest(org, b)]);
      expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
      expect(rejected.filter(x => errorChainIncludes(x.reason, 'stale-version conflict'))).toHaveLength(1);
      const acceptedIndex = results.findIndex(x => x.status === 'fulfilled');
      if (acceptedIndex >= 0) {
        const replay = await repo.ingest(org, acceptedIndex === 0 ? a : b);
        expect(replay.idempotent).toBe(true);
      }
    } finally { if (secondDb) await secondDb.pool.end(); await cleanup(r); }
  }, 90000);

  it('recomputes canonical evidence after older and current invalidation', async () => {
    const r = await disposable();
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, business, visitor);
      const older = observation(visitor, session, business, randomUUID());
      const newer = { ...observation(visitor, session, business, randomUUID()), value: { type: 'intent', value: 'request_information' } };
      await repo.ingest(org, older);
      await repo.ingest(org, newer);
      const invalidateOlder = { ...observation(visitor, session, business, randomUUID(), 'observation.invalidated'), value: { type: 'none' }, correctionOfObservationId: older.id };
      await repo.ingest(org, invalidateOlder);
      let state = await r.db.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`); await tx.execute(sql`select set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select state from visitor_state_revisions where visitor_identity_id=${visitor}::uuid order by version desc limit 1`); });
      expect(state.rows[0].state.intent.value).toBe('request_information');
      const invalidateNewer = { ...observation(visitor, session, business, randomUUID(), 'observation.invalidated'), value: { type: 'none' }, correctionOfObservationId: newer.id };
      await repo.ingest(org, invalidateNewer);
      state = await r.db.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`); await tx.execute(sql`select set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select state from visitor_state_revisions where visitor_identity_id=${visitor}::uuid order by version desc limit 1`); });
      expect(state.rows[0].state.intent).toBeNull();
      await expect(repo.ingest(org, invalidateNewer)).resolves.toMatchObject({ idempotent: true });
    } finally { await cleanup(r); }
  }, 90000);

  it('rejects unauthorized privacy-function invocation', async () => {
    if (!unauthorizedUser || !unauthorizedPassword) throw new Error('TEST_UNAUTHORIZED_USER and TEST_UNAUTHORIZED_PASSWORD are required for unauthorized privacy-function integration coverage');
    const r = await disposable();
    let unauthorized: pg.Pool | undefined;
    let control: pg.Pool | undefined;
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, business, visitor);
      await repo.ingest(org, observation(visitor, session, business));

      control = new pg.Pool({ connectionString: `${base}/postgres`, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000, statement_timeout: 10000 });
      await control.query(`grant connect on database "${r.name}" to "${unauthorizedUser}"`);
      await r.db.pool.query(`grant usage on schema public to "${unauthorizedUser}"`);
      const privilege = await r.db.pool.query(`select p.oid, n.nspname as schema_name, p.proname, has_function_privilege($1, p.oid, 'EXECUTE') as can_execute from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'kablet_visitor_privacy_delete' and p.pronargs = 2 and p.proargtypes[0] = 'uuid'::regtype::oid and p.proargtypes[1] = 'uuid'::regtype::oid`, [unauthorizedUser]);
      expect(privilege.rows).toHaveLength(1);
      expect(privilege.rows[0]).toMatchObject({ schema_name: 'public', proname: 'kablet_visitor_privacy_delete', can_execute: false });
      const roleInfo = await control.query(`select rolname, rolsuper, rolbypassrls, pg_has_role($1, 'kablet_dev', 'member') as is_authorized_member from pg_roles where rolname = $1`, [unauthorizedUser]);
      expect(roleInfo.rows[0]).toMatchObject({ rolname: unauthorizedUser, rolsuper: false, rolbypassrls: false, is_authorized_member: false });

      unauthorized = new pg.Pool({ connectionString: `postgresql://${encodeURIComponent(unauthorizedUser)}:${encodeURIComponent(unauthorizedPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${r.name}`, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000, statement_timeout: 10000 });
      const identity = await unauthorized.query('select current_user, rolsuper, rolbypassrls from pg_roles where rolname = current_user');
      expect(identity.rows[0]).toMatchObject({ current_user: unauthorizedUser, rolsuper: false, rolbypassrls: false });
      await expect(unauthorized.query('select public.kablet_visitor_privacy_delete($1::uuid,$2::uuid)', [org, visitor])).rejects.toMatchObject({ code: '42501' });

      const lineage = await r.db.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`select set_config('kablet.business_id',${business},true)`);
        return tx.execute(sql`select (select count(*) from visitor_identities where id=${visitor}::uuid) as identities,(select count(*) from visitor_observations where visitor_identity_id=${visitor}::uuid) as observations,(select count(*) from visitor_state_revisions where visitor_identity_id=${visitor}::uuid) as revisions`);
      });
      expect(Number(lineage.rows[0].identities)).toBe(1);
      expect(Number(lineage.rows[0].observations)).toBe(1);
      expect(Number(lineage.rows[0].revisions)).toBe(2);
    } finally {
      if (unauthorized) await unauthorized.end();
      if (control) await control.end();
      await cleanup(r);
    }
  }, 90000);

  it('rejects forged privacy authorization and preserves atomic deletion boundaries', async () => {
    if (!appPassword) throw new Error('TEST_APP_PASSWORD is required for privacy authorization coverage');
    const r = await disposable();
    let appPool: pg.Pool | undefined;
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitorA = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const visitorB = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const sessionA = await repo.createSession(org, business, visitorA);
      const sessionB = await repo.createSession(org, business, visitorB);
      const evidenceA = observation(visitorA, sessionA, business);
      const evidenceB = observation(visitorB, sessionB, business);
      await repo.ingest(org, evidenceA);
      await repo.ingest(org, evidenceB);
      await grantRuntimePrivileges(r);
      appPool = new pg.Pool({ connectionString: `${base.replace('kablet_test_manager', 'kablet_dev').replace(encodeURIComponent(manager.TEST_MANAGER_PASSWORD), encodeURIComponent(appPassword))}/${r.name}`, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000, statement_timeout: 10000 });
      const app = await appPool.connect();
      try {
        await app.query('begin');
        await app.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', business]);
        await expect(app.query('insert into kablet_privacy_operations(transaction_id,organization_id,visitor_identity_id) values (txid_current(),$1,$2)', [org, visitorA])).rejects.toMatchObject({ code: '42501' });
        await app.query('rollback');
        await app.query('begin');
        await app.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', business]);
        await expect(app.query('update kablet_privacy_operations set organization_id=$1', [org])).rejects.toMatchObject({ code: '42501' });
        await app.query('rollback');
        await app.query('begin');
        await app.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', business]);
        await expect(app.query('delete from kablet_privacy_operations')).rejects.toMatchObject({ code: '42501' });
        await app.query('rollback');
      } finally { app.release(); }

      await expect(r.db.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`select set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`update visitor_observations set source_reference='forged' where id=${evidenceA.id}::uuid`);
      })).rejects.toMatchObject({ cause: { code: 'P0001' } });
      await expect(r.db.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`select set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`delete from visitor_observations where id=${evidenceA.id}::uuid`);
      })).rejects.toMatchObject({ cause: { code: 'P0001' } });

      const runtimeUrl = `${base.replace('kablet_test_manager', 'kablet_dev').replace(encodeURIComponent(manager.TEST_MANAGER_PASSWORD), encodeURIComponent(appPassword))}/${r.name}`;
      const runtimeDb = createDb(runtimeUrl);
      try {
        await expect(runtimeDb.db.transaction(async tx => {
          await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
          await tx.execute(sql`select set_config('kablet.business_id',${business},true)`);
          return tx.execute(sql`select public.kablet_visitor_privacy_delete(${otherOrg}::uuid,${visitorA}::uuid)`);
        })).rejects.toMatchObject({ cause: { code: 'P0001' } });
      } finally { await runtimeDb.pool.end(); }
      const preserved = await r.db.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`select set_config('kablet.business_id',${business},true)`);
        return tx.execute(sql`select count(*)::int as count from visitor_identities where id in (${visitorA}::uuid,${visitorB}::uuid)`);
      });
      expect(Number(preserved.rows[0].count)).toBe(2);
      const authorizedRuntimeDb = createDb(runtimeUrl);
      try { await expect(createVisitorStateRepository(authorizedRuntimeDb.db).anonymize(org, visitorA, business)).resolves.toBe(true); } finally { await authorizedRuntimeDb.pool.end(); }
      const remaining = await r.db.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`select set_config('kablet.business_id',${business},true)`);
        return tx.execute(sql`select count(*)::int as count from visitor_identities where id=${visitorB}::uuid`);
      });
      expect(Number(remaining.rows[0].count)).toBe(1);
    } finally {
      if (appPool) await appPool.end();
      await cleanup(r);
    }
  }, 90000);

  it('enforces restricted Business-scoped RLS across all Visitor State tables', async () => {
    if (!appPassword) throw new Error('TEST_APP_PASSWORD is required for Business-scoped RLS coverage');
    const r = await disposable();
    let appPool: pg.Pool | undefined;
    try {
      const businessA = await fixture(r.db);
      const businessB = randomUUID();
      await r.db.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${businessB}::uuid,${org}::uuid,'Business B')`);
      });
      const repo = createVisitorStateRepository(r.db.db);
      const visitorA = await repo.createVisitor(org, businessA, new Date(Date.now() + 86400000));
      const visitorB = await repo.createVisitor(org, businessB, new Date(Date.now() + 86400000));
      const sessionA = await repo.createSession(org, businessA, visitorA);
      const sessionB = await repo.createSession(org, businessB, visitorB);
      const evidenceA = observation(visitorA, sessionA, businessA);
      const evidenceB = observation(visitorB, sessionB, businessB);
      await repo.ingest(org, evidenceA);
      await repo.ingest(org, evidenceB);
      await grantRuntimePrivileges(r);
      appPool = new pg.Pool({ connectionString: `${base.replace('kablet_test_manager', 'kablet_dev').replace(encodeURIComponent(manager.TEST_MANAGER_PASSWORD), encodeURIComponent(appPassword))}/${r.name}`, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000, statement_timeout: 10000 });
      const client = await appPool.connect();
      try {
        const tables = ['visitor_identities', 'visitor_sessions', 'visitor_observations', 'visitor_states', 'visitor_state_revisions'];
        await client.query('begin');
        await client.query('select set_config($1,$2,true)', ['kablet.organization_id', org]);
        for (const table of tables) expect((await client.query(`select count(*)::int as count from ${table}`)).rows[0].count).toBe(0);
        await client.query('rollback');

        await client.query('begin');
        await client.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', businessA]);
        for (const table of tables) {
          const own = await client.query(`select count(*)::int as count from ${table} where business_id=$1`, [businessA]);
          const other = await client.query(`select count(*)::int as count from ${table} where business_id=$1`, [businessB]);
          expect(Number(own.rows[0].count)).toBe(table === 'visitor_state_revisions' ? 2 : 1);
          expect(Number(other.rows[0].count)).toBe(0);
        }
        await expect(client.query('update visitor_observations set source_reference=$1 where id=$2', ['cross-business', evidenceB.id])).resolves.toMatchObject({ rowCount: 0 });
        await expect(client.query('delete from visitor_state_revisions where visitor_identity_id=$1', [visitorB])).resolves.toMatchObject({ rowCount: 0 });
        await expect(client.query('insert into visitor_sessions(id,organization_id,business_id,visitor_identity_id) values ($1,$2,$3,$4)', [randomUUID(), org, businessB, visitorB])).rejects.toMatchObject({ code: '42501' });
        await client.query('rollback');

        await client.query('begin');
        await client.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', otherOrg, 'kablet.business_id', businessA]);
        expect(Number((await client.query('select count(*)::int as count from visitor_identities')).rows[0].count)).toBe(0);
        await expect(client.query('update visitor_identities set status=$1 where id=$2', ['ended', visitorA])).resolves.toMatchObject({ rowCount: 0 });
        await client.query('rollback');
      } finally { client.release(); }
    } finally {
      if (appPool) await appPool.end();
      await cleanup(r);
    }
  }, 90000);

  it('uses UUID tie-breaking for equal-timestamp evidence and deterministic invalidation', async () => {
    const r = await disposable();
    try {
      const business = await fixture(r.db);
      const repo = createVisitorStateRepository(r.db.db);
      const visitor = await repo.createVisitor(org, business, new Date(Date.now() + 86400000));
      const session = await repo.createSession(org, business, visitor);
      const observedAt = new Date('2026-01-01T00:00:00.000Z');
      const lowerId = '00000000-0000-4000-8000-000000000001';
      const higherId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      const lower = { ...observation(visitor, session, business, randomUUID()), id: lowerId, observedAt, value: { type: 'intent', value: 'explore_offerings' } };
      const higher = { ...observation(visitor, session, business, randomUUID()), id: higherId, observedAt, value: { type: 'intent', value: 'request_information' } };
      await repo.ingest(org, lower);
      await repo.ingest(org, higher);
      let state = await r.db.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`); await tx.execute(sql`select set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select state from visitor_state_revisions where visitor_identity_id=${visitor}::uuid order by version desc limit 1`); });
      expect(state.rows[0].state.intent.value).toBe('request_information');
      const reversed = reduceVisitorStateFromEvidence([higher, lower]);
      expect(reversed.intent?.value).toBe('request_information');
      expect(reduceVisitorStateFromEvidence([lower, higher])).toEqual(reversed);

      const invalidateSelected = { ...observation(visitor, session, business, randomUUID(), 'observation.invalidated'), value: { type: 'none' }, correctionOfObservationId: higherId };
      await repo.ingest(org, invalidateSelected);
      state = await r.db.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`); await tx.execute(sql`select set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select state from visitor_state_revisions where visitor_identity_id=${visitor}::uuid order by version desc limit 1`); });
      expect(state.rows[0].state.intent.value).toBe('explore_offerings');
      const invalidateRemaining = { ...observation(visitor, session, business, randomUUID(), 'observation.invalidated'), value: { type: 'none' }, correctionOfObservationId: lowerId };
      await repo.ingest(org, invalidateRemaining);
      state = await r.db.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true)`); await tx.execute(sql`select set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select state from visitor_state_revisions where visitor_identity_id=${visitor}::uuid order by version desc limit 1`); });
      expect(state.rows[0].state.intent).toBeNull();
      await expect(repo.ingest(org, invalidateRemaining)).resolves.toMatchObject({ idempotent: true });
    } finally { await cleanup(r); }
  }, 90000);
});
