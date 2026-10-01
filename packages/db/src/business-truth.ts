import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Database } from './index.js';
import { offeringRevisionSchema } from '@kablet/domain';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

export async function withTenantContext<T>(db: Database['db'], organizationId: string, operation: (tx: Tx) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) throw new Error('invalid organization context');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true)`);
    return operation(tx);
  });
}

export function createBusinessTruthRepository(db: Database['db']) {
  return {
    async createRevision(organizationId: string, input: unknown) {
      const revision = offeringRevisionSchema.parse(input);
      return withTenantContext(db, organizationId, async (tx) => {
        const p = revision.pricing;
        const result = await tx.execute(sql`insert into business_offering_revisions (id, offering_id, revision_number, name, description, pricing_kind, currency, amount_minor, visibility, approval_status, provenance_source_type, provenance_source_reference, provenance_captured_at, provenance_captured_by) values (${randomUUID()}::uuid, ${revision.offeringId}::uuid, ${revision.revisionNumber}, ${revision.name}, ${revision.description}, ${p.kind}, ${p.kind === 'fixed' ? p.currency : null}, ${p.kind === 'fixed' ? p.amountMinor : null}, ${revision.visibility}, ${revision.approvalStatus}, ${revision.provenance.sourceType}, ${revision.provenance.sourceReference}, ${revision.provenance.capturedAt}, ${revision.provenance.capturedBy}) returning *`);
        return result.rows[0];
      });
    },
    async publish(organizationId: string, offeringId: string, revisionId: string) {
      return withTenantContext(db, organizationId, async (tx) => tx.execute(sql`insert into offering_publications (offering_id, revision_id) values (${offeringId}::uuid, ${revisionId}::uuid) on conflict (offering_id) do update set revision_id = excluded.revision_id, published_at = now() returning *`));
    },
    async unpublish(organizationId: string, offeringId: string) {
      return withTenantContext(db, organizationId, async (tx) => tx.execute(sql`delete from offering_publications where offering_id = ${offeringId}::uuid`));
    },
    async getPublicOffering(organizationId: string, offeringId: string) {
      return withTenantContext(db, organizationId, async (tx) => {
        const result = await tx.execute(sql`select p.revision_id as revision_id, o.id as offering_id, o.name as offering_name, r.* from offering_publications p join business_offerings o on o.id = p.offering_id and o.active join businesses b on b.id = o.business_id and b.active join business_offering_revisions r on r.id = p.revision_id and r.approval_status = 'approved' and r.visibility = 'public' where p.offering_id = ${offeringId}::uuid`);
        return result.rows[0] ?? null;
      });
    },
  };
}
