import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { AuthContext, ConsentPurpose, SecurityCapability, ActorType } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';
import type { createCredentialVault } from './credential-vault.js';

function hashToken(token: string): Buffer { return createHash('sha256').update(token).digest(); }
function safeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeAuditMetadata);
  if (!value || typeof value !== 'object') return typeof value === 'string' && value.length > 2000 ? '[redacted]' : value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
    const sensitive = /(secret|token|password|credential|authorization|api.?key|private.?key)/i.test(key);
    return [key, sensitive ? '[redacted]' : safeAuditMetadata(item)];
  }));
}
function tenant<T>(db: Database['db'], organizationId: string, businessId: string, fn: (tx: DatabaseTransaction) => Promise<T>) {
  return db.transaction(async tx => { await tx.execute(sql`select set_config('kablet.organization_id',${organizationId},true),set_config('kablet.business_id',${businessId},true)`); return fn(tx); });
}

export function createSecurityRepository(db: Database['db']) {
  return {
    async upsertUser(provider: string, subject: string) {
      const id = randomUUID();
      const row = await db.execute(sql`insert into kablet_users(id,auth_provider,provider_subject) values (${id}::uuid,${provider},${subject}) on conflict (auth_provider,provider_subject) do update set provider_subject=excluded.provider_subject returning id,auth_provider,provider_subject,status`);
      return row.rows[0];
    },
    async createSession(userId: string, expiresAt: Date, actorType: Extract<ActorType, 'merchant_user' | 'platform_operator'> = 'merchant_user') {
      const token = randomBytes(32).toString('base64url');
      const id = randomUUID();
      await db.execute(sql`insert into kablet_auth_sessions(id,user_id,token_hash,actor_type,expires_at) values (${id}::uuid,${userId}::uuid,${hashToken(token)},${actorType},${expiresAt})`);
      return { id, token, expiresAt };
    },
    async resolveSession(token: string): Promise<{ sessionId: string; userId: string; actorType: Extract<ActorType, 'merchant_user' | 'platform_operator'> } | null> {
      const row = await db.execute(sql`select s.id,s.user_id,s.actor_type from kablet_auth_sessions s join kablet_users u on u.id=s.user_id where s.token_hash=${hashToken(token)} and s.revoked_at is null and s.expires_at > now() and u.status='active'`);
      return row.rows[0] ? { sessionId: String(row.rows[0].id), userId: String(row.rows[0].user_id), actorType: String(row.rows[0].actor_type) as 'merchant_user' | 'platform_operator' } : null;
    },
    async resolveMerchantContext(token: string, organizationId: string, businessId: string): Promise<AuthContext | null> {
      const session = await this.resolveSession(token);
      if (!session || session.actorType !== 'merchant_user') return null;
      const row = await tenant(db, organizationId, businessId, async tx => tx.execute(sql`select m.capabilities,m.status,m.starts_at,m.ends_at from kablet_memberships m where m.user_id=${session.userId}::uuid and m.organization_id=${organizationId}::uuid and (m.business_id is null or m.business_id=${businessId}::uuid) order by case when m.business_id is null then 1 else 0 end limit 1`));
      const membership = row.rows[0] as { capabilities?: unknown; status?: string; starts_at?: Date; ends_at?: Date | null } | undefined;
      const now = Date.now();
      if (!membership || membership.status !== 'active' || (membership.starts_at && new Date(membership.starts_at).getTime() > now) || (membership.ends_at && new Date(membership.ends_at).getTime() <= now)) return null;
      return { actorId: session.userId, actorType: 'merchant_user', organizationId, businessId, capabilities: Array.isArray(membership.capabilities) ? membership.capabilities as SecurityCapability[] : [], sessionId: session.sessionId };
    },
    async resolvePlatformContext(token: string): Promise<AuthContext | null> {
      const session = await this.resolveSession(token);
      if (!session || session.actorType !== 'platform_operator') return null;
      const row = await db.execute(sql`select status,capabilities from kablet_platform_operators where user_id=${session.userId}::uuid`);
      const operator = row.rows[0] as { status?: string; capabilities?: unknown } | undefined;
      if (!operator || operator.status !== 'active') return null;
      return { actorId: session.userId, actorType: 'platform_operator', organizationId: null, businessId: null, capabilities: Array.isArray(operator.capabilities) ? operator.capabilities as SecurityCapability[] : [], sessionId: session.sessionId };
    },
    async registerPlatformOperator(userId: string, capabilities: SecurityCapability[] = ['audit.read']) {
      return db.execute(sql`insert into kablet_platform_operators(user_id,capabilities) values (${userId}::uuid,${JSON.stringify(capabilities)}::jsonb) on conflict (user_id) do update set status='active',capabilities=excluded.capabilities returning user_id,status,capabilities`);
    },
    async isRegisteredPlatformOperator(userId: string) {
      const row = await db.execute(sql`select 1 from kablet_platform_operators where user_id=${userId}::uuid and status='active'`);
      return Boolean(row.rows[0]);
    },
    async revokeSession(sessionId: string) { await db.execute(sql`update kablet_auth_sessions set revoked_at=now() where id=${sessionId}::uuid`); },
    async addMembership(input: { userId: string; organizationId: string; businessId?: string; role: string; capabilities: SecurityCapability[] }) {
      const id = randomUUID();
      return tenant(db, input.organizationId, input.businessId ?? input.organizationId, async tx => tx.execute(sql`insert into kablet_memberships(id,user_id,organization_id,business_id,role,capabilities) values (${id}::uuid,${input.userId}::uuid,${input.organizationId}::uuid,${input.businessId ? sql`${input.businessId}::uuid` : sql`null`},${input.role},${JSON.stringify(input.capabilities)}::jsonb) returning id`));
    },
    async requestPolicyApproval(input: { organizationId: string; businessId: string; policyKey: string; revisionId: string; actorId: string; actorType: 'merchant_user' | 'platform_operator' }) {
      return tenant(db, input.organizationId, input.businessId, async tx => tx.execute(sql`insert into kablet_policy_approval_events(id,organization_id,business_id,policy_key,revision_id,event_type,actor_id,actor_type) values (${randomUUID()}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.policyKey},${input.revisionId}::uuid,'requested',${input.actorId}::uuid,${input.actorType}) returning id`));
    },
    async approvePolicy(input: { organizationId: string; businessId: string; policyKey: string; revisionId: string; actorId: string; actorType: 'merchant_user' | 'platform_operator' }) {
      return tenant(db, input.organizationId, input.businessId, async tx => tx.execute(sql`insert into kablet_policy_approval_events(id,organization_id,business_id,policy_key,revision_id,event_type,actor_id,actor_type) values (${randomUUID()}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.policyKey},${input.revisionId}::uuid,'approved',${input.actorId}::uuid,${input.actorType}) returning id`));
    },
    async isPolicyApproved(input: { organizationId: string; businessId: string; policyKey: string; revisionId: string; approvalId: string }) {
      return tenant(db, input.organizationId, input.businessId, async tx => {
        const row = await tx.execute(sql`select 1 from kablet_policy_approval_events where id=${input.approvalId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and policy_key=${input.policyKey} and revision_id=${input.revisionId}::uuid and event_type='approved' limit 1`);
        return Boolean(row.rows[0]);
      });
    },
    async grantConsent(input: { organizationId: string; businessId: string; visitorId: string; purpose: ConsentPurpose; version: string }) {
      return tenant(db, input.organizationId, input.businessId, async tx => tx.execute(sql`insert into kablet_consents(id,organization_id,business_id,visitor_identity_id,purpose,version,granted_at,revoked_at) values (${randomUUID()}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.visitorId}::uuid,${input.purpose},${input.version},now(),null) on conflict (organization_id,business_id,visitor_identity_id,purpose,version) do update set granted_at=now(),revoked_at=null returning id`));
    },
    async revokeConsent(input: { organizationId: string; businessId: string; visitorId: string; purpose: ConsentPurpose }) { return tenant(db, input.organizationId, input.businessId, async tx => tx.execute(sql`update kablet_consents set revoked_at=now() where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and visitor_identity_id=${input.visitorId}::uuid and purpose=${input.purpose}`)); },
    async exportVisitor(input: { organizationId: string; businessId: string; visitorId: string }) {
      return tenant(db, input.organizationId, input.businessId, async tx => {
        const visitor = await tx.execute(sql`select id,organization_id,business_id,created_at,retention_expires_at from visitor_identities where id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        const sessions = await tx.execute(sql`select id,started_at,last_seen_at,ended_at,status from visitor_sessions where visitor_identity_id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        const observations = await tx.execute(sql`select id,kind,value,observed_at from visitor_observations where visitor_identity_id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        const decisions = await tx.execute(sql`select id,decision_type,created_at from visitor_decisions where visitor_identity_id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        const facts = await tx.execute(sql`select id,interaction_kind,occurred_at from interaction_facts where visitor_identity_id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        const exposures = await tx.execute(sql`select id,decision_id,exposed_at from experience_exposures where visitor_identity_id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        const actions = await tx.execute(sql`select id,decision_id,status,created_at from action_requests where visitor_identity_id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        const outcomes = await tx.execute(sql`select id,action_request_id,status,occurred_at from action_outcomes where visitor_identity_id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        const aiInvocations = await tx.execute(sql`select id,status,claimed_at,completed_at from ai_intent_invocations where visitor_identity_id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        const consents = await tx.execute(sql`select purpose,version,granted_at,revoked_at,created_at from kablet_consents where visitor_identity_id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid order by created_at asc`);
        const visitorConsents = await tx.execute(sql`select purpose,version,status,source_observation_id,idempotency_key,created_at from visitor_consents where visitor_identity_id=${input.visitorId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid order by created_at asc`);
        return { visitor: visitor.rows[0] ?? null, sessions: sessions.rows, observations: observations.rows, decisions: decisions.rows, exposures: exposures.rows, actions: actions.rows, outcomes: outcomes.rows, facts: facts.rows, aiInvocations: aiInvocations.rows, consents: consents.rows, visitorConsents: visitorConsents.rows };
      });
    },
    async deleteVisitor(input: { organizationId: string; businessId: string; visitorId: string }) {
      return tenant(db, input.organizationId, input.businessId, async tx => {
        return tx.execute(sql`select public.kablet_visitor_privacy_delete(${input.organizationId}::uuid,${input.visitorId}::uuid) as deleted`);
      });
    },
    async saveProviderCredential(input: { organizationId: string; businessId: string; providerKey: string; secret: string; keyVersion: string; scopes: string[]; createdBy: string }, vault: ReturnType<typeof createCredentialVault>) {
      const encrypted = vault.encrypt(input.secret);
      return tenant(db, input.organizationId, input.businessId, async tx => tx.execute(sql`insert into kablet_provider_credentials(id,organization_id,business_id,provider_key,encrypted_secret,key_version,scopes,created_by) values (${randomUUID()}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.providerKey},${encrypted.ciphertext},${encrypted.keyVersion},${JSON.stringify(input.scopes)}::jsonb,${input.createdBy}::uuid) on conflict (organization_id,business_id,provider_key) do update set encrypted_secret=excluded.encrypted_secret,key_version=excluded.key_version,scopes=excluded.scopes,status='active',revoked_at=null returning id,provider_key,key_version,scopes,status`));
    },
    async readProviderCredentialSecret(input: { organizationId: string; businessId: string; providerKey: string }, vault: ReturnType<typeof createCredentialVault>) {
      return tenant(db, input.organizationId, input.businessId, async tx => {
        const row = await tx.execute(sql`select encrypted_secret,key_version,status from kablet_provider_credentials where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and provider_key=${input.providerKey}`);
        const credential = row.rows[0] as { encrypted_secret: Buffer; key_version: string; status: string } | undefined;
        if (!credential || credential.status !== 'active') throw new Error('provider credential unavailable');
        return vault.decrypt({ ciphertext: credential.encrypted_secret, keyVersion: credential.key_version });
      });
    },
    async revokeProviderCredential(input: { organizationId: string; businessId: string; providerKey: string }) { return tenant(db, input.organizationId, input.businessId, async tx => tx.execute(sql`update kablet_provider_credentials set status='revoked',revoked_at=now() where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and provider_key=${input.providerKey}`)); },
    async audit(input: { organizationId: string; businessId?: string; actorId?: string; actorType: string; action: string; resourceType: string; resourceId?: string; metadata?: Record<string, unknown> }) {
      return tenant(db, input.organizationId, input.businessId ?? input.organizationId, async tx => tx.execute(sql`insert into kablet_audit_events(id,organization_id,business_id,actor_id,actor_type,action,resource_type,resource_id,metadata) values (${randomUUID()}::uuid,${input.organizationId}::uuid,${input.businessId ? sql`${input.businessId}::uuid` : sql`null`},${input.actorId ? sql`${input.actorId}::uuid` : sql`null`},${input.actorType},${input.action},${input.resourceType},${input.resourceId ? sql`${input.resourceId}::uuid` : sql`null`},${JSON.stringify(safeAuditMetadata(input.metadata ?? {}))}::jsonb)`));
    },
  };
}
