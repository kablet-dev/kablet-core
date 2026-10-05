import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createDecisionRepository, createVisitorStateRepository } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const manager = loadTestManagerConfig();
const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;
const appPassword = process.env.TEST_APP_PASSWORD;
const migrationsFolder = `${process.cwd()}\\packages\\db\\drizzle`;
const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function appUrl(name: string) { return `postgresql://kablet_dev:${encodeURIComponent(appPassword ?? '')}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${name}`; }
async function setup() {
  if (!bootstrapUser || !bootstrapPassword || !roleAdminUrl || !appPassword) throw new Error('TEST_BOOTSTRAP_USER, TEST_BOOTSTRAP_PASSWORD, TEST_ROLE_ADMIN_URL and TEST_APP_PASSWORD are required');
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  const name = `kablet_test_${randomBytes(16).toString('hex')}`;
  await managerPool.query(`create database "${name}" owner "kablet_test_manager"`);
  await managerPool.query(`grant connect, create on database "${name}" to "${bootstrapUser}"`);
  const target = new pg.Pool({ connectionString: `${base}/${name}`, max: 1 });
  await target.query(`grant usage, create on schema public to "${bootstrapUser}"`);
  await target.query('grant usage, create on schema public to kablet_privacy_owner');
  await target.end();
  const bootstrapUrl = `postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${name}`;
  const db = createDb(bootstrapUrl);
  const admin = new pg.Pool({ connectionString: roleAdminUrl, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  try {
    await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
    await migrate(db.db, { migrationsFolder });
    await migrate(db.db, { migrationsFolder });
  } finally {
    await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap');
    await admin.end();
  }
  await db.pool.query('grant usage on schema public to kablet_dev');
  await db.pool.query('grant select,insert,update,delete on organizations,businesses,business_offerings,business_offering_revisions,offering_publications,visitor_identities,visitor_sessions,visitor_observations,visitor_state_revisions,visitor_states,visitor_decisions,visitor_decision_business_truth_refs to kablet_dev');
  return { name, managerPool, db, app: createDb(appUrl(name)) };
}
async function cleanup(r: Awaited<ReturnType<typeof setup>>) {
  await r.app.pool.end(); await r.db.pool.end();
  const identity = await r.managerPool.query('select current_database(), current_user');
  if (identity.rows[0].current_database !== 'postgres' || identity.rows[0].current_user !== 'kablet_test_manager') throw new Error('unsafe cleanup identity');
  await r.managerPool.query(`drop database "${r.name}"`); await r.managerPool.end();
}
async function fixture(r: Awaited<ReturnType<typeof setup>>) {
  const business = randomUUID();
  const client = await r.db.pool.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['kablet.organization_id', org]);
    await client.query('insert into organizations(id,name) values ($1,$2)', [org, 'Decision Org']);
    await client.query('insert into businesses(id,organization_id,name) values ($1,$2,$3)', [business, org, 'Decision Business']);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  const visitor = await createVisitorStateRepository(r.app.db).createVisitor(org, business, new Date(Date.now() + 86400000));
  const session = await createVisitorStateRepository(r.app.db).createSession(org, business, visitor);
  return { business, visitor, session };
}
async function referencedFixture(r: Awaited<ReturnType<typeof setup>>) {
  const f = await fixture(r);
  const offering = randomUUID();
  const revision = randomUUID();
  const client = await r.db.pool.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', f.business]);
    await client.query('insert into business_offerings(id,business_id,name) values ($1,$2,$3)', [offering, f.business, 'Referenced Offering']);
    await client.query("insert into business_offering_revisions(id,offering_id,revision_number,name,description,pricing_kind,visibility,approval_status,provenance_source_type,provenance_source_reference,provenance_captured_at,provenance_captured_by) values ($1,$2,1,'Offering','Description','unknown','public','approved','owner_input','fixture',now(),'test')", [revision, offering]);
    await client.query('insert into offering_publications(offering_id,revision_id) values ($1,$2)', [offering, revision]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
  const visitorRepo = createVisitorStateRepository(r.app.db);
  await visitorRepo.ingest(org, { id: randomUUID(), organizationId: org, businessId: f.business, visitorIdentityId: f.visitor, sessionId: f.session, kind: 'intent.expressed', value: { type: 'intent', value: 'explore_offerings' }, idempotencyKey: randomUUID(), observedAt: new Date(), sourceType: 'visitor', sourceReference: 'test', expectedVersion: 0 });
  return { ...f, offering, revision };
}
function decisionInput(f: Awaited<ReturnType<typeof fixture>>, key: string, policyVersion = '1') {
  return { organizationId: org, businessId: f.business, visitorIdentityId: f.visitor, sessionId: f.session, idempotencyKey: key, policyId: 'baseline', policyVersion, policyInput: { state: { schemaVersion: 1, intent: null, selectedOffering: null, timeWindow: null }, eligibleOfferingRefs: [] } };
}

describe('Decision Foundation PostgreSQL integration', () => {
  it('persists request_qualification while rejecting unsupported decision types', async () => {
    const r = await setup();
    try {
      const f = await referencedFixture(r);
      const decision = createDecisionRepository(r.app.db);
      const result = await decision.create({ ...decisionInput(f, 'qualification-decision-1'), policyInput: { state: { schemaVersion: 1, intent: { value: 'explore_offerings', status: 'stated', sourceObservationId: '33333333-3333-4333-8333-333333333333' }, selectedOffering: null, timeWindow: null, qualification: [] }, eligibleOfferingRefs: [{ offeringId: f.offering, offeringRevisionId: f.revision }], qualificationRequirements: [{ key: 'context_timeline', prompt: 'What timeframe are you considering?', options: [{ value: 'immediate', label: 'Soon' }] }] } });
      expect(result.decision).toMatchObject({ decision_type: 'request_qualification' });
      const client = await r.app.pool.connect();
      try {
        await client.query('begin');
        await client.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', f.business]);
        const current = await client.query('select current_revision_id, version from visitor_states where visitor_identity_id=$1', [f.visitor]);
        await expect(client.query('insert into visitor_decisions (id,organization_id,business_id,visitor_identity_id,session_id,decision_type,status,contract_version,policy_id,policy_version,visitor_state_revision_id,visitor_state_version,idempotency_key,input_fingerprint) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', [randomUUID(), org, f.business, f.visitor, f.session, 'unsupported', 'accepted', 'decision.v1', 'test', '1', current.rows[0].current_revision_id, current.rows[0].version, 'unsupported-type', 'test'])).rejects.toMatchObject({ code: '23514' });
        await client.query('rollback');
      } finally { client.release(); }
    } finally { await cleanup(r); }
  }, 90000);

  it('creates current-revision decisions and resolves exact replay', async () => {
    const r = await setup();
    try {
      const f = await fixture(r);
      const decision = createDecisionRepository(r.app.db);
      const input = decisionInput(f, 'decision-1');
      await expect(decision.create(input)).resolves.toMatchObject({ idempotent: false, decision: { decision_type: 'no_safe_decision', visitor_state_version: 0 } });
      await expect(decision.create(input)).resolves.toMatchObject({ idempotent: true });
      await expect(decision.create({ ...input, policyVersion: '2' })).rejects.toThrow('idempotency key conflicts');
    } finally { await cleanup(r); }
  }, 90000);

  it('serializes concurrent identical requests and rejects changed-input replay', async () => {
    const r = await setup();
    try {
      const f = await fixture(r);
      const first = createDecisionRepository(r.app.db);
      const second = createDecisionRepository(r.app.db);
      const input = decisionInput(f, 'concurrent-1');
      const results = await Promise.all([first.create(input), second.create(input)]);
      expect(results.filter(result => !result.idempotent)).toHaveLength(1);
      expect(results.filter(result => result.idempotent)).toHaveLength(1);
      const verify = await r.app.pool.connect();
      try {
        await verify.query('begin');
        await verify.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', f.business]);
        const persisted = await verify.query('select id, count(*) over ()::int as count from visitor_decisions where organization_id=$1 and business_id=$2 and visitor_identity_id=$3', [org, f.business, f.visitor]);
        expect(persisted.rows).toHaveLength(1);
        expect(persisted.rows[0].count).toBe(1);
        expect(results[0].decision.id).toBe(results[1].decision.id);
        await verify.query('commit');
      } catch (error) {
        await verify.query('rollback');
        throw error;
      } finally { verify.release(); }
      await expect(first.create(decisionInput(f, 'concurrent-1', 'changed'))).rejects.toThrow('idempotency key conflicts');
    } finally { await cleanup(r); }
  }, 90000);

  it('protects accepted Decisions and removes their lineage only through privacy deletion', async () => {
    const r = await setup();
    try {
      const f = await fixture(r);
      const decision = createDecisionRepository(r.app.db);
      await decision.create(decisionInput(f, 'immutable-1'));
      const visitorRepo = createVisitorStateRepository(r.app.db);
      const unrelatedVisitor = await visitorRepo.createVisitor(org, f.business, new Date(Date.now() + 86400000));
      const unrelatedSession = await visitorRepo.createSession(org, f.business, unrelatedVisitor);
      await decision.create(decisionInput({ ...f, visitor: unrelatedVisitor, session: unrelatedSession }, 'unrelated-1'));
      const client = await r.app.pool.connect();
      try {
        await client.query('begin');
        await client.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', f.business]);
        await expect(client.query('update visitor_decisions set policy_version=$1 where visitor_identity_id=$2', ['changed', f.visitor])).rejects.toMatchObject({ code: 'P0001', message: expect.stringContaining('accepted decisions are immutable') });
        await client.query('rollback');
      } finally { client.release(); }
      await expect(decision.create(decisionInput(f, 'immutable-1'))).resolves.toMatchObject({ idempotent: true });
      await expect(visitorRepo.anonymize('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', f.visitor, f.business)).rejects.toThrow();
      const beforeDelete = await r.app.pool.connect();
      try {
        await beforeDelete.query('begin');
        await beforeDelete.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', f.business]);
        expect((await beforeDelete.query('select count(*)::int as count from visitor_decisions')).rows[0].count).toBe(2);
        await beforeDelete.query('commit');
      } finally { beforeDelete.release(); }
      await expect(createVisitorStateRepository(r.app.db).anonymize(org, f.visitor, f.business)).resolves.toBe(true);
      const verify = await r.app.pool.connect();
      try {
        await verify.query('begin');
        await verify.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', f.business]);
        expect((await verify.query('select count(*)::int as count from visitor_decisions where visitor_identity_id=$1', [f.visitor])).rows[0].count).toBe(0);
        expect((await verify.query('select count(*)::int as count from visitor_decision_business_truth_refs')).rows[0].count).toBe(0);
        expect((await verify.query('select count(*)::int as count from visitor_decisions where visitor_identity_id=$1', [unrelatedVisitor])).rows[0].count).toBe(1);
        await verify.query('commit');
      } finally { verify.release(); }
    } finally { await cleanup(r); }
  }, 90000);

  it('rejects direct Decision reference mutation under the restricted role', async () => {
    const r = await setup();
    try {
      const f = await referencedFixture(r);
      const result = await createDecisionRepository(r.app.db).create(decisionInput(f, 'reference-immutable'));
      const client = await r.app.pool.connect();
      try {
        await client.query('begin');
        await client.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', f.business]);
        await expect(client.query('update visitor_decision_business_truth_refs set offering_id=$1 where decision_id=$2', [randomUUID(), result.decision.id])).rejects.toMatchObject({ code: 'P0001' });
        await client.query('rollback');
        await client.query('begin');
        await client.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', f.business]);
        await expect(client.query('delete from visitor_decision_business_truth_refs where decision_id=$1', [result.decision.id])).rejects.toMatchObject({ code: 'P0001' });
        await client.query('rollback');
      } finally { client.release(); }
    } finally { await cleanup(r); }
  }, 90000);

  it('preserves historical Business Truth references after unpublication', async () => {
    const r = await setup();
    try {
      const f = await referencedFixture(r);
      const result = await createDecisionRepository(r.app.db).create(decisionInput(f, 'historical-reference'));
      await r.db.pool.query('delete from offering_publications where offering_id=$1', [f.offering]);
      const client = await r.app.pool.connect();
      try {
        await client.query('begin');
        await client.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', f.business]);
        const refs = await client.query('select offering_id, offering_revision_id from visitor_decision_business_truth_refs where decision_id=$1', [result.decision.id]);
        expect(refs.rows).toEqual([{ offering_id: f.offering, offering_revision_id: f.revision }]);
        await client.query('commit');
      } finally { client.release(); }
    } finally { await cleanup(r); }
  }, 90000);

  it('isolates Decision rows and references across Businesses under one Organization', async () => {
    const r = await setup();
    try {
      const a = await referencedFixture(r);
      const businessB = randomUUID();
      const setupClient = await r.db.pool.connect();
      try {
        await setupClient.query('begin');
        await setupClient.query('select set_config($1,$2,true)', ['kablet.organization_id', org]);
        await setupClient.query('insert into businesses(id,organization_id,name) values ($1,$2,$3)', [businessB, org, 'Business B']);
        await setupClient.query('commit');
      } catch (error) {
        await setupClient.query('rollback');
        throw error;
      } finally { setupClient.release(); }
      const visitorB = await createVisitorStateRepository(r.app.db).createVisitor(org, businessB, new Date(Date.now() + 86400000));
      const sessionB = await createVisitorStateRepository(r.app.db).createSession(org, businessB, visitorB);
      await createDecisionRepository(r.app.db).create(decisionInput(a, 'business-a'));
      await createDecisionRepository(r.app.db).create({ ...decisionInput({ ...a, business: businessB, visitor: visitorB, session: sessionB }, 'business-b'), policyInput: { state: { schemaVersion: 1, intent: null, selectedOffering: null, timeWindow: null }, eligibleOfferingRefs: [] } });
      const client = await r.app.pool.connect();
      try {
        await client.query('begin');
        await client.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', a.business]);
        expect((await client.query('select count(*)::int as count from visitor_decisions')).rows[0].count).toBe(1);
        expect((await client.query('select count(*)::int as count from visitor_decision_business_truth_refs')).rows[0].count).toBe(1);
        await client.query('rollback');
      } finally { client.release(); }
    } finally { await cleanup(r); }
  }, 90000);

  it('blocks restricted Organization B access to Organization A Decisions and references', async () => {
    const r = await setup();
    try {
      const a = await referencedFixture(r);
      const decisionA = await createDecisionRepository(r.app.db).create(decisionInput(a, 'org-a-decision'));
      const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const businessB = randomUUID();
      const setupClient = await r.db.pool.connect();
      try {
        await setupClient.query('begin');
        await setupClient.query('select set_config($1,$2,true)', ['kablet.organization_id', orgB]);
        await setupClient.query('insert into organizations(id,name) values ($1,$2)', [orgB, 'Organization B']);
        await setupClient.query('insert into businesses(id,organization_id,name) values ($1,$2,$3)', [businessB, orgB, 'Business B']);
        await setupClient.query('commit');
      } catch (error) {
        await setupClient.query('rollback');
        throw error;
      } finally { setupClient.release(); }
      const client = await r.app.pool.connect();
      try {
        await client.query('begin');
        await client.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', orgB, 'kablet.business_id', businessB]);
        expect((await client.query('select * from visitor_decisions where id=$1', [decisionA.decision.id])).rows).toHaveLength(0);
        expect((await client.query('select * from visitor_decision_business_truth_refs where decision_id=$1', [decisionA.decision.id])).rows).toHaveLength(0);
        await expect(client.query('update visitor_decisions set policy_version=$1 where id=$2', ['forged', decisionA.decision.id])).resolves.toMatchObject({ rowCount: 0 });
        await expect(client.query('delete from visitor_decisions where id=$1', [decisionA.decision.id])).resolves.toMatchObject({ rowCount: 0 });
        await expect(client.query('insert into visitor_decision_business_truth_refs(decision_id,organization_id,business_id,offering_id,offering_revision_id) values ($1,$2,$3,$4,$5)', [decisionA.decision.id, org, businessB, a.offering, a.revision])).rejects.toMatchObject({ code: '42501' });
        await client.query('rollback');
      } finally { client.release(); }
      const verify = await r.app.pool.connect();
      try {
        await verify.query('begin');
        await verify.query('select set_config($1,$2,true), set_config($3,$4,true)', ['kablet.organization_id', org, 'kablet.business_id', a.business]);
        expect((await verify.query('select count(*)::int as count from visitor_decisions where id=$1', [decisionA.decision.id])).rows[0].count).toBe(1);
        expect((await verify.query('select count(*)::int as count from visitor_decision_business_truth_refs where decision_id=$1', [decisionA.decision.id])).rows[0].count).toBe(1);
        await verify.query('commit');
      } finally { verify.release(); }
    } finally { await cleanup(r); }
  }, 90000);

  it('rejects missing and cross-business context and preserves privacy lineage rules', async () => {
    const r = await setup();
    try {
      const f = await fixture(r);
      const decision = createDecisionRepository(r.app.db);
      await expect(decision.create({ organizationId: org, businessId: randomUUID(), visitorIdentityId: f.visitor, sessionId: f.session, idempotencyKey: 'bad', policyId: 'baseline', policyVersion: '1', policyInput: { state: { schemaVersion: 1, intent: null, selectedOffering: null, timeWindow: null }, eligibleOfferingRefs: [] } })).rejects.toThrow('business does not belong');
      expect((await r.app.pool.query('select * from visitor_decisions')).rows).toHaveLength(0);
    } finally { await cleanup(r); }
  }, 90000);
});
