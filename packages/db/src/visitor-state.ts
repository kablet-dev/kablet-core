import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from './index.js';
import { emptyVisitorState, observationSchema, reduceVisitorStateFromEvidence, visitorStateSchema } from '@kablet/domain';
import type { Observation } from '@kablet/domain';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

async function context<T>(db: Database['db'], organizationId: string, businessId: string, fn: (tx: Tx) => Promise<T>) {
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(businessId)) throw new Error('invalid tenant context');
  return db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true)`);
    const business = await tx.execute(sql`select 1 from businesses where id=${businessId}::uuid and organization_id=${organizationId}::uuid and active`);
    if (!business.rows[0]) throw new Error('business does not belong to organization');
    await tx.execute(sql`select set_config('kablet.business_id', ${businessId}, true)`);
    return fn(tx);
  });
}

export function createVisitorStateRepository(db: Database['db']) {
  return {
    async createVisitor(organizationId: string, businessId: string, retentionExpiresAt: Date) {
      return context(db, organizationId, businessId, async tx => {
        const visitorId = randomUUID(); const revisionId = randomUUID();
        await tx.execute(sql`insert into visitor_identities (id,organization_id,business_id,retention_expires_at) values (${visitorId}::uuid,${organizationId}::uuid,${businessId}::uuid,${retentionExpiresAt})`);
        await tx.execute(sql`insert into visitor_state_revisions (id,organization_id,business_id,visitor_identity_id,version,state) values (${revisionId}::uuid,${organizationId}::uuid,${businessId}::uuid,${visitorId}::uuid,0,${JSON.stringify(emptyVisitorState)}::jsonb)`);
        await tx.execute(sql`insert into visitor_states (visitor_identity_id,organization_id,business_id,current_revision_id,version) values (${visitorId}::uuid,${organizationId}::uuid,${businessId}::uuid,${revisionId}::uuid,0)`);
        return visitorId;
      });
    },
    async createSession(organizationId: string, businessId: string, visitorId: string) {
      return context(db, organizationId, businessId, async tx => { const id = randomUUID(); await tx.execute(sql`insert into visitor_sessions (id,organization_id,business_id,visitor_identity_id) values (${id}::uuid,${organizationId}::uuid,${businessId}::uuid,${visitorId}::uuid)`); return id; });
    },
    async getCurrentState(organizationId: string, businessId: string, visitorId: string) {
      return context(db, organizationId, businessId, async tx => {
        const result = await tx.execute(sql`select s.version, s.current_revision_id, r.state from visitor_states s join visitor_state_revisions r on r.id = s.current_revision_id where s.visitor_identity_id=${visitorId}::uuid`);
        if (!result.rows[0]) throw new Error('visitor state not found');
        const row = result.rows[0];
        return { version: Number(row.version), revisionId: String(row.current_revision_id), state: visitorStateSchema.parse(row.state) };
      });
    },
    async ingest(organizationId: string, input: unknown) {
      const observation = observationSchema.parse(input);
      if (observation.organizationId !== organizationId) throw new Error('observation organization mismatch');
      return context(db, organizationId, observation.businessId, async tx => {
        const duplicate = await tx.execute(sql`select id, kind, value from visitor_observations where organization_id=${organizationId}::uuid and visitor_identity_id=${observation.visitorIdentityId}::uuid and idempotency_key=${observation.idempotencyKey}`);
        if (duplicate.rows[0]) {
          const sameKind = duplicate.rows[0].kind === observation.kind;
          const sameValue = canonicalJson(duplicate.rows[0].value) === canonicalJson(observation.value);
          if (!sameKind || !sameValue) throw new Error('observation idempotency key conflicts with a different input');
          return { idempotent: true, revisionId: null };
        }
        const owner = await tx.execute(sql`select 1 from visitor_sessions where id=${observation.sessionId}::uuid and organization_id=${organizationId}::uuid and business_id=${observation.businessId}::uuid and visitor_identity_id=${observation.visitorIdentityId}::uuid and status='active'`);
        if (!owner.rows[0]) throw new Error('session does not belong to visitor and business');
        if (observation.correctionOfObservationId) {
          const target = await tx.execute(sql`select 1 from visitor_observations where id=${observation.correctionOfObservationId}::uuid and organization_id=${organizationId}::uuid and business_id=${observation.businessId}::uuid and visitor_identity_id=${observation.visitorIdentityId}::uuid`);
          if (!target.rows[0]) throw new Error('correction target does not belong to visitor');
        }
        if (observation.kind === 'offering.selected' && observation.value.type === 'offering') {
          const published = await tx.execute(sql`select 1 from offering_publications p join business_offerings o on o.id=p.offering_id join businesses b on b.id=o.business_id and b.organization_id=${organizationId}::uuid where p.offering_id=${observation.value.offeringId}::uuid and p.revision_id=${observation.value.publishedRevisionId}::uuid and b.id=${observation.businessId}::uuid`);
          if (!published.rows[0]) throw new Error('selected Business Truth revision is not currently published for this business');
        }
        const current = await tx.execute(sql`select s.version,s.current_revision_id,r.state from visitor_states s join visitor_state_revisions r on r.id=s.current_revision_id where s.visitor_identity_id=${observation.visitorIdentityId}::uuid for update`);
        if (!current.rows[0]) throw new Error('visitor state not found');
        const actualVersion = Number(current.rows[0].version);
        if (observation.expectedVersion !== undefined && observation.expectedVersion !== actualVersion) throw new Error('visitor state stale-version conflict');
        const priorRows = await tx.execute(sql`select id,organization_id,business_id,visitor_identity_id,session_id,kind,value,idempotency_key,observed_at,source_type,source_reference,correction_of_observation_id from visitor_observations where visitor_identity_id=${observation.visitorIdentityId}::uuid order by observed_at asc, id asc`);
        const prior = priorRows.rows.map(row => observationSchema.parse({ id: row.id, organizationId: row.organization_id, businessId: row.business_id, visitorIdentityId: row.visitor_identity_id, sessionId: row.session_id, kind: row.kind, value: row.value, idempotencyKey: row.idempotency_key, observedAt: row.observed_at, sourceType: row.source_type, sourceReference: row.source_reference, correctionOfObservationId: row.correction_of_observation_id }));
        const previous = visitorStateSchema.parse(current.rows[0].state);
        const next = reduceVisitorStateFromEvidence([...prior, observation as Observation]);
        await tx.execute(sql`insert into visitor_observations (id,organization_id,business_id,visitor_identity_id,session_id,kind,value,idempotency_key,observed_at,source_type,source_reference,correction_of_observation_id) values (${observation.id}::uuid,${organizationId}::uuid,${observation.businessId}::uuid,${observation.visitorIdentityId}::uuid,${observation.sessionId}::uuid,${observation.kind},${JSON.stringify(observation.value)}::jsonb,${observation.idempotencyKey},${observation.observedAt},${observation.sourceType},${observation.sourceReference},${observation.correctionOfObservationId}::uuid)`);
        if (JSON.stringify(previous) === JSON.stringify(next)) return { idempotent: false, revisionId: null };
        const revisionId = randomUUID(); const version = actualVersion + 1;
        await tx.execute(sql`insert into visitor_state_revisions (id,organization_id,business_id,visitor_identity_id,version,state,derived_from_revision_id,accepted_observation_id) values (${revisionId}::uuid,${organizationId}::uuid,${observation.businessId}::uuid,${observation.visitorIdentityId}::uuid,${version},${JSON.stringify(next)}::jsonb,${current.rows[0].current_revision_id}::uuid,${observation.id}::uuid)`);
        const updated = await tx.execute(sql`update visitor_states set current_revision_id=${revisionId}::uuid,version=${version},updated_at=now() where visitor_identity_id=${observation.visitorIdentityId}::uuid and version=${actualVersion} returning version`);
        if (updated.rows.length !== 1) throw new Error('visitor state concurrency conflict');
        return { idempotent: false, revisionId };
      });
    },
    async anonymize(organizationId: string, visitorId: string, businessId: string) {
      return context(db, organizationId, businessId, async tx => (await tx.execute(sql`select public.kablet_visitor_privacy_delete(${organizationId}::uuid,${visitorId}::uuid) as deleted`)).rows[0].deleted);
    },
  };
}
