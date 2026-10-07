import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import { loadTestManagerConfig } from '@kablet/config';
import { createDb, createMeasurementRepository } from '@kablet/db';
import { createInteractionService } from '../../apps/web/lib/interaction-service';
import { seedBaselineIntentPolicy } from './intent-policy-fixture';

const manager = loadTestManagerConfig();
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');
const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;
const appPassword = process.env.TEST_APP_PASSWORD;

function dbName() { return `kablet_test_${randomBytes(16).toString('hex')}`; }

async function provision() {
  if (!bootstrapUser || !bootstrapPassword || !roleAdminUrl || !appPassword) throw new Error('03B integration configuration is incomplete');
  const database = dbName();
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  let target: pg.Pool | undefined;
  let bootstrap: ReturnType<typeof createDb> | undefined;
  let admin: pg.Pool | undefined;
  try {
    await managerPool.query(`create database "${database}" owner "${manager.TEST_MANAGER_USER}"`);
    await managerPool.query(`grant connect, create on database "${database}" to "${bootstrapUser}"`);
    target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
    await target.query(`grant usage, create on schema public to "${bootstrapUser}"`);
    await target.query('grant usage, create on schema public to kablet_privacy_owner');
    await target.end(); target = undefined;
    bootstrap = createDb(`postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
    admin = new pg.Pool({ connectionString: roleAdminUrl, max: 1 });
    await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
    try { await migrate(bootstrap.db, { migrationsFolder }); } finally { await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); }
    await bootstrap.db.execute(sql`grant usage on schema public to kablet_dev`);
    await bootstrap.db.execute(sql`grant select,insert,update,delete on organizations,businesses,visitor_identities,visitor_sessions,visitor_observations,visitor_state_revisions,visitor_states,visitor_decisions,visitor_decision_business_truth_refs,interaction_sessions,business_offerings,business_offering_revisions,offering_publications,visitor_contact_records,visitor_consents to kablet_dev`);
    await admin.end(); admin = undefined; await bootstrap.pool.end(); bootstrap = undefined;
    return { database, managerPool, runtime: createDb(`postgresql://kablet_dev:${encodeURIComponent(appPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`) };
  } catch (error) {
    if (target) await target.end().catch(() => undefined);
    if (admin) await admin.end().catch(() => undefined);
    if (bootstrap) await bootstrap.pool.end().catch(() => undefined);
    await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
    await managerPool.end().catch(() => undefined);
    throw error;
  }
}

async function dispose(resource: Awaited<ReturnType<typeof provision>>) {
  await resource.runtime.pool.end();
  await resource.managerPool.query(`drop database "${resource.database}"`);
  await resource.managerPool.end();
}

async function tenant(resource: Awaited<ReturnType<typeof provision>>) {
  const organizationId = randomUUID(); const businessId = randomUUID();
  await resource.runtime.db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id',${organizationId},true),set_config('kablet.business_id',${businessId},true)`);
    await tx.execute(sql`insert into organizations (id,name) values (${organizationId}::uuid,'Measurement Org')`);
    await tx.execute(sql`insert into businesses (id,organization_id,name) values (${businessId}::uuid,${organizationId}::uuid,'Measurement Business')`);
  });
  await seedBaselineIntentPolicy(resource.runtime.db, organizationId, businessId);
  return { organizationId, businessId };
}

async function readExposure(resource: Awaited<ReturnType<typeof provision>>, ids: { organizationId: string; businessId: string; interactionId: string }) {
  return resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); return tx.execute(sql`select * from experience_exposures where interaction_session_id=${ids.interactionId}::uuid order by exposure_sequence`); });
}
async function getInteractionId(resource: Awaited<ReturnType<typeof provision>>, ids: { organizationId: string; businessId: string }, visitorId: string) {
  const result = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); return tx.execute(sql`select id from interaction_sessions where visitor_identity_id=${visitorId}::uuid`); });
  expect(result.rows).toHaveLength(1);
  return String(result.rows[0].id);
}

