import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { createInteractionService } from '../../apps/web/lib/interaction-service';
import { describe, expect, it } from 'vitest';

const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');
const manager = loadTestManagerConfig();
const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;
const name = () => `kablet_test_${randomBytes(16).toString('hex')}`;

async function provision() {
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  const database = name();
  let target: pg.Pool | undefined; let admin: pg.Pool | undefined; let bootstrap: ReturnType<typeof createDb> | undefined; let runtime: ReturnType<typeof createDb> | undefined;
  try {
    await managerPool.query(`CREATE DATABASE "${database}" OWNER "kablet_test_manager"`);
    if (!bootstrapUser || !bootstrapPassword || !roleAdminUrl) throw new Error('test bootstrap configuration is required');
    await managerPool.query(`GRANT CONNECT, CREATE ON DATABASE "${database}" TO "${bootstrapUser}"`);
    target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
    await target.query(`GRANT USAGE, CREATE ON SCHEMA public TO "${bootstrapUser}"`);
    await target.query('GRANT USAGE, CREATE ON SCHEMA public TO kablet_privacy_owner');
    await target.end(); target = undefined;
    bootstrap = createDb(`postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
    admin = new pg.Pool({ connectionString: roleAdminUrl, max: 1 });
    await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
    await migrate(bootstrap.db, { migrationsFolder });
    await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap');
    await bootstrap.db.execute(sql`grant usage on schema public to kablet_dev`);
    await bootstrap.db.execute(sql`grant select, insert, update, delete on organizations, businesses, visitor_identities, visitor_sessions, visitor_observations, visitor_state_revisions, visitor_states, visitor_decisions, visitor_decision_business_truth_refs, interaction_sessions, business_offerings, business_offering_revisions, offering_publications to kablet_dev`);
    await admin.end(); admin = undefined; await bootstrap.pool.end(); bootstrap = undefined;
    runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD ?? '')}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
    return { database, managerPool, runtime };
  } catch (error) {
    if (target) { try { await target.end(); } catch { /* preserve original setup error */ } }
    if (admin) { try { await admin.end(); } catch { /* preserve original setup error */ } }
    if (bootstrap) { try { await bootstrap.pool.end(); } catch { /* preserve original setup error */ } }
    if (runtime) { try { await runtime.pool.end(); } catch { /* preserve original setup error */ } }
    try { await managerPool.query(`DROP DATABASE IF EXISTS "${database}"`); } catch { /* preserve original setup error */ }
    try { await managerPool.end(); } catch { /* preserve original setup error */ }
    throw error;
  }
}

async function dispose(resource: Awaited<ReturnType<typeof provision>>) {
  await resource.runtime.pool.end();
  await resource.managerPool.query(`DROP DATABASE "${resource.database}"`);
  await resource.managerPool.end();
}

describe('Acquisition Context disposable PostgreSQL integration', () => {
  it('persists one tenant-owned immutable context per interaction session', async () => {
    const resource = await provision();
    try {
      const org = randomUUID(); const business = randomUUID(); const visitor = randomUUID(); const visitorSession = randomUUID(); const interaction = randomUUID(); const acquisition = randomUUID();
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into organizations (id,name) values (${org}::uuid,'Acquisition Org')`);
        await tx.execute(sql`insert into businesses (id,organization_id,name) values (${business}::uuid,${org}::uuid,'Acquisition Business')`);
        await tx.execute(sql`insert into visitor_identities (id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into visitor_sessions (id,organization_id,business_id,visitor_identity_id) values (${visitorSession}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid)`);
        await tx.execute(sql`insert into interaction_sessions (id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${interaction}::uuid,decode(repeat('ab',32),'hex'),${org}::uuid,${business}::uuid,${visitor}::uuid,${visitorSession}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into acquisition_contexts (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,captured_at,landing_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term) values (${acquisition}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${visitorSession}::uuid,${interaction}::uuid,now(),'/landing','https://search.test/path','google','cpc','pilot','hero','service')`);
      });
      const row = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`); return tx.execute(sql`select organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,landing_path,utm_source from acquisition_contexts where id=${acquisition}::uuid`); });
      expect(row.rows[0]).toMatchObject({ organization_id: org, business_id: business, visitor_identity_id: visitor, visitor_session_id: visitorSession, interaction_session_id: interaction, landing_path: '/landing', utm_source: 'google' });
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`); await tx.execute(sql`update acquisition_contexts set landing_path='/changed' where id=${acquisition}::uuid`); })).rejects.toThrow();
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`); await tx.execute(sql`insert into acquisition_contexts (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,captured_at,landing_path) values (${randomUUID()}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${visitorSession}::uuid,${interaction}::uuid,now(),'/duplicate')`); })).rejects.toThrow();
    } finally { await dispose(resource); }
  }, 90000);

  it('deletes only the target acquisition lineage through authorized privacy deletion', async () => {
    const resource = await provision();
    try {
      const org = randomUUID(); const business = randomUUID(); const visitor = randomUUID(); const otherVisitor = randomUUID();
      await resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into organizations (id,name) values (${org}::uuid,'Privacy Org')`); await tx.execute(sql`insert into businesses (id,organization_id,name) values (${business}::uuid,${org}::uuid,'Privacy Business')`);
        for (const id of [visitor, otherVisitor]) await tx.execute(sql`insert into visitor_identities (id,organization_id,business_id,retention_expires_at) values (${id}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`);
        for (const id of [visitor, otherVisitor]) { const session = randomUUID(); const interaction = randomUUID(); await tx.execute(sql`insert into visitor_sessions (id,organization_id,business_id,visitor_identity_id) values (${session}::uuid,${org}::uuid,${business}::uuid,${id}::uuid)`); await tx.execute(sql`insert into interaction_sessions (id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${interaction}::uuid,decode(${randomBytes(32).toString('hex')},'hex'),${org}::uuid,${business}::uuid,${id}::uuid,${session}::uuid,now()+interval '1 day')`); await tx.execute(sql`insert into acquisition_contexts (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,captured_at,landing_path) values (${randomUUID()}::uuid,${org}::uuid,${business}::uuid,${id}::uuid,${session}::uuid,${interaction}::uuid,now(),'/')`); }
      });
      await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`); await tx.execute(sql`select public.kablet_visitor_privacy_delete(${org}::uuid,${visitor}::uuid)`); });
      const remaining = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`); return tx.execute(sql`select visitor_identity_id from acquisition_contexts`); });
      expect(remaining.rows).toEqual([{ visitor_identity_id: otherVisitor }]);
    } finally { await dispose(resource); }
  }, 90000);

  it('rejects cross-business and cross-organization acquisition lineage at the database boundary', async () => {
    const resource = await provision();
    try {
      const orgA = randomUUID(); const businessA = randomUUID(); const visitorA = randomUUID(); const sessionA = randomUUID(); const interactionA = randomUUID();
      const orgB = randomUUID(); const businessB = randomUUID(); const visitorB = randomUUID(); const sessionB = randomUUID(); const interactionB = randomUUID();
      const createLineage = (org: string, business: string, visitor: string, session: string, interaction: string, label: string) => resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into organizations (id,name) values (${org}::uuid,${`Org ${label}`})`);
        await tx.execute(sql`insert into businesses (id,organization_id,name) values (${business}::uuid,${org}::uuid,${`Business ${label}`})`);
        await tx.execute(sql`insert into visitor_identities (id,organization_id,business_id,retention_expires_at) values (${visitor}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`);
        await tx.execute(sql`insert into visitor_sessions (id,organization_id,business_id,visitor_identity_id) values (${session}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid)`);
        await tx.execute(sql`insert into interaction_sessions (id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${interaction}::uuid,decode(${randomBytes(32).toString('hex')},'hex'),${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,now()+interval '1 day')`);
      });
      await createLineage(orgA, businessA, visitorA, sessionA, interactionA, 'A');
      await createLineage(orgB, businessB, visitorB, sessionB, interactionB, 'B');
      const insert = (org: string, business: string, visitor: string, session: string, interaction: string) => resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${orgA}, true), set_config('kablet.business_id', ${businessA}, true)`); await tx.execute(sql`insert into acquisition_contexts (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,captured_at,landing_path) values (${randomUUID()}::uuid,${org}::uuid,${business}::uuid,${visitor}::uuid,${session}::uuid,${interaction}::uuid,now(),'/')`); });
      await expect(insert(orgA, businessB, visitorA, sessionA, interactionA)).rejects.toThrow();
      await expect(insert(orgB, businessB, visitorA, sessionA, interactionA)).rejects.toThrow();
      await expect(insert(orgA, businessA, visitorB, sessionB, interactionB)).rejects.toThrow();
    } finally { await dispose(resource); }
  }, 90000);

  it('enforces tenant RLS and denies ordinary runtime deletion', async () => {
    const resource = await provision();
    try {
      const orgA = randomUUID(); const businessA = randomUUID(); const visitor = randomUUID(); const session = randomUUID(); const interaction = randomUUID(); const acquisition = randomUUID();
      const orgB = randomUUID(); const businessB = randomUUID();
      const createTenant = (org: string, business: string, visitorId: string, sessionId: string, interactionId: string) => resource.runtime.db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true), set_config('kablet.business_id', ${business}, true)`);
        await tx.execute(sql`insert into organizations (id,name) values (${org}::uuid,'RLS Organization')`); await tx.execute(sql`insert into businesses (id,organization_id,name) values (${business}::uuid,${org}::uuid,'RLS Business')`);
        await tx.execute(sql`insert into visitor_identities (id,organization_id,business_id,retention_expires_at) values (${visitorId}::uuid,${org}::uuid,${business}::uuid,now()+interval '1 day')`); await tx.execute(sql`insert into visitor_sessions (id,organization_id,business_id,visitor_identity_id) values (${sessionId}::uuid,${org}::uuid,${business}::uuid,${visitorId}::uuid)`); await tx.execute(sql`insert into interaction_sessions (id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${interactionId}::uuid,decode(${randomBytes(32).toString('hex')},'hex'),${org}::uuid,${business}::uuid,${visitorId}::uuid,${sessionId}::uuid,now()+interval '1 day')`);
      });
      await createTenant(orgA, businessA, visitor, session, interaction);
      await createTenant(orgB, businessB, randomUUID(), randomUUID(), randomUUID());
      await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${orgA},true),set_config('kablet.business_id',${businessA},true)`); await tx.execute(sql`insert into acquisition_contexts (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,captured_at,landing_path) values (${acquisition}::uuid,${orgA}::uuid,${businessA}::uuid,${visitor}::uuid,${session}::uuid,${interaction}::uuid,now(),'/')`); });
      const read = (org: string, business: string) => resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${org},true),set_config('kablet.business_id',${business},true)`); return tx.execute(sql`select id from acquisition_contexts where id=${acquisition}::uuid`); });
      expect((await read(orgA, businessA)).rows).toHaveLength(1); expect((await read(orgA, businessB)).rows).toHaveLength(0); expect((await read(orgB, businessB)).rows).toHaveLength(0); expect((await resource.runtime.db.execute(sql`select id from acquisition_contexts where id=${acquisition}::uuid`)).rows).toHaveLength(0);
      await expect(resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${orgA},true),set_config('kablet.business_id',${businessA},true)`); await tx.execute(sql`delete from acquisition_contexts where id=${acquisition}::uuid`); })).rejects.toMatchObject({ cause: { code: '42501' } });
    } finally { await dispose(resource); }
  }, 90000);

  it('rolls back initial visitor lineage when acquisition validation fails inside start', async () => {
    const resource = await provision();
    try {
      const organizationId = randomUUID(); const businessId = randomUUID();
      await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${organizationId},true),set_config('kablet.business_id',${businessId},true)`); await tx.execute(sql`insert into organizations (id,name) values (${organizationId}::uuid,'Atomic Org')`); await tx.execute(sql`insert into businesses (id,organization_id,name) values (${businessId}::uuid,${organizationId}::uuid,'Atomic Business')`); });
      const service = createInteractionService({ db: resource.runtime.db.db, organizationId, businessId });
      await expect(service.start(new Date(Date.now()+1800000), { landingPath: 'x'.repeat(2049), referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null })).rejects.toThrow();
      const counts = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${organizationId},true),set_config('kablet.business_id',${businessId},true)`); return tx.execute(sql`select (select count(*) from visitor_identities)::int as visitors, (select count(*) from visitor_sessions)::int as sessions, (select count(*) from interaction_sessions)::int as interactions, (select count(*) from acquisition_contexts)::int as acquisitions, (select count(*) from visitor_decisions)::int as decisions`); });
      expect(counts.rows[0]).toEqual({ visitors: 0, sessions: 0, interactions: 0, acquisitions: 0, decisions: 0 });
    } finally { await dispose(resource); }
  }, 90000);
});
