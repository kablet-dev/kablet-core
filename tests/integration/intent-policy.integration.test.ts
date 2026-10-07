import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, createDecisionRepository, createIntentPolicyRepository } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { seedBaselineIntentPolicy } from './intent-policy-fixture';

const manager = loadTestManagerConfig();
const folder = resolve(process.cwd(), 'packages/db/drizzle');
const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;
const appPassword = process.env.TEST_APP_PASSWORD;

async function provision() {
  if (!bootstrapUser || !bootstrapPassword || !roleAdminUrl || !appPassword) throw new Error('intent policy integration configuration is incomplete');
  const database = `kablet_test_${randomBytes(16).toString('hex')}`;
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  let bootstrap: ReturnType<typeof createDb> | undefined;
  try {
    await managerPool.query(`create database "${database}" owner "kablet_test_manager"`);
    await managerPool.query(`grant connect, create on database "${database}" to "${bootstrapUser}"`);
    const target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
    await target.query(`grant usage, create on schema public to "${bootstrapUser}"`);
    await target.query('grant usage, create on schema public to kablet_privacy_owner');
    await target.end();
    bootstrap = createDb(`postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
    const admin = new pg.Pool({ connectionString: roleAdminUrl, max: 1 });
    try { await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false'); await migrate(bootstrap.db, { migrationsFolder: folder }); }
    finally { await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await admin.end(); }
    await bootstrap.db.execute(sql`grant usage on schema public to kablet_dev`);
    await bootstrap.db.execute(sql`grant select,insert,update,delete on organizations,businesses,business_offerings,business_offering_revisions,offering_publications,visitor_identities,visitor_sessions,visitor_observations,visitor_state_revisions,visitor_states,visitor_decisions,visitor_decision_business_truth_refs,interaction_sessions to kablet_dev`);
    await bootstrap.pool.end(); bootstrap = undefined;
    return { database, managerPool, runtime: createDb(`postgresql://kablet_dev:${encodeURIComponent(appPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`) };
  } catch (error) {
    if (bootstrap) await bootstrap.pool.end().catch(() => undefined);
    await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
    await managerPool.end();
    throw error;
  }
}

async function dispose(resource: Awaited<ReturnType<typeof provision>>) {
  await resource.runtime.pool.end();
  await resource.managerPool.query(`drop database "${resource.database}"`);
  await resource.managerPool.end();
}

async function tenant(resource: Awaited<ReturnType<typeof provision>>) {
  const organizationId = randomUUID();
  const businessId = randomUUID();
  await resource.runtime.db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id',${organizationId},true),set_config('kablet.business_id',${businessId},true)`);
    await tx.execute(sql`insert into organizations(id,name) values (${organizationId}::uuid,'Intent Policy Org')`);
    await tx.execute(sql`insert into businesses(id,organization_id,name) values (${businessId}::uuid,${organizationId}::uuid,'Intent Policy Business')`);
  });
  return { organizationId, businessId };
}

const policyInput = (organizationId: string, businessId: string) => ({
  organizationId, businessId, policyKey: 'baseline',
  qualificationRequirements: [{ key: 'context_timeline', prompt: 'What timeframe?', options: [{ value: 'immediate', label: 'Soon' }, { value: 'exploring', label: 'Exploring' }] }],
  intentRules: [
    { intent: 'explore_offerings' as const, qualificationRequirementKeys: [] },
    { intent: 'request_information' as const, qualificationRequirementKeys: ['context_timeline'] },
    { intent: 'select_offering' as const, qualificationRequirementKeys: [] },
  ],
});

