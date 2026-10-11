import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createCredentialVault, createDb, createSecurityRepository, createVisitorStateRepository } from '@kablet/db';
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
      const operatorUser = randomUUID();
      try {
        await migrate(bootstrap.db, { migrationsFolder });
        const privacyBoundary = await bootstrapConnection.query("select pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer, has_table_privilege('kablet_privacy_owner', 'public.kablet_consents', 'SELECT') as privacy_can_select, has_table_privilege('kablet_privacy_owner', 'public.kablet_consents', 'DELETE') as privacy_can_delete, has_table_privilege('kablet_dev', 'public.kablet_consents', 'DELETE') as runtime_can_delete from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='kablet_visitor_privacy_delete' and p.pronargs=2");
        expect(privacyBoundary.rows).toHaveLength(1);
        expect(privacyBoundary.rows[0]).toMatchObject({ owner: 'kablet_privacy_owner', security_definer: true, privacy_can_select: true, privacy_can_delete: true, runtime_can_delete: false });
        await bootstrapConnection.query('grant select on businesses to kablet_dev');
        await bootstrapConnection.query('grant select, insert, update, delete on visitor_identities, visitor_sessions, visitor_observations, visitor_state_revisions, visitor_states to kablet_dev');
        await bootstrapConnection.query('grant select on visitor_decisions, interaction_facts, experience_exposures, action_requests, action_outcomes, ai_intent_invocations, visitor_consents to kablet_dev');
        try {
          await bootstrapConnection.query('select set_config($1,$2,false)', ['kablet.organization_id', orgA]);
          await bootstrapConnection.query('select set_config($1,$2,false)', ['kablet.business_id', businessA]);
          const setupIdentity = await bootstrapConnection.query("select current_user, session_user, current_setting('kablet.organization_id', true) as organization_id, current_setting('kablet.business_id', true) as business_id");
          expect(setupIdentity.rows).toHaveLength(1);
          expect(setupIdentity.rows[0]).toMatchObject({ current_user: process.env.TEST_BOOTSTRAP_USER, session_user: process.env.TEST_BOOTSTRAP_USER, organization_id: orgA, business_id: businessA });
          await bootstrapConnection.query(`insert into organizations(id,name) values ('${orgA}','Security A')`);
          await bootstrapConnection.query(`insert into businesses(id,organization_id,name) values ('${businessA}','${orgA}','Business A')`);
          await bootstrapConnection.query(`insert into kablet_users(id,auth_provider,provider_subject) values ($1,'supabase',$2)`, [userA, `subject-${userA}`]);
          await bootstrapConnection.query(`insert into kablet_memberships(id,user_id,organization_id,business_id,role,capabilities) values ($1,$2,$3,$4,'admin','["truth.read","policy.approve"]')`, [randomUUID(), userA, orgA, businessA]);
          await bootstrapConnection.query(`insert into kablet_users(id,auth_provider,provider_subject) values ($1,'supabase',$2)`, [operatorUser, `operator-${operatorUser}`]);
          await bootstrapConnection.query(`insert into kablet_platform_operators(user_id,capabilities) values ($1,'["audit.read"]')`, [operatorUser]);
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
      const visitors = createVisitorStateRepository(runtime.db);
      const runtimeIdentity = await runtimePool.query("select current_user, has_table_privilege(current_user, 'businesses', 'SELECT') as can_read_businesses");
      expect(runtimeIdentity.rows).toHaveLength(1);
      expect(runtimeIdentity.rows[0]).toMatchObject({ current_user: 'kablet_dev', can_read_businesses: true });
      const operatorSession = await security.createSession(operatorUser, new Date(Date.now() + 60_000), 'platform_operator');
      await expect(security.resolvePlatformContext(operatorSession.token)).resolves.toMatchObject({ actorId: operatorUser, actorType: 'platform_operator', organizationId: null, businessId: null });
      await expect(security.resolveMerchantContext(operatorSession.token, orgA, businessA)).resolves.toBeNull();
      const session = await security.createSession(userA, new Date(Date.now() + 60_000));
      await expect(security.resolveMerchantContext(session.token, orgA, businessA)).resolves.toMatchObject({ actorId: userA, organizationId: orgA, businessId: businessA });
      await expect(security.resolveMerchantContext(session.token, orgB, businessB)).resolves.toBeNull();
      const expiredSession = await security.createSession(userA, new Date(Date.now() - 60_000));
      await expect(security.resolveSession(expiredSession.token)).resolves.toBeNull();
      const visitor = await visitors.createVisitor(orgA, businessA, new Date(Date.now() + 60_000));
      const unrelatedVisitor = await visitors.createVisitor(orgB, businessB, new Date(Date.now() + 60_000));
      await security.grantConsent({ organizationId: orgA, businessId: businessA, visitorId: visitor, purpose: 'analytics', version: 'privacy.v1' });
      const grantedExport = await security.exportVisitor({ organizationId: orgA, businessId: businessA, visitorId: visitor });
      expect(grantedExport.visitor).not.toBeNull();
      expect(grantedExport.consents).toHaveLength(1);
      expect(grantedExport.consents[0].revoked_at).toBeNull();
      await security.revokeConsent({ organizationId: orgA, businessId: businessA, visitorId: visitor, purpose: 'analytics' });
      const revokedExport = await security.exportVisitor({ organizationId: orgA, businessId: businessA, visitorId: visitor });
      expect(revokedExport.consents).toHaveLength(1);
      expect(revokedExport.consents[0].revoked_at).not.toBeNull();
      const directDeleteClient = await runtimePool.connect();
      try {
        await directDeleteClient.query('begin');
        await directDeleteClient.query('select set_config($1,$2,true)', ['kablet.organization_id', orgA]);
        await directDeleteClient.query('select set_config($1,$2,true)', ['kablet.business_id', businessA]);
        await expect(directDeleteClient.query('delete from kablet_consents where visitor_identity_id=$1', [visitor])).rejects.toMatchObject({ code: '42501' });
      } finally {
        await directDeleteClient.query('rollback').catch(() => undefined);
        directDeleteClient.release();
      }
      await expect(security.deleteVisitor({ organizationId: orgA, businessId: businessA, visitorId: visitor })).resolves.toMatchObject({ rows: [{ deleted: true }] });
      await expect(security.exportVisitor({ organizationId: orgA, businessId: businessA, visitorId: visitor })).resolves.toMatchObject({ visitor: null, sessions: [], consents: [] });
      await expect(security.exportVisitor({ organizationId: orgB, businessId: businessB, visitorId: unrelatedVisitor })).resolves.toMatchObject({ visitor: expect.anything() });
      const vault = createCredentialVault(Buffer.alloc(32, 9), 'test-key-v1');
      await security.saveProviderCredential({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', secret: 'provider-secret-value', keyVersion: 'test-key-v1', scopes: ['read_catalog'], createdBy: userA }, vault);
      await expect(security.readProviderCredentialSecret({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider' }, vault)).resolves.toBe('provider-secret-value');
      const unscopedCredential = await runtimePool.query("select current_user, current_setting('kablet.organization_id', true) as organization_id, has_table_privilege(current_user, 'public.kablet_provider_credentials', 'SELECT') as can_select, (select count(*)::int from kablet_provider_credentials where provider_key='test-provider') as visible_count");
      expect(unscopedCredential.rows[0]).toMatchObject({ current_user: 'kablet_dev', organization_id: '', can_select: true, visible_count: 0 });
      const credentialReadClient = await runtimePool.connect();
      try {
        await credentialReadClient.query('begin');
        await credentialReadClient.query('select set_config($1,$2,true)', ['kablet.organization_id', orgA]);
        await credentialReadClient.query('select set_config($1,$2,true)', ['kablet.business_id', businessA]);
        const scopedCredential = await credentialReadClient.query('select encrypted_secret, key_version, status from kablet_provider_credentials where organization_id=$1 and business_id=$2 and provider_key=$3', [orgA, businessA, 'test-provider']);
        expect(scopedCredential.rows).toHaveLength(1);
        expect(scopedCredential.rows[0].encrypted_secret.toString('utf8')).not.toContain('provider-secret-value');
        expect(scopedCredential.rows[0]).toMatchObject({ key_version: 'test-key-v1', status: 'active' });
      } finally {
        await credentialReadClient.query('rollback').catch(() => undefined);
        credentialReadClient.release();
      }
      await security.revokeProviderCredential({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider' });
      const revokedCredentialClient = await runtimePool.connect();
      try {
        await revokedCredentialClient.query('begin');
        await revokedCredentialClient.query('select set_config($1,$2,true)', ['kablet.organization_id', orgA]);
        await revokedCredentialClient.query('select set_config($1,$2,true)', ['kablet.business_id', businessA]);
        const revokedCredential = await revokedCredentialClient.query('select status from kablet_provider_credentials where organization_id=$1 and business_id=$2 and provider_key=$3', [orgA, businessA, 'test-provider']);
        expect(revokedCredential.rows).toHaveLength(1);
        expect(revokedCredential.rows[0]).toMatchObject({ status: 'revoked' });
      } finally {
        await revokedCredentialClient.query('rollback').catch(() => undefined);
        revokedCredentialClient.release();
      }
      await expect(security.readProviderCredentialSecret({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider' }, vault)).rejects.toThrow('provider credential unavailable');
      const revisionId = randomUUID();
      const requested = await security.requestPolicyApproval({ organizationId: orgA, businessId: businessA, policyKey: 'baseline', revisionId, actorId: userA, actorType: 'merchant_user' });
      const approved = await security.approvePolicy({ organizationId: orgA, businessId: businessA, policyKey: 'baseline', revisionId, actorId: userA, actorType: 'merchant_user' });
      expect(requested.rows).toHaveLength(1);
      expect(approved.rows).toHaveLength(1);
      await expect(security.isPolicyApproved({ organizationId: orgA, businessId: businessA, policyKey: 'baseline', revisionId, approvalId: String(approved.rows[0].id) })).resolves.toBe(true);
      expect(String(requested.rows[0].id)).not.toBe(String(approved.rows[0].id));
      await security.audit({ organizationId: orgA, businessId: businessA, actorId: userA, actorType: 'merchant_user', action: 'security.test', resourceType: 'security_test', metadata: { providerToken: 'must-not-persist' } });
      const auditClient = await runtimePool.connect();
      try {
        await auditClient.query('begin');
        await auditClient.query('select set_config($1,$2,true)', ['kablet.organization_id', orgA]);
        await auditClient.query('select set_config($1,$2,true)', ['kablet.business_id', businessA]);
        const audit = await auditClient.query("select metadata from kablet_audit_events where action='security.test'");
        expect(audit.rows).toHaveLength(1);
        expect(audit.rows[0].metadata.providerToken).toBe('[redacted]');
        await expect(auditClient.query("update kablet_audit_events set action='tampered' where action='security.test'")).rejects.toMatchObject({ code: '42501' });
      } finally {
        await auditClient.query('rollback').catch(() => undefined);
        auditClient.release();
      }
      await bootstrapConnection.query("update kablet_users set status='suspended' where id=$1", [userA]);
      await expect(security.resolveSession(session.token)).resolves.toBeNull();
      const missingContext = await runtimePool.query('select count(*)::int as count from kablet_memberships');
      expect(missingContext.rows).toHaveLength(1);
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
