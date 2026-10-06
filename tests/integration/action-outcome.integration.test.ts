import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createConversionRepository, createDb, createMeasurementRepository } from '@kablet/db';
import { createActionService } from '../../apps/web/lib/action-service';
import { controlledLeadAdapter } from '../../apps/web/lib/lead-adapter';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const manager = loadTestManagerConfig();
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');
const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;
const appPassword = process.env.TEST_APP_PASSWORD;
const org = 'a1000000-0000-4000-8000-000000000001';
const business = 'a1000000-0000-4000-8000-000000000002';
const otherBusiness = 'a1000000-0000-4000-8000-000000000003';
const visitor = 'a1000000-0000-4000-8000-000000000004';
const session = 'a1000000-0000-4000-8000-000000000005';
const revision = 'a1000000-0000-4000-8000-000000000006';
const decision = 'a1000000-0000-4000-8000-000000000007';
const contact = 'a1000000-0000-4000-8000-000000000008';
const consent = 'a1000000-0000-4000-8000-000000000009';
const action = 'a1000000-0000-4000-8000-000000000010';
const execution = 'a1000000-0000-4000-8000-000000000011';
const outcome = 'a1000000-0000-4000-8000-000000000012';

function name() { return `kablet_test_${randomBytes(16).toString('hex')}`; }
async function setup() {
  if (!bootstrapUser || !bootstrapPassword || !roleAdminUrl || !appPassword) throw new Error('TEST_BOOTSTRAP_USER, TEST_BOOTSTRAP_PASSWORD, TEST_ROLE_ADMIN_URL and TEST_APP_PASSWORD are required');
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  const database = name(); let target: pg.Pool | undefined; let runtime: ReturnType<typeof createDb> | undefined;
  try {
    await managerPool.query(`CREATE DATABASE "${database}" OWNER "kablet_test_manager"`);
    await managerPool.query(`GRANT CONNECT, CREATE ON DATABASE "${database}" TO "${bootstrapUser}"`);
    target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
    await target.query(`GRANT USAGE, CREATE ON SCHEMA public TO "${bootstrapUser}"`);
    await target.query('GRANT USAGE, CREATE ON SCHEMA public TO kablet_privacy_owner');
    await target.end(); target = undefined;
    const migrated = createDb(`postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
    const roleAdmin = new pg.Pool({ connectionString: roleAdminUrl, max: 1 });
    try { await roleAdmin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false'); await migrate(migrated.db, { migrationsFolder }); } finally { await roleAdmin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await roleAdmin.end(); }
    await migrated.db.execute(sql`grant select,insert,update,delete on organizations,businesses,visitor_identities,visitor_sessions,visitor_state_revisions,visitor_states,visitor_decisions,visitor_contact_records,visitor_consents to kablet_dev`);
    await migrated.pool.end();
    runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(appPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
    return { database, managerPool, runtime };
  } catch (error) { if (target) await target.end(); if (runtime) await runtime.pool.end(); await managerPool.query(`DROP DATABASE IF EXISTS "${database}"`); await managerPool.end(); throw error; }
}
async function cleanup(resource: Awaited<ReturnType<typeof setup>>) { await resource.runtime.pool.end(); await resource.managerPool.query(`DROP DATABASE "${resource.database}"`); await resource.managerPool.end(); }
describe('Action and Outcome PostgreSQL integration', () => {
  it('creates migration tables, constraints, FORCE RLS and least-privilege grants', async () => {
    const resource = await setup();
    try {
      const rows = await resource.runtime.db.execute(sql`select c.relname,c.relrowsecurity,c.relforcerowsecurity,has_table_privilege('kablet_dev',c.oid,'SELECT') as can_select,has_table_privilege('kablet_dev',c.oid,'INSERT') as can_insert,has_table_privilege('kablet_dev',c.oid,'UPDATE') as can_update,has_table_privilege('kablet_dev',c.oid,'DELETE') as can_delete from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('action_requests','execution_attempts','action_outcomes') order by c.relname`);
      expect(rows.rows).toHaveLength(3); for (const row of rows.rows) expect(row).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, can_select: true, can_update: false, can_delete: false });
      const constraints = await resource.runtime.db.execute(sql`select count(*)::int as count from pg_constraint where contype='u' and ((conrelid='action_requests'::regclass and pg_get_constraintdef(oid) like '%idempotency_key%') or (conrelid='execution_attempts'::regclass and pg_get_constraintdef(oid) like '%external_operation_id%'))`);
      expect(Number(constraints.rows[0].count)).toBe(2);
      const triggers = await resource.runtime.db.execute(sql`select count(*)::int as count from pg_trigger where tgname in ('action_requests_immutable','execution_attempts_immutable','action_outcomes_immutable')`);
      expect(Number(triggers.rows[0].count)).toBe(3);
    } finally { await cleanup(resource); }
  }, 90000);

  it('persists a complete lineage, rejects tenant escape and removes it through privacy deletion', async () => {
    const resource = await setup();
    try {
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Action Org')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'Action Business'),(${otherBusiness}::uuid,${org}::uuid,'Other Business')`);
        await tx.execute(sql`insert into visitor_identities(id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into visitor_sessions(id,organization_id,business_id,visitor_identity_id) values (${session}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid)`);
        await tx.execute(sql`insert into visitor_state_revisions(id,organization_id,business_id,visitor_identity_id,version,state) values (${revision}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,0,'{"schemaVersion":1,"intent":null,"selectedOffering":null,"timeWindow":null,"qualification":[],"contact":null,"consent":null}'::jsonb)`);
        await tx.execute(sql`insert into visitor_states(visitor_identity_id,organization_id,business_id,current_revision_id,version) values (${visitor}::uuid,${org}::uuid,${business}::uuid,${revision}::uuid,0)`);
        await tx.execute(sql`insert into visitor_decisions(id,organization_id,business_id,visitor_identity_id,session_id,decision_type,status,contract_version,policy_id,policy_version,visitor_state_revision_id,visitor_state_version,idempotency_key,input_fingerprint) values (${decision}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'offer_next_step','accepted','decision.v1','baseline','1',${revision}::uuid,0,'lineage-decision','no-pii')`);
        await tx.execute(sql`insert into visitor_contact_records(id,organization_id,business_id,visitor_identity_id,session_id,name,email,source_observation_id,idempotency_key) values (${contact}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'Distinctive Private Name','private-action@example.test',${revision}::uuid,'contact-action')`);
        await tx.execute(sql`insert into visitor_consents(id,organization_id,business_id,visitor_identity_id,session_id,purpose,version,status,source_observation_id,idempotency_key) values (${consent}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'follow_up','1','granted',${revision}::uuid,'consent-action')`);
        await tx.execute(sql`insert into action_requests(id,organization_id,business_id,visitor_identity_id,session_id,decision_id,capability_id,capability_version,input,idempotency_key,status) values (${action}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,${decision}::uuid,'91000000-0000-4000-8000-000000000001','1','{"contactRecordId":"a1000000-0000-4000-8000-000000000008"}'::jsonb,'action-key','execution_pending')`);
        await tx.execute(sql`insert into execution_attempts(id,organization_id,business_id,action_request_id,attempt_number,status,external_operation_id) values (${execution}::uuid,${org}::uuid,${business}::uuid,${action}::uuid,1,'succeeded','kablet:action:capability:1')`);
        await tx.execute(sql`insert into action_outcomes(id,organization_id,business_id,visitor_identity_id,session_id,decision_id,action_request_id,execution_id,outcome_type,status,evidence_type,evidence_reference,occurred_at) values (${outcome}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,${decision}::uuid,${action}::uuid,${execution}::uuid,'lead.delivered','verified','controlled_receipt','controlled-lead:action:1',now())`);
      });
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${otherBusiness},true)`); const result=await tx.execute(sql`select count(*)::int as count from action_requests`); expect(Number(result.rows[0].count)).toBe(0); })).resolves.toBeUndefined();
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`select public.kablet_visitor_privacy_delete(${org}::uuid,${visitor}::uuid)`); })).resolves.toBeUndefined();
      const remaining = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*) from action_requests)::int as requests,(select count(*) from execution_attempts)::int as attempts,(select count(*) from action_outcomes)::int as outcomes`); });
      expect(remaining.rows[0]).toMatchObject({ requests: 0, attempts: 0, outcomes: 0 });
    } finally { await cleanup(resource); }
  }, 90000);

  it('proves durable replay states, lifecycle fields and immutable action boundaries', async () => {
    const resource = await setup();
    try {
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Lifecycle Org')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'Lifecycle Business')`);
        await tx.execute(sql`insert into visitor_identities(id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into visitor_sessions(id,organization_id,business_id,visitor_identity_id) values (${session}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid)`);
        await tx.execute(sql`insert into visitor_state_revisions(id,organization_id,business_id,visitor_identity_id,version,state) values (${revision}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,0,'{"schemaVersion":1,"intent":null,"selectedOffering":null,"timeWindow":null,"qualification":[],"contact":null,"consent":null}'::jsonb)`);
        await tx.execute(sql`insert into visitor_states(visitor_identity_id,organization_id,business_id,current_revision_id,version) values (${visitor}::uuid,${org}::uuid,${business}::uuid,${revision}::uuid,0)`);
        await tx.execute(sql`insert into visitor_decisions(id,organization_id,business_id,visitor_identity_id,session_id,decision_type,status,contract_version,policy_id,policy_version,visitor_state_revision_id,visitor_state_version,idempotency_key,input_fingerprint) values (${decision}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'offer_next_step','accepted','decision.v1','baseline','1',${revision}::uuid,0,'lifecycle-decision','no-pii')`);
        await tx.execute(sql`insert into action_requests(id,organization_id,business_id,visitor_identity_id,session_id,decision_id,capability_id,capability_version,input,idempotency_key,status) values (${action}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,${decision}::uuid,'91000000-0000-4000-8000-000000000001','1','{"contactRecordId":"a1000000-0000-4000-8000-000000000008"}'::jsonb,'lifecycle-key','executing')`);
        await tx.execute(sql`insert into execution_attempts(id,organization_id,business_id,action_request_id,attempt_number,status,external_operation_id,adapter_request_id,failure_code) values (${execution}::uuid,${org}::uuid,${business}::uuid,${action}::uuid,1,'unknown','kablet:lifecycle:1',null,'timeout')`);
      });
      const unknown = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select ar.status,ea.status as attempt_status,ea.external_operation_id,(select count(*) from action_outcomes where action_request_id=ar.id)::int as outcomes from action_requests ar join execution_attempts ea on ea.action_request_id=ar.id where ar.id=${action}::uuid`); });
      expect(unknown.rows[0]).toMatchObject({ status: 'executing', attempt_status: 'unknown', external_operation_id: 'kablet:lifecycle:1', outcomes: 0 });
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`update action_requests set decision_id=${revision}::uuid where id=${action}::uuid`); })).rejects.toThrow();
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`delete from execution_attempts where id=${execution}::uuid`); })).rejects.toThrow();
    } finally { await cleanup(resource); }
  }, 90000);

  it('fails closed for missing, mismatched and cross-tenant contexts and preserves privacy rollback', async () => {
    const resource = await setup();
    try {
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Isolation Org')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'Isolation Business')`);
        await tx.execute(sql`insert into visitor_identities(id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into visitor_sessions(id,organization_id,business_id,visitor_identity_id) values (${session}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid)`);
        await tx.execute(sql`insert into visitor_state_revisions(id,organization_id,business_id,visitor_identity_id,version,state) values (${revision}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,0,'{"schemaVersion":1,"intent":null,"selectedOffering":null,"timeWindow":null,"qualification":[],"contact":null,"consent":null}'::jsonb)`);
        await tx.execute(sql`insert into visitor_states(visitor_identity_id,organization_id,business_id,current_revision_id,version) values (${visitor}::uuid,${org}::uuid,${business}::uuid,${revision}::uuid,0)`);
        await tx.execute(sql`insert into visitor_decisions(id,organization_id,business_id,visitor_identity_id,session_id,decision_type,status,contract_version,policy_id,policy_version,visitor_state_revision_id,visitor_state_version,idempotency_key,input_fingerprint) values (${decision}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'offer_next_step','accepted','decision.v1','baseline','1',${revision}::uuid,0,'isolation-decision','no-pii')`);
        await tx.execute(sql`insert into action_requests(id,organization_id,business_id,visitor_identity_id,session_id,decision_id,capability_id,capability_version,input,idempotency_key,status) values (${action}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,${decision}::uuid,'91000000-0000-4000-8000-000000000001','1','{}'::jsonb,'isolation-key','execution_pending')`);
      });
      const hidden = await resource.runtime.db.transaction(async tx => { const row=await tx.execute(sql`select count(*)::int as count from action_requests`); return row.rows[0].count; });
      expect(Number(hidden)).toBe(0);
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); await tx.execute(sql`select public.kablet_visitor_privacy_delete(${org}::uuid,${visitor}::uuid)`); throw new Error('rollback-after-delete'); })).rejects.toThrow('rollback-after-delete');
      const restored = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select count(*)::int as count from action_requests where id=${action}::uuid`); });
      expect(Number(restored.rows[0].count)).toBe(1);
    } finally { await cleanup(resource); }
  }, 90000);

  it('atomically claims one concurrent confirmation before adapter dispatch', async () => {
    const resource = await setup();
    try {
      const handle = 'concurrent-action-handle';
      const handleHash = Buffer.from((await import('node:crypto')).createHash('sha256').update(handle).digest('hex'), 'hex');
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Concurrent Org')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'Concurrent Business')`);
        await tx.execute(sql`insert into visitor_identities(id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into visitor_sessions(id,organization_id,business_id,visitor_identity_id) values (${session}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid)`);
        await tx.execute(sql`insert into interaction_sessions(id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${decision}::uuid,${handleHash},${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,now()+interval '1 hour')`);
        await tx.execute(sql`insert into visitor_state_revisions(id,organization_id,business_id,visitor_identity_id,version,state) values (${revision}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,0,'{"schemaVersion":1,"intent":"request_information","selectedOffering":null,"timeWindow":null,"qualification":[],"contact":{"ready":true},"consent":{"ready":true}}'::jsonb)`);
        await tx.execute(sql`insert into visitor_states(visitor_identity_id,organization_id,business_id,current_revision_id,version) values (${visitor}::uuid,${org}::uuid,${business}::uuid,${revision}::uuid,0)`);
        await tx.execute(sql`insert into visitor_decisions(id,organization_id,business_id,visitor_identity_id,session_id,decision_type,status,contract_version,policy_id,policy_version,visitor_state_revision_id,visitor_state_version,idempotency_key,input_fingerprint) values (${action}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'offer_next_step','accepted','decision.v1','baseline','1',${revision}::uuid,0,'concurrent-decision','no-pii')`);
        await createMeasurementRepository(resource.runtime.db, tx).insertExposure({ contractVersion: 'experience-exposure.v1', id: 'a1000000-0000-4000-8000-000000000013', organizationId: org, businessId: business, visitorIdentityId: visitor, visitorSessionId: session, interactionSessionId: decision, decisionId: action, exposureKind: 'server_response', exposedAt: new Date('2026-01-01T00:00:00Z') });
        await tx.execute(sql`insert into visitor_contact_records(id,organization_id,business_id,visitor_identity_id,session_id,name,email,source_observation_id,idempotency_key) values (${contact}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'Private Name','private@example.test',${revision}::uuid,'concurrent-contact')`);
        await tx.execute(sql`insert into visitor_consents(id,organization_id,business_id,visitor_identity_id,session_id,purpose,version,status,source_observation_id,idempotency_key) values (${consent}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'follow_up','1','granted',${revision}::uuid,'concurrent-consent')`);
      });
      let dispatches = 0;
      const adapter = {
        adapterKey: 'controlled.lead.v1', capabilityVersion: '1',
        validateInput: (input: unknown) => controlledLeadAdapter.validateInput(input),
        execute: async (_input: { name: string; email: string; consentPurpose: string; consentVersion: string }, context: { externalOperationId: string }) => { dispatches += 1; await new Promise(resolve => setTimeout(resolve, 25)); return { externalOperationId: context.externalOperationId, receiptReference: 'controlled-lead:concurrent' }; },
        verify: async () => ({ status: 'verified' as const, evidenceType: 'controlled_receipt', evidenceReference: 'controlled-lead:concurrent' }),
      };
      const service = createActionService(resource.runtime.db, org, business, { adapter });
      const results = await Promise.all([1, 2].map(() => service.confirm({ handle, decisionId: action, idempotencyKey: 'concurrent-confirmation', visitorConfirmed: true })));
      expect(dispatches).toBe(1);
      expect(new Set(results.map(result => result.actionRequestId)).size).toBe(1);
      const counts = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*) from action_requests)::int as requests,(select count(*) from execution_attempts)::int as attempts,(select count(*) from action_outcomes)::int as outcomes`); });
      expect(counts.rows[0]).toMatchObject({ requests: 1, attempts: 1, outcomes: 1 });
    } finally { await cleanup(resource); }
  }, 90000);

  it('isolates conversion failure and repairs it on verified replay without redispatch', async () => {
    const resource = await setup();
    try {
      const handle = 'conversion-repair-handle';
      const handleHash = Buffer.from((await import('node:crypto')).createHash('sha256').update(handle).digest('hex'), 'hex');
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`);
        await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Conversion Repair Org')`);
        await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'Conversion Repair Business')`);
        await tx.execute(sql`insert into visitor_identities(id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into visitor_sessions(id,organization_id,business_id,visitor_identity_id) values (${session}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid)`);
        await tx.execute(sql`insert into interaction_sessions(id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${decision}::uuid,${handleHash},${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,now()+interval '1 hour')`);
        await tx.execute(sql`insert into visitor_state_revisions(id,organization_id,business_id,visitor_identity_id,version,state) values (${revision}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,0,'{"schemaVersion":1,"intent":"request_information","selectedOffering":null,"timeWindow":null,"qualification":[],"contact":{"ready":true},"consent":{"ready":true}}'::jsonb)`);
        await tx.execute(sql`insert into visitor_states(visitor_identity_id,organization_id,business_id,current_revision_id,version) values (${visitor}::uuid,${org}::uuid,${business}::uuid,${revision}::uuid,0)`);
        await tx.execute(sql`insert into visitor_decisions(id,organization_id,business_id,visitor_identity_id,session_id,decision_type,status,contract_version,policy_id,policy_version,visitor_state_revision_id,visitor_state_version,idempotency_key,input_fingerprint) values (${action}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'offer_next_step','accepted','decision.v1','baseline','1',${revision}::uuid,0,'conversion-repair-decision','no-pii')`);
        await createMeasurementRepository(resource.runtime.db, tx).insertExposure({ contractVersion: 'experience-exposure.v1', id: 'a1000000-0000-4000-8000-000000000014', organizationId: org, businessId: business, visitorIdentityId: visitor, visitorSessionId: session, interactionSessionId: decision, decisionId: action, exposureKind: 'server_response', exposedAt: new Date('2026-01-01T00:00:00Z') });
        await tx.execute(sql`insert into visitor_contact_records(id,organization_id,business_id,visitor_identity_id,session_id,name,email,source_observation_id,idempotency_key) values (${contact}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'Repair Name','repair@example.test',${revision}::uuid,'conversion-repair-contact')`);
        await tx.execute(sql`insert into visitor_consents(id,organization_id,business_id,visitor_identity_id,session_id,purpose,version,status,source_observation_id,idempotency_key) values (${consent}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,'follow_up','1','granted',${revision}::uuid,'conversion-repair-consent')`);
        await createConversionRepository(resource.runtime.db, tx).createDefinition({ id: 'a1000000-0000-4000-8000-000000000015', organizationId: org, businessId: business, definitionKey: 'lead', definitionVersion: 'v1', capabilityId: '91000000-0000-4000-8000-000000000001', capabilityVersion: '1', outcomeType: 'lead.delivered', active: true });
      });
      let dispatches = 0;
      const adapter = { adapterKey: 'controlled.lead.v1', capabilityVersion: '1', validateInput: (input: unknown) => controlledLeadAdapter.validateInput(input), execute: async (_input: { name: string; email: string; consentPurpose: string; consentVersion: string }, context: { externalOperationId: string }) => { dispatches += 1; return { externalOperationId: context.externalOperationId, receiptReference: 'controlled-lead:conversion-repair' }; }, verify: async () => ({ status: 'verified' as const, evidenceType: 'controlled_receipt', evidenceReference: 'controlled-lead:conversion-repair' }) };
      let failConversion = true;
      const realConversion = createConversionRepository(resource.runtime.db);
      const conversionRepository = { classifyVerifiedOutcome: async (organizationId: string, businessId: string, outcomeId: string) => { if (failConversion) { failConversion = false; throw new Error('injected conversion classification failure'); } return realConversion.classifyVerifiedOutcome(organizationId, businessId, outcomeId); } };
      const service = createActionService(resource.runtime.db, org, business, { adapter, conversionRepository });
      const first = await service.confirm({ handle, decisionId: action, idempotencyKey: 'conversion-repair-confirmation', visitorConfirmed: true });
      expect(first.status).toBe('verified');
      const afterFirst = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*) from action_outcomes where status='verified')::int as outcomes,(select count(*) from execution_attempts where status='succeeded')::int as attempts,(select count(*) from conversion_facts)::int as facts`); });
      expect(afterFirst.rows[0]).toMatchObject({ outcomes: 1, attempts: 1, facts: 0 });
      failConversion = false;
      const replay = await service.confirm({ handle, decisionId: action, idempotencyKey: 'conversion-repair-confirmation', visitorConfirmed: true });
      expect(replay.status).toBe('verified');
      expect(dispatches).toBe(1);
      const afterReplay = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select (select count(*) from action_requests)::int as requests,(select count(*) from execution_attempts)::int as attempts,(select count(*) from action_outcomes where status='verified')::int as outcomes,(select count(*) from conversion_facts)::int as facts`); });
      expect(afterReplay.rows[0]).toMatchObject({ requests: 1, attempts: 1, outcomes: 1, facts: 1 });
    } finally { await cleanup(resource); }
  }, 90000);
});