describe('Business Intent Policy PostgreSQL integration', () => {
  it('persists revisions, resolves publication, preserves history, and allocates scoped numbers', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource);
      const repo = createIntentPolicyRepository(resource.runtime.db);
      const first = await repo.createRevision(policyInput(ids.organizationId, ids.businessId));
      await repo.publish(ids.organizationId, ids.businessId, 'baseline', first.id);
      expect((await repo.getCurrent(ids.organizationId, ids.businessId, 'baseline')).revisionNumber).toBe(1);
      const second = await repo.createRevision({ ...policyInput(ids.organizationId, ids.businessId), qualificationRequirements: [{ key: 'context_timeline', prompt: 'Updated timeframe?', options: [{ value: 'immediate', label: 'Now' }] }] });
      await repo.publish(ids.organizationId, ids.businessId, 'baseline', second.id);
      expect((await repo.getCurrent(ids.organizationId, ids.businessId, 'baseline')).id).toBe(second.id);
      expect((await repo.getById(ids.organizationId, ids.businessId, first.id)).qualificationRequirements[0].prompt).toBe('What timeframe?');
      expect((await repo.createRevision({ ...policyInput(ids.organizationId, ids.businessId), policyKey: 'other' })).revisionNumber).toBe(1);
      const rows = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`); return tx.execute(sql`select relrowsecurity,relforcerowsecurity from pg_class where relname like 'business_intent_policy_%' and relkind='r' order by relname`); });
      expect(rows.rows).toHaveLength(5);
      expect(rows.rows.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
    } finally { await dispose(resource); }
  }, 90000);

  it('rejects cross-business access and runtime mutation while preserving child ownership', async () => {
    const resource = await provision();
    try {
      const a = await tenant(resource); const b = await tenant(resource);
      const repo = createIntentPolicyRepository(resource.runtime.db);
      const policy = await repo.createRevision(policyInput(a.organizationId, a.businessId));
      await repo.publish(a.organizationId, a.businessId, 'baseline', policy.id);
      await expect(repo.getById(b.organizationId, b.businessId, policy.id)).rejects.toThrow();
      await expect(resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${a.organizationId},true),set_config('kablet.business_id',${a.businessId},true)`);
        await tx.execute(sql`update business_intent_policy_revisions set policy_key='changed' where id=${policy.id}::uuid`);
      })).rejects.toThrow();
      await expect(resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${a.organizationId},true),set_config('kablet.business_id',${a.businessId},true)`);
        await tx.execute(sql`update business_intent_policy_requirements set prompt='changed' where policy_revision_id=${policy.id}::uuid`);
      })).rejects.toThrow();
      await expect(resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${a.organizationId},true),set_config('kablet.business_id',${a.businessId},true)`);
        await tx.execute(sql`update business_intent_policy_rules set intent='select_offering' where policy_revision_id=${policy.id}::uuid and intent='explore_offerings'`);
      })).rejects.toThrow();
      await expect(resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${b.organizationId},true),set_config('kablet.business_id',${b.businessId},true)`);
        return tx.execute(sql`select * from business_intent_policy_requirements where policy_revision_id=${policy.id}::uuid`);
      })).resolves.toMatchObject({ rows: [] });
    } finally { await dispose(resource); }
  }, 90000);

  it('enforces publication policy-key ownership at the PostgreSQL boundary', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource);
      const repo = createIntentPolicyRepository(resource.runtime.db);
      const policy = await repo.createRevision(policyInput(ids.organizationId, ids.businessId));
      await expect(resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`);
        await tx.execute(sql`insert into business_intent_policy_publications(organization_id,business_id,policy_key,revision_id) values (${ids.organizationId}::uuid,${ids.businessId}::uuid,'other',${policy.id}::uuid)`);
      })).rejects.toMatchObject({ cause: { code: '23503' } });
      await expect(repo.publish(ids.organizationId, ids.businessId, 'baseline', policy.id)).resolves.toBeUndefined();
    } finally { await dispose(resource); }
  }, 90000);

  it('keeps a Decision tied to the exact policy revision after publication changes', async () => {
    const resource = await provision();
    try {
      const ids = await tenant(resource);
      const repo = createIntentPolicyRepository(resource.runtime.db);
      const first = await repo.createRevision(policyInput(ids.organizationId, ids.businessId));
      await repo.publish(ids.organizationId, ids.businessId, 'baseline', first.id);
      const seeded = await seedBaselineIntentPolicy(resource.runtime.db, ids.organizationId, ids.businessId);
      const visitor = randomUUID(); const session = randomUUID(); const revision = randomUUID();
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`);
        await tx.execute(sql`insert into visitor_identities(id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${ids.organizationId}::uuid,${ids.businessId}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into visitor_sessions(id,organization_id,business_id,visitor_identity_id) values (${session}::uuid,${ids.organizationId}::uuid,${ids.businessId}::uuid,${visitor}::uuid)`);
        await tx.execute(sql`insert into visitor_state_revisions(id,organization_id,business_id,visitor_identity_id,version,state) values (${revision}::uuid,${ids.organizationId}::uuid,${ids.businessId}::uuid,${visitor}::uuid,0,'{"schemaVersion":1,"intent":null,"selectedOffering":null,"timeWindow":null,"qualification":[],"contact":null,"consent":null}'::jsonb)`);
        await tx.execute(sql`insert into visitor_states(visitor_identity_id,organization_id,business_id,current_revision_id,version) values (${visitor}::uuid,${ids.organizationId}::uuid,${ids.businessId}::uuid,${revision}::uuid,0)`);
      });
      const decision = createDecisionRepository(resource.runtime.db);
      const created = await decision.create({ organizationId: ids.organizationId, businessId: ids.businessId, visitorIdentityId: visitor, sessionId: session, idempotencyKey: 'policy-history', policyId: 'baseline', policyVersion: first.contractVersion, intentPolicyRevisionId: first.id, policyInput: { state: { schemaVersion: 1, intent: null, selectedOffering: null, timeWindow: null, qualification: [], contact: null, consent: null }, eligibleOfferingRefs: [], qualificationRequirements: [] } });
      expect(created.decision.intent_policy_revision_id).toBe(first.id);
      expect((await repo.getById(ids.organizationId, ids.businessId, String(created.decision.intent_policy_revision_id))).id).toBe(first.id);
      expect(seeded.revisionNumber).toBe(2);
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id',${ids.organizationId},true),set_config('kablet.business_id',${ids.businessId},true)`);
        await tx.execute(sql`select public.kablet_visitor_privacy_delete(${ids.organizationId}::uuid,${visitor}::uuid)`);
      });
      await expect(repo.getById(ids.organizationId, ids.businessId, first.id)).resolves.toMatchObject({ id: first.id });
    } finally { await dispose(resource); }
  }, 90000);
});
