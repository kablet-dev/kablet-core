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
      const approverUser = randomUUID();
      const operatorUser = randomUUID();
      const supportApproverUser = randomUUID();
      try {
        await migrate(bootstrap.db, { migrationsFolder });
        const privacyBoundary = await bootstrapConnection.query("select pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer, has_table_privilege('kablet_privacy_owner', 'public.kablet_consents', 'SELECT') as privacy_can_select, has_table_privilege('kablet_privacy_owner', 'public.kablet_consents', 'DELETE') as privacy_can_delete, has_table_privilege('kablet_dev', 'public.kablet_consents', 'DELETE') as runtime_can_delete, pg_get_userbyid((select c.relowner from pg_class c where c.oid='public.kablet_privacy_deletion_requests'::regclass)) as deletion_request_owner, has_table_privilege('kablet_privacy_owner', 'public.organizations', 'REFERENCES') as privacy_can_reference_organizations, has_table_privilege('kablet_privacy_owner', 'public.businesses', 'REFERENCES') as privacy_can_reference_businesses from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='kablet_visitor_privacy_delete' and p.pronargs=2");
        expect(privacyBoundary.rows).toHaveLength(1);
        expect(privacyBoundary.rows[0]).toMatchObject({ owner: 'kablet_privacy_owner', security_definer: true, privacy_can_select: true, privacy_can_delete: true, runtime_can_delete: false, deletion_request_owner: 'kablet_privacy_owner', privacy_can_reference_organizations: false, privacy_can_reference_businesses: false });
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
          await bootstrapConnection.query(`insert into kablet_users(id,auth_provider,provider_subject) values ($1,'supabase',$2)`, [approverUser, `approver-${approverUser}`]);
          await bootstrapConnection.query(`insert into kablet_memberships(id,user_id,organization_id,business_id,role,capabilities) values ($1,$2,$3,$4,'admin','["truth.read","policy.approve"]')`, [randomUUID(), approverUser, orgA, businessA]);
          await bootstrapConnection.query(`insert into kablet_users(id,auth_provider,provider_subject) values ($1,'supabase',$2)`, [operatorUser, `operator-${operatorUser}`]);
          await bootstrapConnection.query(`insert into kablet_platform_operators(user_id,capabilities) values ($1,'["audit.read","support.grant"]')`, [operatorUser]);
          await bootstrapConnection.query(`insert into kablet_users(id,auth_provider,provider_subject) values ($1,'supabase',$2)`, [supportApproverUser, `support-approver-${supportApproverUser}`]);
          await bootstrapConnection.query(`insert into kablet_platform_operators(user_id,capabilities) values ($1,'["audit.read","support.grant","platform.safety.manage"]')`, [supportApproverUser]);
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
      await expect(security.grantConsent({ organizationId: orgA, businessId: businessA, visitorId: unrelatedVisitor, purpose: 'analytics', version: 'privacy.v1' })).rejects.toThrow('visitor not found');
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
      const readDeletionRequests = async (organizationId: string, businessId: string) => {
        const client = await runtimePool.connect();
        try {
          await client.query('begin');
          await client.query('select set_config($1,$2,true),set_config($3,$4,true)', ['kablet.organization_id', organizationId, 'kablet.business_id', businessId]);
          return (await client.query('select status,attempts,last_error,receipt_reference from kablet_privacy_deletion_requests where organization_id=$1 and business_id=$2 and visitor_identity_id=$3', [orgA, businessA, visitor])).rows;
        } finally {
          await client.query('rollback').catch(() => undefined);
          client.release();
        }
      };
      const deletionRequest = await readDeletionRequests(orgA, businessA);
      expect(deletionRequest).toHaveLength(1);
      expect(deletionRequest[0]).toMatchObject({ status: 'pending', attempts: 0, last_error: null, receipt_reference: null });
      await expect(security.deleteVisitor({ organizationId: orgA, businessId: businessA, visitorId: visitor })).resolves.toMatchObject({ rows: [{ deleted: false }] });
      const repeatedDeletionRequest = await readDeletionRequests(orgA, businessA);
      expect(repeatedDeletionRequest).toHaveLength(1);
      expect(await readDeletionRequests(orgB, businessB)).toHaveLength(0);
      await expect(security.exportVisitor({ organizationId: orgA, businessId: businessA, visitorId: visitor })).resolves.toMatchObject({ visitor: null, sessions: [], consents: [] });
      await expect(security.exportVisitor({ organizationId: orgB, businessId: businessB, visitorId: unrelatedVisitor })).resolves.toMatchObject({ visitor: expect.anything() });
      const vault = createCredentialVault(Buffer.alloc(32, 9), 'test-key-v1');
      await security.saveProviderCredential({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', secret: 'provider-secret-value', keyVersion: 'test-key-v1', scopes: ['read_catalog'], createdBy: userA }, vault);
      await expect(security.readProviderCredentialSecret({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', requiredScopes: ['read_catalog'] }, vault)).resolves.toBe('provider-secret-value');
      await expect(security.readProviderCredentialSecret({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', requiredScopes: ['write_orders'] }, vault)).rejects.toThrow('provider scope unavailable');
      const unscopedCredential = await runtimePool.query("select current_user, current_setting('kablet.organization_id', true) as organization_id, has_table_privilege(current_user, 'public.kablet_provider_credentials', 'SELECT') as can_select, (select count(*)::int from kablet_provider_credentials where provider_key='test-provider') as visible_count");
      expect(unscopedCredential.rows[0]).toMatchObject({ current_user: 'kablet_dev', organization_id: '', can_select: true, visible_count: 0 });
      const credentialReadClient = await runtimePool.connect();
      try {
        await credentialReadClient.query('begin');
        await credentialReadClient.query('select set_config($1,$2,true)', ['kablet.organization_id', orgA]);
        await credentialReadClient.query('select set_config($1,$2,true)', ['kablet.business_id', businessA]);
        const scopedCredential = await credentialReadClient.query('select encrypted_secret, key_version, status, credential_revision from kablet_provider_credentials where organization_id=$1 and business_id=$2 and provider_key=$3', [orgA, businessA, 'test-provider']);
        expect(scopedCredential.rows).toHaveLength(1);
        expect(scopedCredential.rows[0].encrypted_secret.toString('utf8')).not.toContain('provider-secret-value');
        expect(scopedCredential.rows[0]).toMatchObject({ key_version: 'test-key-v1', status: 'active', credential_revision: 1 });
      } finally {
        await credentialReadClient.query('rollback').catch(() => undefined);
        credentialReadClient.release();
      }
      const rotatedVault = createCredentialVault(Buffer.alloc(32, 10), 'test-key-v2');
      const rotated = await security.saveProviderCredential({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', secret: 'rotated-provider-secret', keyVersion: 'test-key-v2', scopes: ['write_orders'], createdBy: userA }, rotatedVault);
      expect(rotated.rows).toHaveLength(1);
      expect(rotated.rows[0]).toMatchObject({ key_version: 'test-key-v2', credential_revision: 2, status: 'active' });
      await expect(security.readProviderCredentialSecret({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', requiredScopes: ['write_orders'] }, rotatedVault)).resolves.toBe('rotated-provider-secret');
      await expect(security.readProviderCredentialSecret({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider' }, vault)).rejects.toThrow('credential key version is unavailable');
      await expect(security.readProviderCredentialSecret({ organizationId: orgB, businessId: businessB, providerKey: 'test-provider' }, rotatedVault)).rejects.toThrow('provider credential unavailable');
      const newestVault = createCredentialVault(Buffer.alloc(32, 11), 'test-key-v3');
      const [concurrentRead, concurrentRotation] = await Promise.allSettled([
        security.readProviderCredentialSecret({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', requiredScopes: ['write_orders'] }, rotatedVault),
        security.saveProviderCredential({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', secret: 'newest-provider-secret', keyVersion: 'test-key-v3', scopes: ['read_catalog'], createdBy: userA }, newestVault),
      ]);
      expect(concurrentRotation.status).toBe('fulfilled');
      if (concurrentRead.status === 'rejected') expect(concurrentRead.reason).toMatchObject({ message: 'credential key version is unavailable' });
      else expect(concurrentRead.value).toBe('rotated-provider-secret');
      await expect(security.readProviderCredentialSecret({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', requiredScopes: ['read_catalog'] }, newestVault)).resolves.toBe('newest-provider-secret');
      await security.saveProviderCredential({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', secret: 'expiring-provider-secret', scopes: ['read_catalog'], expiresAt: new Date(Date.now() + 2_000), createdBy: userA }, newestVault);
      await new Promise(resolve => setTimeout(resolve, 2_100));
      await expect(security.readProviderCredentialSecret({ organizationId: orgA, businessId: businessA, providerKey: 'test-provider', requiredScopes: ['read_catalog'] }, newestVault)).rejects.toThrow('provider credential expired');
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
      await expect(security.approvePolicy({ organizationId: orgA, businessId: businessA, policyKey: 'baseline', revisionId, actorId: userA, actorType: 'merchant_user' })).rejects.toThrow('approval_separation_required');
      const approved = await security.approvePolicy({ organizationId: orgA, businessId: businessA, policyKey: 'baseline', revisionId, actorId: approverUser, actorType: 'merchant_user' });
      expect(requested.rows).toHaveLength(1);
      expect(approved.rows).toHaveLength(1);
      await expect(security.isPolicyApproved({ organizationId: orgA, businessId: businessA, policyKey: 'baseline', revisionId, approvalId: String(approved.rows[0].id) })).resolves.toBe(true);
      expect(String(requested.rows[0].id)).not.toBe(String(approved.rows[0].id));
      const supportGrant = await security.requestSupportGrant({ actorId: operatorUser, organizationId: orgA, businessId: businessA, purpose: 'Investigate an authorized tenant issue', capabilities: ['privacy.manage'], expiresAt: new Date(Date.now() + 60_000) });
      const supportGrantId = String(supportGrant.rows[0].id);
      await expect(security.approveSupportGrant({ actorId: operatorUser, grantId: supportGrantId })).rejects.toThrow('support_grant_self_approval');
      await expect(security.approveSupportGrant({ actorId: supportApproverUser, grantId: supportGrantId })).resolves.toMatchObject({ rows: [{ id: supportGrantId }] });
      await expect(security.resolveSupportGrant({ actorId: supportApproverUser, grantId: supportGrantId, organizationId: orgA, businessId: businessA, capability: 'privacy.manage' })).resolves.toMatchObject({ grantId: supportGrantId, organizationId: orgA, businessId: businessA });
      await expect(security.resolveSupportGrant({ actorId: supportApproverUser, grantId: supportGrantId, organizationId: orgB, businessId: businessB, capability: 'privacy.manage' })).rejects.toThrow('support_access_denied');
      await security.revokeSupportGrant({ actorId: supportApproverUser, grantId: supportGrantId });
      await expect(security.resolveSupportGrant({ actorId: supportApproverUser, grantId: supportGrantId, organizationId: orgA, businessId: businessA, capability: 'privacy.manage' })).rejects.toThrow('support_access_denied');
      const expiringGrant = await security.requestSupportGrant({ actorId: operatorUser, organizationId: orgA, businessId: businessA, purpose: 'Verify expiry enforcement safely', capabilities: ['privacy.manage'], expiresAt: new Date(Date.now() + 2_000) });
      const expiringGrantId = String(expiringGrant.rows[0].id);
      await security.approveSupportGrant({ actorId: supportApproverUser, grantId: expiringGrantId });
      await new Promise(resolve => setTimeout(resolve, 2_100));
      await expect(security.resolveSupportGrant({ actorId: supportApproverUser, grantId: expiringGrantId, organizationId: orgA, businessId: businessA, capability: 'privacy.manage' })).rejects.toThrow('support_access_denied');
      await expect(security.setPlatformSafetyRule({ actorId: supportApproverUser, ruleKey: 'baseline', effect: 'deny', reason: 'Blocked during a safety review' })).resolves.toMatchObject({ rows: [{ rule_key: 'baseline', effect: 'deny' }] });
      await expect(security.assertPlatformSafety('baseline')).rejects.toThrow('platform_safety_denied');
      await expect(security.setPlatformSafetyRule({ actorId: userA, ruleKey: 'baseline', effect: 'allow', reason: 'Merchant cannot override safety' })).rejects.toThrow('platform_safety_denied');
      await expect(security.setPlatformSafetyRule({ actorId: supportApproverUser, ruleKey: 'baseline', effect: 'allow', reason: 'Restore the verified platform baseline' })).resolves.toMatchObject({ rows: [{ rule_key: 'baseline', effect: 'allow' }] });
      await security.auditPlatform({ actorId: supportApproverUser, action: 'security.support.test', resourceType: 'support_grant', resourceId: supportGrantId, metadata: { providerToken: 'must-not-persist' } });
      const unauthorizedPlatformAudit = await runtimePool.connect();
      try {
        await unauthorizedPlatformAudit.query('begin');
        await expect(unauthorizedPlatformAudit.query("insert into kablet_audit_events(id,organization_id,business_id,actor_id,actor_type,action,resource_type,metadata) values ($1,null,null,$2,'platform_operator','security.unauthorized','security_test','{}'::jsonb)", [randomUUID(), userA])).rejects.toMatchObject({ code: '42501' });
      } finally {
        await unauthorizedPlatformAudit.query('rollback').catch(() => undefined);
        unauthorizedPlatformAudit.release();
      }
      await bootstrapConnection.query('select set_config($1,$2,false)', ['kablet.actor_id', supportApproverUser]);
      try {
        const platformAudit = await bootstrapConnection.query("select actor_id,organization_id,business_id,metadata from kablet_audit_events where action='security.support.test'");
        expect(platformAudit.rows).toHaveLength(1);
        expect(platformAudit.rows[0]).toMatchObject({ actor_id: supportApproverUser, organization_id: null, business_id: null, metadata: { providerToken: '[redacted]' } });
      } finally {
        await bootstrapConnection.query('reset kablet.actor_id');
      }
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
