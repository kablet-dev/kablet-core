import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDb, createDecisionRepository } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { createInteractionService } from '../../apps/web/lib/interaction-service';
import { describe, expect, it } from 'vitest';

const manager = loadTestManagerConfig();
const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;
const appPassword = process.env.TEST_APP_PASSWORD;
const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');
const org = '73000000-0000-4000-8000-000000000001';
const business = '73000000-0000-4000-8000-000000000002';

async function disposable() {
  if (!bootstrapUser || !bootstrapPassword || !roleAdminUrl || !appPassword) throw new Error('TEST_BOOTSTRAP_USER, TEST_BOOTSTRAP_PASSWORD, TEST_ROLE_ADMIN_URL and TEST_APP_PASSWORD are required');
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  const name = `kablet_test_${randomBytes(16).toString('hex')}`;
  await managerPool.query(`create database "${name}" owner "kablet_test_manager"`);
  try {
    await managerPool.query(`grant connect, create on database "${name}" to "${bootstrapUser}"`);
    const target = new pg.Pool({ connectionString: `${base}/${name}`, max: 1 });
    try { await target.query(`grant usage, create on schema public to "${bootstrapUser}"`); await target.query('grant usage, create on schema public to kablet_privacy_owner'); } finally { await target.end(); }
    const bootstrapUrl = `postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${name}`;
    const migrated = createDb(bootstrapUrl);
    const roleAdmin = new pg.Pool({ connectionString: roleAdminUrl, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000 });
    try { await roleAdmin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false'); await migrate(migrated.db, { migrationsFolder }); } finally { await roleAdmin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await roleAdmin.end(); }
    await migrated.db.execute(sql`grant usage on schema public to kablet_dev`);
    await migrated.db.execute(sql`grant select, insert, update, delete on organizations, businesses, visitor_identities, visitor_sessions, visitor_observations, visitor_state_revisions, visitor_states, visitor_decisions, visitor_decision_business_truth_refs, interaction_sessions, business_offerings, business_offering_revisions, offering_publications to kablet_dev`);
    await migrated.pool.end();
    const runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(appPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${name}`);
    await runtime.db.transaction(async tx => {
      const offering = randomUUID();
      const revision = randomUUID();
      await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
      await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Orchestration Org')`);
      await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'Orchestration Business')`);
      await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`);
      await tx.execute(sql`insert into business_offerings(id,business_id,name) values (${offering}::uuid,${business}::uuid,'Orchestration Offering')`);
      await tx.execute(sql`insert into business_offering_revisions(id,offering_id,revision_number,name,description,pricing_kind,visibility,approval_status,provenance_source_type,provenance_source_reference,provenance_captured_at,provenance_captured_by) values (${revision}::uuid,${offering}::uuid,1,'Orchestration Offering','A controlled integration fixture','unknown','public','approved','owner_input','integration-fixture',now(),'test')`);
      await tx.execute(sql`insert into offering_publications(offering_id,revision_id) values (${offering}::uuid,${revision}::uuid)`);
    });
    return { name, managerPool, runtime };
  } catch (error) { await managerPool.query(`drop database if exists "${name}"`); await managerPool.end(); throw error; }
}
async function cleanup(resource: Awaited<ReturnType<typeof disposable>>) { await resource.runtime.pool.end(); await resource.managerPool.query(`drop database "${resource.name}"`); await resource.managerPool.end(); }

