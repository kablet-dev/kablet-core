import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from './index.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
const uuid = /^[0-9a-f-]{36}$/i;
function hashHandle(handle: string): Buffer { return createHash('sha256').update(handle, 'utf8').digest(); }
function assertUuid(value: string): void { if (!uuid.test(value)) throw new Error('invalid interaction context'); }

async function scoped<T>(db: Database['db'], organizationId: string, businessId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  assertUuid(organizationId); assertUuid(businessId);
  return db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true)`);
    const business = await tx.execute(sql`select 1 from businesses where id=${businessId}::uuid and organization_id=${organizationId}::uuid and active`);
    if (!business.rows[0]) throw new Error('business does not belong to organization');
    await tx.execute(sql`select set_config('kablet.business_id', ${businessId}, true)`);
    return fn(tx);
  });
}

export function createInteractionSessionRepository(db: Database['db']) {
  return {
    async create(organizationId: string, businessId: string, visitorIdentityId: string, visitorSessionId: string, expiresAt: Date) {
      const handle = randomBytes(32).toString('base64url');
      await scoped(db, organizationId, businessId, async tx => { await tx.execute(sql`insert into interaction_sessions (id,handle_hash,organization_id,business_id,visitor_identity_id,visitor_session_id,expires_at) values (${randomUUID()}::uuid,${hashHandle(handle)},${organizationId}::uuid,${businessId}::uuid,${visitorIdentityId}::uuid,${visitorSessionId}::uuid,${expiresAt})`); });
      return handle;
    },
    async resolve(organizationId: string, businessId: string, handle: string) {
      return scoped(db, organizationId, businessId, async tx => {
        const result = await tx.execute(sql`select visitor_identity_id, visitor_session_id from interaction_sessions where handle_hash=${hashHandle(handle)} and status='active' and expires_at > now()`);
        if (!result.rows[0]) return null;
        return { visitorIdentityId: String(result.rows[0].visitor_identity_id), visitorSessionId: String(result.rows[0].visitor_session_id) };
      });
    },
    async revoke(organizationId: string, businessId: string, handle: string) {
      return scoped(db, organizationId, businessId, async tx => { const result = await tx.execute(sql`update interaction_sessions set status='revoked', revoked_at=now() where handle_hash=${hashHandle(handle)} and status='active' returning id`); return result.rows.length === 1; });
    },
  };
}
