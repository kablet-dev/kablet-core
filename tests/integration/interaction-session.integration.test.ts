import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createInteractionSessionRepository, createVisitorStateRepository } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

const manager = loadTestManagerConfig();
const bootstrapUser = process.env.TEST_BOOTSTRAP_USER;
const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD;
const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;
const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');
const org = '71000000-0000-4000-8000-000000000001';
const business = '71000000-0000-4000-8000-000000000002';

function name() { return `kablet_test_${randomBytes(16).toString('hex')}`; }
async function setup() {
  if (!bootstrapUser || !bootstrapPassword) throw new Error('TEST_BOOTSTRAP_USER and TEST_BOOTSTRAP_PASSWORD are required');
  if (!roleAdminUrl) throw new Error('TEST_ROLE_ADMIN_URL is required for trusted migration bootstrap');
  const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
  const database = name();
  let migrated: ReturnType<typeof createDb> | undefined;
  let runtime: ReturnType<typeof createDb> | undefined;
  try {
    await managerPool.query(`create database "${database}" owner "kablet_test_manager"`);
    await managerPool.query(`grant connect, create on database "${database}" to "${bootstrapUser}"`);
    const target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
    try {
      await target.query(`grant usage, create on schema public to "${bootstrapUser}"`);
      await target.query('grant usage, create on schema public to kablet_privacy_owner');
    } finally { await target.end(); }
    const bootstrapUrl = `postgresql://${encodeURIComponent(bootstrapUser)}:${encodeURIComponent(bootstrapPassword)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`;
    migrated = createDb(bootstrapUrl);
    const roleAdmin = new pg.Pool({ connectionString: roleAdminUrl, max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000 });
    try {
      await roleAdmin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
      await migrate(migrated.db, { migrationsFolder });
    } finally {
      await roleAdmin.query('revoke kablet_privacy_owner from kablet_test_bootstrap');
      await roleAdmin.end();
    }
    await migrated.db.execute(sql`grant usage on schema public to kablet_dev`);
    await migrated.db.execute(sql`grant select, insert, update, delete on organizations, businesses, visitor_identities, visitor_sessions, visitor_state_revisions, visitor_states, interaction_sessions to kablet_dev`);
    await migrated.pool.end();
    migrated = undefined;
  } catch (error) {
    if (runtime) await runtime.pool.end();
    if (migrated) await migrated.pool.end();
    await managerPool.query(`drop database if exists "${database}"`);
    await managerPool.end();
    throw error;
  }
  try {
    if (!process.env.TEST_APP_PASSWORD) throw new Error('TEST_APP_PASSWORD is required for restricted runtime verification');
    const runtimeUrl = `postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`;
    runtime = createDb(runtimeUrl);
    await runtime.db.transaction(async tx => {
      await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`);
      await tx.execute(sql`insert into organizations(id,name) values (${org}::uuid,'Interaction Test Org')`);
      await tx.execute(sql`insert into businesses(id,organization_id,name) values (${business}::uuid,${org}::uuid,'Interaction Test Business')`);
    });
    return { database, managerPool, runtime };
  } catch (error) {
    if (runtime) await runtime.pool.end();
    await managerPool.query(`drop database if exists "${database}"`);
    await managerPool.end();
    throw error;
  }
}
async function cleanup(resource: Awaited<ReturnType<typeof setup>>) { await resource.runtime.pool.end(); await resource.managerPool.query(`drop database "${resource.database}"`); await resource.managerPool.end(); }

describe('durable anonymous interaction sessions', () => {
  it('binds an opaque hashed handle and enforces expiry, revocation and ownership', async () => {
    const resource = await setup();
    try {
      const visitors = createVisitorStateRepository(resource.runtime.db);
      const visitor = await visitors.createVisitor(org, business, new Date(Date.now() + 60_000));
      const session = await visitors.createSession(org, business, visitor);
      const sessions = createInteractionSessionRepository(resource.runtime.db);
      const handle = await sessions.create(org, business, visitor, session, new Date(Date.now() + 60_000));
      const interactionSession = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`); await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`); return tx.execute(sql`select id from interaction_sessions where visitor_identity_id=${visitor}::uuid and visitor_session_id=${session}::uuid`); });
      expect(interactionSession.rows).toHaveLength(1);
      await expect(sessions.resolve(org, business, handle)).resolves.toEqual({ visitorIdentityId: visitor, visitorSessionId: session, interactionSessionId: String(interactionSession.rows[0].id) });
      const raw = await resource.runtime.db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id', ${org}, true)`); await tx.execute(sql`select set_config('kablet.business_id', ${business}, true)`); return tx.execute(sql`select handle_hash from interaction_sessions`); });
      expect(raw.rows[0].handle_hash.toString()).not.toContain(handle);
      expect(await sessions.revoke(org, business, handle)).toBe(true);
      await expect(sessions.resolve(org, business, handle)).resolves.toBeNull();
      await expect(sessions.resolve('72000000-0000-4000-8000-000000000001', business, handle)).rejects.toThrow('business does not belong to organization');
      await expect(sessions.create(org, '72000000-0000-4000-8000-000000000002', visitor, session, new Date(Date.now() + 60_000))).rejects.toThrow();
    } finally { await cleanup(resource); }
  }, 90000);

  it('rejects expired handles and removes interaction lineage with privacy deletion', async () => {
    const resource = await setup();
    try {
      const visitors = createVisitorStateRepository(resource.runtime.db);
      const visitor = await visitors.createVisitor(org, business, new Date(Date.now() + 60_000));
      const session = await visitors.createSession(org, business, visitor);
      const sessions = createInteractionSessionRepository(resource.runtime.db);
      const expired = await sessions.create(org, business, visitor, session, new Date(Date.now() - 1));
      await expect(sessions.resolve(org, business, expired)).resolves.toBeNull();
      const active = await sessions.create(org, business, visitor, session, new Date(Date.now() + 60_000));
      await visitors.anonymize(org, visitor, business);
      await expect(sessions.resolve(org, business, active)).resolves.toBeNull();
    } finally { await cleanup(resource); }
  }, 90000);
});
