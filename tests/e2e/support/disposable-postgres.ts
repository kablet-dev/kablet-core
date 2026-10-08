import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createConversionRepository } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { seedBaselineIntentPolicy } from '../../integration/intent-policy-fixture';

export const organizationId = '84000000-0000-4000-8000-000000000001';
export const businessId = '84000000-0000-4000-8000-000000000002';
const cookieSecret = 'e2e-only-kablet-interaction-cookie-secret-2026';

export type BrowserDatabase = { database: string; runtimeUrl: string; organizationId: string; businessId: string; cookieSecret: string; offeringId: string; offeringRevisionId: string; definitionId: string; cleanup: () => Promise<void> };

export async function provisionBrowserDatabase(): Promise<BrowserDatabase> {
  const manager = loadTestManagerConfig();
  const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
  const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
  const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;
  const appPassword = process.env.TEST_APP_PASSWORD;
  if (!bootstrapUser || !bootstrapPassword || !roleAdminUrl || !appPassword) throw new Error('Browser PostgreSQL test credentials are required');
  const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
  const database = `kablet_e2e_${randomBytes(12).toString('hex')}`;
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  const offeringId = randomUUID(); const offeringRevisionId = randomUUID(); const definitionId = randomUUID();
  let runtime: ReturnType<typeof createDb> | undefined;
  let target: pg.Pool | undefined;
  let bootstrap: ReturnType<typeof createDb> | undefined;
  let admin: pg.Pool | undefined;
  try {
    await managerPool.query(`create database "${database}" owner "${manager.TEST_MANAGER_USER}"`);
    await managerPool.query(`grant connect, create on database "${database}" to "${bootstrapUser}"`);
    target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
    await target.query(`grant usage, create on schema public to "${bootstrapUser}"`);
    await target.query('grant usage, create on schema public to kablet_privacy_owner');
    await target.end();
    target = undefined;
    bootstrap = createDb(`postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
    admin = new pg.Pool({ connectionString: roleAdminUrl, max: 1 });
    await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
    try { await migrate(bootstrap.db, { migrationsFolder: resolve(process.cwd(), 'packages/db/drizzle') }); } finally { await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap'); await admin.end(); admin = undefined; }
    await bootstrap.db.execute(sql`grant usage on schema public to kablet_dev`);
    await bootstrap.db.execute(sql`grant select, insert, update, delete on organizations, businesses, visitor_identities, visitor_sessions, visitor_observations, visitor_state_revisions, visitor_states, visitor_decisions, visitor_decision_business_truth_refs, interaction_sessions, business_offerings, business_offering_revisions, offering_publications, visitor_contact_records, visitor_consents, acquisition_contexts, experience_exposures, interaction_facts, action_requests, execution_attempts, action_outcomes, outcome_attributions, conversion_definition_revisions, conversion_facts to kablet_dev`);
    await bootstrap.db.transaction(async tx => {
      await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${businessId}, true)`);
      await tx.execute(sql`insert into organizations(id,name) values (${organizationId}::uuid,'Browser E2E Organization')`);
      await tx.execute(sql`insert into businesses(id,organization_id,name) values (${businessId}::uuid,${organizationId}::uuid,'Browser E2E Business')`);
      await tx.execute(sql`insert into business_offerings(id,business_id,name) values (${offeringId}::uuid,${businessId}::uuid,'Browser E2E Offering')`);
      await tx.execute(sql`insert into business_offering_revisions(id,offering_id,revision_number,name,description,pricing_kind,visibility,approval_status,provenance_source_type,provenance_source_reference,provenance_captured_at,provenance_captured_by) values (${offeringRevisionId}::uuid,${offeringId}::uuid,1,'Browser E2E Offering','A published browser proof offering','unknown','public','approved','owner_input','browser-e2e',now(),'test')`);
      await tx.execute(sql`insert into offering_publications(offering_id,revision_id) values (${offeringId}::uuid,${offeringRevisionId}::uuid)`);
    });
    await bootstrap.pool.end();
    bootstrap = undefined;
    runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(appPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
    await seedBaselineIntentPolicy(runtime.db, organizationId, businessId);
    await createConversionRepository(runtime.db).createDefinition({ id: definitionId, organizationId, businessId, definitionKey: 'lead', definitionVersion: 'v1', capabilityId: '91000000-0000-4000-8000-000000000001', capabilityVersion: '1', outcomeType: 'lead.delivered', active: true });
    return { database, runtimeUrl: `postgresql://kablet_dev:${encodeURIComponent(appPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`, organizationId, businessId, cookieSecret, offeringId, offeringRevisionId, definitionId, cleanup: async () => { try { await runtime?.pool.end(); } finally { await managerPool.query(`drop database if exists "${database}"`); await managerPool.end(); } } };
  } catch (error) {
    await target?.end().catch(() => undefined);
    await bootstrap?.pool.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await runtime?.pool.end().catch(() => undefined);
    await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
    await managerPool.end().catch(() => undefined);
    throw error;
  }
}