describe('03B measurement PostgreSQL integration', () => {
  it('persists the initial exposure with exact lineage and no initial interaction fact', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource);
      const service = createInteractionService({ db: resource.runtime.db, ...ids });
      const started = await service.start(new Date(Date.now() + 3600000));
      const exposures = await readExposure(resource, { ...ids, interactionId: await getInteractionId(resource, ids, started.visitorId) });
      expect(exposures.rows).toHaveLength(1);
      expect(exposures.rows[0]).toMatchObject({ organization_id: ids.organizationId, business_id: ids.businessId, visitor_identity_id: started.visitorId, visitor_session_id: started.sessionId, exposure_sequence: '1', exposure_kind: 'server_response' });
      const facts = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); return tx.execute(sql`select id from interaction_facts`); });
      expect(facts.rows).toHaveLength(0);
    } finally { await dispose(resource); }
  }, 90000);

  it('records a fact against the prior exposure and creates a later causal exposure', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource); const service = createInteractionService({ db: resource.runtime.db, ...ids });
      const started = await service.start(new Date(Date.now() + 3600000));
      const interactionId = await getInteractionId(resource, ids, started.visitorId);
      const before = await readExposure(resource, { ...ids, interactionId }); const exposureA = String(before.rows[0].id);
      await service.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'intent-1' });
      const after = await readExposure(resource, { ...ids, interactionId });
      const fact = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); return tx.execute(sql`select * from interaction_facts where interaction_kind='intent_expressed'`); });
      expect(after.rows).toHaveLength(2); expect(Number(after.rows[1].exposure_sequence)).toBeGreaterThan(Number(after.rows[0].exposure_sequence));
      expect(fact.rows[0]).toMatchObject({ exposure_id: exposureA, interaction_kind: 'intent_expressed' });
      expect(String(fact.rows[0].exposure_id)).not.toBe(String(after.rows[1].id));
    } finally { await dispose(resource); }
  }, 90000);

  it('deduplicates the semantic fact while allowing a regenerated exposure', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource); const service = createInteractionService({ db: resource.runtime.db, ...ids });
      const started = await service.start(new Date(Date.now() + 3600000));
      await service.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'same-intent' });
      await expect(service.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'same-intent' })).resolves.toBeDefined();
      const counts = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); return tx.execute(sql`select (select count(*) from interaction_facts where interaction_kind='intent_expressed')::int as facts, (select count(*) from experience_exposures)::int as exposures`); });
      expect(counts.rows[0].facts).toBe(1); expect(counts.rows[0].exposures).toBeGreaterThanOrEqual(2);
    } finally { await dispose(resource); }
  }, 90000);

  it('enforces tenant RLS, composite lineage, and immutable runtime permissions', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource); const service = createInteractionService({ db: resource.runtime.db, ...ids }); const started = await service.start(new Date(Date.now() + 3600000));
      const interactionId = await getInteractionId(resource, ids, started.visitorId);
      const exposureId = String((await readExposure(resource, { ...ids, interactionId })).rows[0].id);
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); await tx.execute(sql`update experience_exposures set exposure_kind='bad' where id=${exposureId}::uuid`); })).rejects.toThrow();
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); await tx.execute(sql`delete from experience_exposures where id=${exposureId}::uuid`); })).rejects.toMatchObject({ cause: { code: '42501' } });
      const hidden = await resource.runtime.db.execute(sql`select id from experience_exposures`); expect(hidden.rows).toHaveLength(0);
    } finally { await dispose(resource); }
  }, 90000);

  it('privacy deletion removes measurement lineage while preserving unrelated visitors', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource); const service = createInteractionService({ db: resource.runtime.db, ...ids }); const started = await service.start(new Date(Date.now() + 3600000));
      const interactionId = await getInteractionId(resource, ids, started.visitorId);
      await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); await tx.execute(sql`insert into visitor_identities (id,organization_id,business_id,retention_expires_at) values (${randomUUID()}::uuid,${ids.organizationId}::uuid,${ids.businessId}::uuid,now()+interval '1 day')`); await tx.execute(sql`select public.kablet_visitor_privacy_delete(${ids.organizationId}::uuid,${started.visitorId}::uuid)`); });
      const remaining = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); return tx.execute(sql`select count(*)::int as count from experience_exposures where interaction_session_id=${interactionId}::uuid`); }); expect(remaining.rows[0].count).toBe(0);
    } finally { await dispose(resource); }
  }, 90000);

  it('persists contact and consent facts without copying contact or command payloads', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource); const service = createInteractionService({ db: resource.runtime.db, ...ids }); const started = await service.start(new Date(Date.now() + 3600000));
      await service.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'contact-intent' });
      await service.submitQualification(started.handle, { questionKey: 'context_timeline', answer: 'immediate', idempotencyKey: 'contact-qualification' });
      await service.submitContact(started.handle, { name: 'Distinctive Name', email: 'distinctive@example.test', consent: true, idempotencyKey: 'contact-command' });
      const rows = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); return tx.execute(sql`select row_to_json(f) as fact from interaction_facts f`); });
      const serialized = JSON.stringify(rows.rows);
      expect(rows.rows.map(row => (row.fact as Record<string, unknown>).interaction_kind)).toEqual(expect.arrayContaining(['contact_submitted', 'consent_granted']));
      expect(serialized).not.toContain('distinctive@example.test'); expect(serialized).not.toContain('Distinctive Name'); expect(serialized).not.toContain('immediate'); expect(serialized).not.toContain('request_information');
    } finally { await dispose(resource); }
  }, 90000);

  it('converges concurrent duplicate facts and allocates ordered exposure sequences', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource); const service = createInteractionService({ db: resource.runtime.db, ...ids }); const started = await service.start(new Date(Date.now() + 3600000));
      const interactionId = await getInteractionId(resource, ids, started.visitorId);
      const initial = (await readExposure(resource, { ...ids, interactionId })).rows[0];
      const repo = createMeasurementRepository(resource.runtime.db);
      await Promise.all([1, 2].map(() => repo.insertFact({ contractVersion:'interaction-fact.v1', id:randomUUID(), organizationId:ids.organizationId, businessId:ids.businessId, visitorIdentityId:started.visitorId, visitorSessionId:started.sessionId, interactionSessionId:interactionId, decisionId:String(initial.decision_id), exposureId:String(initial.id), interactionKind:'intent_expressed', occurredAt:new Date(), idempotencyKey:'concurrent-fact', actionRequestId:null })));
      const facts = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); return tx.execute(sql`select count(*)::int as count from interaction_facts where idempotency_key='concurrent-fact'`); }); expect(facts.rows[0].count).toBe(1);
      await Promise.all([1, 2, 3].map(() => repo.insertExposure({ contractVersion:'experience-exposure.v1', id:randomUUID(), organizationId:ids.organizationId, businessId:ids.businessId, visitorIdentityId:started.visitorId, visitorSessionId:started.sessionId, interactionSessionId:interactionId, decisionId:String(initial.decision_id), exposureKind:'server_response', exposedAt:new Date('2026-01-01T00:00:00Z') })));
      const exposures = await readExposure(resource, { ...ids, interactionId }); const sequences = exposures.rows.map(row => Number(row.exposure_sequence));
      expect(new Set(sequences).size).toBe(sequences.length); expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    } finally { await dispose(resource); }
  }, 90000);

  it('enforces composite lineage and RLS for both measurement tables', async () => {
    const resource = await provision();
    try {
      const a = await tenant(resource); const b = await tenant(resource); const service = createInteractionService({ db: resource.runtime.db, ...a }); const started = await service.start(new Date(Date.now() + 3600000));
      const interactionId = await getInteractionId(resource, a, started.visitorId); const exposure = (await readExposure(resource, { ...a, interactionId })).rows[0];
      const read = (organizationId: string, businessId: string) => resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${organizationId},true),set_config('kablet.business_id',${businessId},true)`); return tx.execute(sql`select id from experience_exposures where id=${exposure.id}::uuid`); });
      expect((await read(a.organizationId, a.businessId)).rows).toHaveLength(1); expect((await read(b.organizationId, b.businessId)).rows).toHaveLength(0); expect((await resource.runtime.db.execute(sql`select id from experience_exposures`)).rows).toHaveLength(0);
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${a.organizationId},true),set_config('kablet.business_id',${a.businessId},true)`); await tx.execute(sql`insert into experience_exposures (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,decision_id,exposure_sequence,exposure_kind,exposed_at) values (${randomUUID()}::uuid,${b.organizationId}::uuid,${b.businessId}::uuid,${started.visitorId}::uuid,${started.sessionId}::uuid,${interactionId}::uuid,${exposure.decision_id}::uuid,99,'server_response',now())`); })).rejects.toThrow();
    } finally { await dispose(resource); }
  }, 90000);

  it('records action confirmation lineage without creating an Outcome', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource); const service = createInteractionService({ db: resource.runtime.db, ...ids }); const started = await service.start(new Date(Date.now() + 3600000));
      const interactionId = await getInteractionId(resource, ids, started.visitorId); const exposure = (await readExposure(resource, { ...ids, interactionId })).rows[0]; const requestId = randomUUID();
      await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); await tx.execute(sql`insert into action_requests (id,organization_id,business_id,visitor_identity_id,session_id,decision_id,capability_id,capability_version,input,idempotency_key,status) values (${requestId}::uuid,${ids.organizationId}::uuid,${ids.businessId}::uuid,${started.visitorId}::uuid,${started.sessionId}::uuid,${exposure.decision_id}::uuid,${randomUUID()}::uuid,'1','{}'::jsonb,'action-fact-1','execution_pending')`); await tx.execute(sql`insert into interaction_facts (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,decision_id,exposure_id,interaction_kind,occurred_at,idempotency_key,action_request_id) values (${randomUUID()}::uuid,${ids.organizationId}::uuid,${ids.businessId}::uuid,${started.visitorId}::uuid,${started.sessionId}::uuid,${interactionId}::uuid,${exposure.decision_id}::uuid,${exposure.id}::uuid,'action_confirmed',now(),'action-fact-1',${requestId}::uuid)`); });
      const result = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); return tx.execute(sql`select f.action_request_id,o.id as outcome_id from interaction_facts f left join action_outcomes o on o.action_request_id=f.action_request_id where f.interaction_kind='action_confirmed'`); }); expect(result.rows[0].action_request_id).toBe(requestId); expect(result.rows[0].outcome_id).toBeNull();
    } finally { await dispose(resource); }
  }, 90000);
});
