import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDb, createDecisionRepository, createVisitorStateRepository } from '@kablet/db';
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
  let migrated: ReturnType<typeof createDb> | undefined;
  let runtime: ReturnType<typeof createDb> | undefined;
  await managerPool.query(`create database "${name}" owner "kablet_test_manager"`);
  try {
    await managerPool.query(`grant connect, create on database "${name}" to "${bootstrapUser}"`);
    const target = new pg.Pool({ connectionString: `${base}/${name}`, max: 1 });
    try { await target.query(`grant usage, create on schema public to "${bootstrapUser}"`); await target.query('grant usage, create on schema public to kablet_privacy_owner'); } finally { await target.end(); }
    const bootstrapUrl = `postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${name}`;
    migrated = createDb(bootstrapUrl);
    const roleAdmin = new pg.Pool({ connectionString: roleAdminUrl, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000 });
    try { await roleAdmin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false'); await migrate(migrated.db, { migrationsFolder }); } finally { await roleAdmin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await roleAdmin.end(); }
    await migrated.db.execute(sql`grant usage on schema public to kablet_dev`);
    await migrated.db.execute(sql`grant select, insert, update, delete on organizations, businesses, visitor_identities, visitor_sessions, visitor_observations, visitor_state_revisions, visitor_states, visitor_decisions, visitor_decision_business_truth_refs, interaction_sessions, business_offerings, business_offering_revisions, offering_publications, visitor_contact_records, visitor_consents to kablet_dev`);
    await migrated.pool.end();
    migrated = undefined;
    runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(appPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${name}`);
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
  } catch (error) {
    if (runtime) await runtime.pool.end();
    if (migrated) await migrated.pool.end();
    await managerPool.query(`drop database if exists "${name}"`);
    await managerPool.end();
    throw error;
  }
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

  it('completes qualification through contact readiness without exposing PII', async () => {
    const resource = await disposable();
    try {
      const service = createInteractionService({ db: resource.runtime.db, organizationId: org, businessId: business });
      const started = await service.start(new Date(Date.now() + 60_000));
      const qualification = await service.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'contact-intent' });
      expect(qualification.decisionType).toBe('request_qualification');
      const contactRequest = await service.submitQualification(started.handle, { questionKey: 'context_timeline', answer: 'immediate', idempotencyKey: 'contact-qualification' });
      expect(contactRequest.decisionType).toBe('request_contact');
      const submitted = await service.submitContact(started.handle, { name: 'Pilot Visitor', email: 'pilot@example.test', consent: true, idempotencyKey: 'contact-submit' });
      expect(submitted.decisionType).toBe('offer_next_step');
      const returnedExperience = JSON.stringify(submitted);
      expect(returnedExperience).not.toContain('Pilot Visitor');
      expect(returnedExperience).not.toContain('pilot@example.test');
      expect(returnedExperience).not.toContain('changed@example.test');
      const replay = await service.submitContact(started.handle, { name: 'Pilot Visitor', email: 'pilot@example.test', consent: true, idempotencyKey: 'contact-submit' });
      expect(replay).toEqual(submitted);
      await expect(service.submitContact(started.handle, { name: 'Changed Visitor', email: 'changed@example.test', consent: true, idempotencyKey: 'contact-submit' })).rejects.toThrow('contact idempotency key conflicts with a different input');
      const persisted = await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
        await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select (select count(*) from visitor_contact_records where visitor_identity_id=${started.visitorId}::uuid)::int as contacts, (select count(*) from visitor_consents where visitor_identity_id=${started.visitorId}::uuid)::int as consents, (select count(*) from visitor_observations where visitor_identity_id=${started.visitorId}::uuid and kind in ('contact.submitted','consent.granted'))::int as evidence, (select count(*) from visitor_state_revisions where visitor_identity_id=${started.visitorId}::uuid)::int as revisions, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid)::int as decisions, (select name from visitor_contact_records where visitor_identity_id=${started.visitorId}::uuid limit 1) as contact_name, (select email from visitor_contact_records where visitor_identity_id=${started.visitorId}::uuid limit 1) as contact_email, (select idempotency_key from visitor_contact_records where visitor_identity_id=${started.visitorId}::uuid limit 1) as contact_key, (select idempotency_key from visitor_consents where visitor_identity_id=${started.visitorId}::uuid limit 1) as consent_key, (select bool_and(state::text not like '%pilot@example.test%' and state::text not like '%Pilot Visitor%') from visitor_state_revisions where visitor_identity_id=${started.visitorId}::uuid) as pii_free_state, (select bool_and(input_fingerprint not like '%pilot@example.test%' and input_fingerprint not like '%Pilot Visitor%') from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid) as pii_free_decisions, (select bool_and(decision_type <> 'request_qualification' or (qualification_question_key is not null and qualification_question_prompt is not null and qualification_question_options is not null)) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid) as valid_decisions, (select count(*) from visitor_decisions d left join visitor_state_revisions r on r.id=d.visitor_state_revision_id where d.visitor_identity_id=${started.visitorId}::uuid and r.id is null)::int as missing_lineage, (select count(*) from visitor_decisions d join visitor_state_revisions r on r.id=d.visitor_state_revision_id where d.visitor_identity_id=${started.visitorId}::uuid and d.visitor_state_version <> r.version)::int as mismatched_lineage, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid and visitor_state_version=2 and decision_type='request_contact')::int as request_contact_decisions, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid and visitor_state_version=3)::int as intermediate_decisions, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid and visitor_state_version=4 and decision_type='offer_next_step')::int as final_decisions`);
      });
      expect(persisted.rows[0]).toMatchObject({ contacts: 1, consents: 1, evidence: 2, revisions: 5, decisions: 4, contact_name: 'Pilot Visitor', contact_email: 'pilot@example.test', contact_key: 'contact-submit', consent_key: 'contact-submit', pii_free_state: true, pii_free_decisions: true, valid_decisions: true, missing_lineage: 0, mismatched_lineage: 0, request_contact_decisions: 1, intermediate_decisions: 0, final_decisions: 1 });
      expect(String(persisted.rows[0].contact_key)).not.toContain('Pilot Visitor');
      expect(String(persisted.rows[0].contact_key)).not.toContain('pilot@example.test');
      await expect(resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
        await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`update visitor_contact_records set email='mutated@example.test' where visitor_identity_id=${started.visitorId}::uuid`);
      })).rejects.toThrow();
      await expect(resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
        await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`delete from visitor_consents where visitor_identity_id=${started.visitorId}::uuid`);
      })).rejects.toThrow();
    } finally { await cleanup(resource); }
  }, 90000);

  it('rolls back contact and consent artifacts when final Decision persistence fails', async () => {
    const resource = await disposable();
    try {
      const normalService = createInteractionService({ db: resource.runtime.db, organizationId: org, businessId: business });
      const started = await normalService.start(new Date(Date.now() + 60_000));
      await normalService.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: 'atomicity-intent' });
      await normalService.submitQualification(started.handle, { questionKey: 'context_timeline', answer: 'immediate', idempotencyKey: 'atomicity-qualification' });
      const failingDecisions = { create: async (..._args: Parameters<ReturnType<typeof createDecisionRepository>['create']>) => { throw new Error('controlled final Decision failure'); } } as ReturnType<typeof createDecisionRepository>;
      const failingService = createInteractionService({ db: resource.runtime.db, organizationId: org, businessId: business, decisionRepository: failingDecisions });
      await expect(failingService.submitContact(started.handle, { name: 'Atomic Visitor', email: 'atomic@example.test', consent: true, idempotencyKey: 'atomicity-contact' })).rejects.toThrow('controlled final Decision failure');
      const persisted = await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
        await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select (select count(*) from visitor_contact_records where visitor_identity_id=${started.visitorId}::uuid)::int as contacts, (select count(*) from visitor_consents where visitor_identity_id=${started.visitorId}::uuid)::int as consents, (select count(*) from visitor_observations where visitor_identity_id=${started.visitorId}::uuid)::int as observations, (select count(*) from visitor_state_revisions where visitor_identity_id=${started.visitorId}::uuid)::int as revisions, (select count(*) from visitor_decisions where visitor_identity_id=${started.visitorId}::uuid)::int as decisions, (select version from visitor_states where visitor_identity_id=${started.visitorId}::uuid) as version`);
      });
      expect(persisted.rows[0]).toMatchObject({ contacts: 0, consents: 0, observations: 2, revisions: 3, decisions: 3, version: '2' });
      const recovered = await normalService.submitContact(started.handle, { name: 'Atomic Visitor', email: 'atomic@example.test', consent: true, idempotencyKey: 'atomicity-contact' });
      expect(recovered.decisionType).toBe('offer_next_step');
    } finally { await cleanup(resource); }
  }, 90000);

  it('deletes contact and consent lineage without affecting an unrelated visitor', async () => {
    const resource = await disposable();
    try {
      const service = createInteractionService({ db: resource.runtime.db, organizationId: org, businessId: business });
      const complete = async (key: string) => {
        const started = await service.start(new Date(Date.now() + 60_000));
        await service.expressIntent(started.handle, { intent: 'request_information', idempotencyKey: `${key}-intent` });
        await service.submitQualification(started.handle, { questionKey: 'context_timeline', answer: 'immediate', idempotencyKey: `${key}-qualification` });
        await service.submitContact(started.handle, { name: `${key} Visitor`, email: `${key}@example.test`, consent: true, idempotencyKey: `${key}-contact` });
        return started;
      };
      const target = await complete('target');
      const unrelated = await complete('unrelated');
      const visitors = createVisitorStateRepository(resource.runtime.db);
      await expect(resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`select public.kablet_visitor_privacy_delete(${org}::uuid,${target.visitorId}::uuid)`);
        throw new Error('controlled privacy transaction failure');
      })).rejects.toThrow('controlled privacy transaction failure');
      const rolledBack = await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select (select count(*) from visitor_contact_records where visitor_identity_id=${target.visitorId}::uuid)::int as contacts, (select count(*) from visitor_consents where visitor_identity_id=${target.visitorId}::uuid)::int as consents`);
      });
      expect(rolledBack.rows[0]).toMatchObject({ contacts: 1, consents: 1 });
      await expect(visitors.anonymize(org, target.visitorId, business)).resolves.toBe(true);
      const remaining = await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
        await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`);
        return tx.execute(sql`select (select count(*) from visitor_contact_records where visitor_identity_id=${target.visitorId}::uuid)::int as target_contacts, (select count(*) from visitor_consents where visitor_identity_id=${target.visitorId}::uuid)::int as target_consents, (select count(*) from visitor_contact_records where visitor_identity_id=${unrelated.visitorId}::uuid)::int as unrelated_contacts, (select count(*) from visitor_consents where visitor_identity_id=${unrelated.visitorId}::uuid)::int as unrelated_consents, (select count(*) from visitor_decisions where visitor_identity_id=${target.visitorId}::uuid)::int as target_decisions, (select count(*) from visitor_decisions where visitor_identity_id=${unrelated.visitorId}::uuid)::int as unrelated_decisions`);
      });
      expect(remaining.rows[0]).toMatchObject({ target_contacts: 0, target_consents: 0, unrelated_contacts: 1, unrelated_consents: 1, target_decisions: 0, unrelated_decisions: 4 });
    } finally { await cleanup(resource); }
  }, 90000);

  it('enforces contact and consent RLS across business, organization and tenant context', async () => {
    const resource = await disposable();
    try {
      const businessB = randomUUID();
      const orgB = '73000000-0000-4000-8000-000000000011';
      const businessOrgB = '73000000-0000-4000-8000-000000000012';
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${businessB}::uuid,${org}::uuid,'Business B')`);
        await tx.execute(sql`select set_config('kablet.organization_id', ${orgB}, true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${orgB}::uuid,'Organization B')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${businessOrgB}::uuid,${orgB}::uuid,'Business B2')`);
      });
      const visitors = createVisitorStateRepository(resource.runtime.db);
      const visitorA = await visitors.createVisitor(org, business, new Date(Date.now() + 60_000));
      const sessionA = await visitors.createSession(org, business, visitorA);
      const contactId = randomUUID();
      const consentId = randomUUID();
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into visitor_contact_records(id,organization_id,business_id,visitor_identity_id,session_id,name,email,preferred_channel,source_observation_id,idempotency_key) values (${contactId}::uuid,${org}::uuid,${business}::uuid,${visitorA}::uuid,${sessionA}::uuid,'RLS Test','rls@example.test','email',${randomUUID()}::uuid,'rls-contact')`);
        await tx.execute(sql`insert into visitor_consents(id,organization_id,business_id,visitor_identity_id,session_id,purpose,version,status,source_observation_id,idempotency_key) values (${consentId}::uuid,${org}::uuid,${business}::uuid,${visitorA}::uuid,${sessionA}::uuid,'follow_up','1','granted',${randomUUID()}::uuid,'rls-consent')`);
      });
      const assertHidden = async (organizationId: string, businessId: string) => resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${businessId}, true)`);
        const visible = await tx.execute(sql`select (select count(*) from visitor_contact_records where id=${contactId}::uuid)::int as contacts, (select count(*) from visitor_consents where id=${consentId}::uuid)::int as consents`);
        expect(visible.rows[0]).toMatchObject({ contacts: 0, consents: 0 });
        const updated = await tx.execute(sql`update visitor_contact_records set email='forged@example.test' where id=${contactId}::uuid`);
        const deleted = await tx.execute(sql`delete from visitor_consents where id=${consentId}::uuid`);
        expect(updated.rowCount).toBe(0);
        expect(deleted.rowCount).toBe(0);
      });
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`);
        const visible = await tx.execute(sql`select (select count(*) from visitor_contact_records where id=${contactId}::uuid)::int as contacts, (select count(*) from visitor_consents where id=${consentId}::uuid)::int as consents`);
        expect(visible.rows[0]).toMatchObject({ contacts: 1, consents: 1 });
      });
      await assertHidden(org, businessB);
      await assertHidden(orgB, businessOrgB);
      await resource.runtime.db.transaction(async tx => {
        const visible = await tx.execute(sql`select (select count(*) from visitor_contact_records where id=${contactId}::uuid)::int as contacts, (select count(*) from visitor_consents where id=${consentId}::uuid)::int as consents`);
        expect(visible.rows[0]).toMatchObject({ contacts: 0, consents: 0 });
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
        const mismatched = await tx.execute(sql`select count(*)::int as count from visitor_contact_records`);
        expect(Number(mismatched.rows[0].count)).toBe(0);
      });
    } finally { await cleanup(resource); }
  }, 90000);
});