describe('real interaction orchestration', () => {
  it('bootstraps, persists intent state, creates a Decision and returns experience.v1', async () => {
    const resource = await disposable();
    try {
      const service = createInteractionService({ db: resource.runtime.db, organizationId: org, businessId: business });
      const started = await service.start(new Date(Date.now() + 60_000));
      expect(started.experience.contractVersion).toBe('experience.v1');
      const experience = await service.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'orchestration-1' });
      expect(experience.contractVersion).toBe('experience.v1');
      const rows = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`); await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`); return tx.execute(sql`select (select count(*) from visitor_observations)::int as observations, (select count(*) from visitor_state_revisions where visitor_identity_id=${started.visitorId}::uuid and version=1)::int as revisions, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid)::int as decisions, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid and visitor_state_version=0)::int as initial_decisions, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid and visitor_state_version=1)::int as intent_decisions`); });
      expect(rows.rows[0]).toMatchObject({ observations: 1, revisions: 1, decisions: 2, initial_decisions: 1, intent_decisions: 1 });
    } finally { await cleanup(resource); }
  }, 90000);

  it('replays exactly and rejects changed input for the same idempotency key', async () => {
    const resource = await disposable();
    try {
      const service = createInteractionService({ db: resource.runtime.db, organizationId: org, businessId: business });
      const started = await service.start(new Date(Date.now() + 60_000));
      const first = await service.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'replay-1' });
      const beforeReplay = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`); await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`); return tx.execute(sql`select (select count(*) from visitor_observations)::int as observations, (select count(*) from visitor_state_revisions where visitor_identity_id=${started.visitorId}::uuid)::int as revisions, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid)::int as decisions, (select version from visitor_states where visitor_identity_id=${started.visitorId}::uuid) as version`); });
      expect(beforeReplay.rows[0]).toMatchObject({ observations: 1, revisions: 2, decisions: 2, version: '1' });
      const second = await service.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'replay-1' });
      expect(second).toEqual(first);
      await expect(service.expressIntent(started.handle, { intent: 'select_offering', idempotencyKey: 'replay-1' })).rejects.toThrow('observation idempotency key conflicts with a different input');
      const afterReplay = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`); await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`); return tx.execute(sql`select (select count(*) from visitor_observations)::int as observations, (select count(*) from visitor_state_revisions where visitor_identity_id=${started.visitorId}::uuid)::int as revisions, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid)::int as decisions, (select version from visitor_states where visitor_identity_id=${started.visitorId}::uuid) as version`); });
      expect(afterReplay.rows[0]).toEqual(beforeReplay.rows[0]);
    } finally { await cleanup(resource); }
  }, 90000);

  it('recovers after observation commit and Decision failure without duplicating state', async () => {
    const resource = await disposable();
    try {
      const normalService = createInteractionService({ db: resource.runtime.db, organizationId: org, businessId: business });
      const started = await normalService.start(new Date(Date.now() + 60_000));
      const realDecisions = createDecisionRepository(resource.runtime.db);
      let fail = true;
      const failing = { create: async (...args: Parameters<typeof realDecisions.create>) => { if (fail) { fail = false; throw new Error('controlled decision failure'); } return realDecisions.create(...args); } } as typeof realDecisions;
      const failingService = createInteractionService({ db: resource.runtime.db, organizationId: org, businessId: business, decisionRepository: failing });
      await expect(failingService.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'recovery-1' })).rejects.toThrow('controlled decision failure');
      const recovered = await createInteractionService({ db: resource.runtime.db, organizationId: org, businessId: business }).expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'recovery-1' });
      expect(recovered.contractVersion).toBe('experience.v1');
      const counts = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`); await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`); return tx.execute(sql`select (select count(*) from visitor_observations)::int as observations, (select count(*) from visitor_state_revisions where visitor_identity_id=${started.visitorId}::uuid)::int as revisions, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid)::int as decisions, (select version from visitor_states where visitor_identity_id=${started.visitorId}::uuid) as version`); });
      expect(counts.rows[0]).toMatchObject({ observations: 1, revisions: 2, decisions: 2, version: '1' });
    } finally { await cleanup(resource); }
  }, 90000);

  it('advances the same adaptive canvas from intent to qualification answer', async () => {
    const resource = await disposable();
    try {
      const service = createInteractionService({ db: resource.runtime.db, organizationId: org, businessId: business });
      const started = await service.start(new Date(Date.now() + 60_000));
      const qualification = await service.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'qualification-intent' });
      expect(qualification.decisionType).toBe('request_qualification');
      const question = qualification.components.find(component => component.type === 'qualification-question');
      expect(question?.type).toBe('qualification-question');
      const answered = await service.submitQualification(started.handle, { questionKey: 'context_timeline', answer: 'immediate', idempotencyKey: 'qualification-answer' });
      expect(answered.contractVersion).toBe('experience.v1');
      const replay = await service.submitQualification(started.handle, { questionKey: 'context_timeline', answer: 'immediate', idempotencyKey: 'qualification-answer' });
      expect(replay).toEqual(answered);
      await expect(service.submitQualification(started.handle, { questionKey: 'context_timeline', answer: 'exploring', idempotencyKey: 'qualification-answer' })).rejects.toThrow('observation idempotency key conflicts with a different input');
      const counts = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`); await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`); return tx.execute(sql`select (select count(*) from visitor_observations where visitor_identity_id=${started.visitorId}::uuid)::int as observations, (select count(*) from visitor_state_revisions where visitor_identity_id=${started.visitorId}::uuid)::int as revisions, (select version from visitor_states where visitor_identity_id=${started.visitorId}::uuid) as version, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid)::int as decisions`); });
      expect(counts.rows[0]).toMatchObject({ observations: 2, revisions: 3, decisions: 3, version: '2' });
    } finally { await cleanup(resource); }
  }, 90000);
});
