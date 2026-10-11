import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createSecurityRepository } from '@kablet/db';
import { loadTestManagerConfig } from '@kablet/config';
import { describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.TEST_MANAGER_PASSWORD && process.env.TEST_BOOTSTRAP_USER && process.env.TEST_BOOTSTRAP_PASSWORD && process.env.TEST_ROLE_ADMIN_URL && process.env.TEST_APP_PASSWORD);
const migrationsFolder = resolve(process.cwd(), 'packages/db/drizzle');
const orgA = '61000000-0000-4000-8000-000000000001';
const orgB = '61000000-0000-4000-8000-000000000002';
const businessA = '62000000-0000-4000-8000-000000000001';
const businessB = '62000000-0000-4000-8000-000000000002';

describe.skipIf(!enabled)('identity, RLS, consent and audit integration', () => {
  it('fails closed for missing context and denies cross-tenant membership access', async () => {
    const manager = loadTestManagerConfig();
    const base = `postgresql://${encodeURIComponent(manager.TEST_MANAGER_USER)}:${encodeURIComponent(manager.TEST_MANAGER_PASSWORD)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}`;
    const database = `kablet_security_${randomBytes(12).toString('hex')}`;
    const managerPool = new pg.Pool({ connectionString: `${base}/postgres`, max: 1 });
    let bootstrapPool: pg.Pool | undefined;
    let runtimePool: pg.Pool | undefined;
    try {
      await managerPool.query(`create database "${database}" owner "${manager.TEST_MANAGER_USER}"`);
      await managerPool.query(`grant connect, create on database "${database}" to "${process.env.TEST_BOOTSTRAP_USER}"`);
      const target = new pg.Pool({ connectionString: `${base}/${database}`, max: 1 });
      await target.query(`grant usage, create on schema public to "${process.env.TEST_BOOTSTRAP_USER}"`);
      await target.query('grant usage, create on schema public to kablet_privacy_owner');
      await target.end();
      const bootstrap = createDb(`postgresql://${encodeURIComponent(process.env.TEST_BOOTSTRAP_USER!)}:${encodeURIComponent(process.env.TEST_BOOTSTRAP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      const bootstrapConnection = bootstrap.pool;
      bootstrapPool = bootstrapConnection;
      const admin = new pg.Pool({ connectionString: process.env.TEST_ROLE_ADMIN_URL, max: 1 });
      await admin.query('grant kablet_privacy_owner to kablet_test_bootstrap with set true, inherit false');
      const userA = randomUUID();
      try {
        await migrate(bootstrap.db, { migrationsFolder });
        try {
          await bootstrapConnection.query('select set_config($1,$2,false)', ['kablet.organization_id', orgA]);
          await bootstrapConnection.query('select set_config($1,$2,false)', ['kablet.business_id', businessA]);
          const setupIdentity = await bootstrapConnection.query("select current_user, session_user, current_setting('kablet.organization_id', true) as organization_id, current_setting('kablet.business_id', true) as business_id");
          expect(setupIdentity.rows[0]).toMatchObject({ current_user: process.env.TEST_BOOTSTRAP_USER, session_user: process.env.TEST_BOOTSTRAP_USER, organization_id: orgA, business_id: businessA });
          await bootstrapConnection.query(`insert into organizations(id,name) values ('${orgA}','Security A')`);
          await bootstrapConnection.query(`insert into businesses(id,organization_id,name) values ('${businessA}','${orgA}','Business A')`);
          await bootstrapConnection.query(`insert into kablet_users(id,auth_provider,provider_subject) values ($1,'supabase',$2)`, [userA, `subject-${userA}`]);
          await bootstrapConnection.query(`insert into kablet_memberships(id,user_id,organization_id,business_id,role,capabilities) values ($1,$2,$3,$4,'admin','["truth.read","policy.approve"]')`, [randomUUID(), userA, orgA, businessA]);
          await bootstrapConnection.query('select set_config($1,$2,false)', ['kablet.organization_id', orgB]);
          await bootstrapConnection.query('select set_config($1,$2,false)', ['kablet.business_id', businessB]);
          await bootstrapConnection.query(`insert into organizations(id,name) values ('${orgB}','Security B')`);
          await bootstrapConnection.query(`insert into businesses(id,organization_id,name) values ('${businessB}','${orgB}','Business B')`);
        } finally {
          await bootstrapConnection.query('reset kablet.organization_id');
          await bootstrapConnection.query('reset kablet.business_id');
        }
      } finally {
        await admin.query('revoke kablet_privacy_owner from kablet_test_bootstrap');
        await admin.end();
      }
      const runtime = createDb(`postgresql://kablet_dev:${encodeURIComponent(process.env.TEST_APP_PASSWORD!)}@${manager.TEST_MANAGER_HOST}:${manager.TEST_MANAGER_PORT}/${database}`);
      runtimePool = runtime.pool;
      const security = createSecurityRepository(runtime.db);
      const session = await security.createSession(userA, new Date(Date.now() + 60_000));
      await expect(security.resolveMerchantContext(session.token, orgA, businessA)).resolves.toMatchObject({ actorId: userA, organizationId: orgA, businessId: businessA });
      await expect(security.resolveMerchantContext(session.token, orgB, businessB)).resolves.toBeNull();
      const missingContext = await runtimePool.query('select count(*)::int as count from kablet_memberships');
      expect(missingContext.rows[0].count).toBe(0);
      await security.revokeSession(session.id);
      await expect(security.resolveSession(session.token)).resolves.toBeNull();
    } finally {
      await runtimePool?.end();
      await bootstrapPool?.end();
      await managerPool.query(`drop database if exists "${database}"`).catch(() => undefined);
      await managerPool.end();
    }
  }, 90000);
});
