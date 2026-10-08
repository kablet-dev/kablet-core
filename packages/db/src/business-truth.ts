import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Database, DatabaseTransaction } from './index.js';
import { offeringRevisionSchema } from '@kablet/domain';

type Tx = DatabaseTransaction;

export async function withTenantContext<T>(db: Database['db'], organizationId: string, operation: (tx: Tx) => Promise<T>, existingTx?: Tx): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) throw new Error('invalid organization context');
  const run = async (tx: Tx) => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true)`);
    return operation(tx);
  };
  return existingTx ? run(existingTx) : db.transaction(run);
}

export function createBusinessTruthRepository(db: Database['db'], existingTx?: Tx) {
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
    async listPublicOfferings(organizationId: string, businessId: string) {
      return withTenantContext(db, organizationId, async tx => {
        await tx.execute(sql`select set_config('kablet.business_id', ${businessId}, true)`);
        const result = await tx.execute(sql`select p.offering_id, p.revision_id as offering_revision_id, r.name, r.description, r.pricing_kind, r.currency, r.amount_minor from offering_publications p join business_offerings o on o.id=p.offering_id and o.business_id=${businessId}::uuid and o.active join businesses b on b.id=o.business_id and b.active join business_offering_revisions r on r.id=p.revision_id and r.approval_status='approved' and r.visibility='public' order by r.name`);
        return result.rows.map(row => ({ offeringId: String(row.offering_id), offeringRevisionId: String(row.offering_revision_id), name: String(row.name), description: String(row.description), priceLabel: row.pricing_kind === 'fixed' && row.currency !== null && row.amount_minor !== null ? `${String(row.currency)} ${String(row.amount_minor)}` : 'Price available on request' }));
      }, existingTx);
    },
    async getOfferingsByReferences(organizationId: string, businessId: string, references: Array<{ offeringId: string; offeringRevisionId: string }>, existingTx?: Tx) {
      if (references.length === 0) return [];
      return withTenantContext(db, organizationId, async tx => {
        await tx.execute(sql`select set_config('kablet.business_id', ${businessId}, true)`);
        const result = await tx.execute(sql`
          select r.offering_id, r.id as offering_revision_id, r.name, r.description,
                 r.pricing_kind, r.currency, r.amount_minor
          from business_offering_revisions r
          join business_offerings o on o.id = r.offering_id and o.business_id = ${businessId}::uuid
          where (${sql.join(references.map(reference => sql`(r.offering_id = ${reference.offeringId}::uuid and r.id = ${reference.offeringRevisionId}::uuid)`), sql` or `)})
        `);
        return result.rows.map(row => ({ offeringId: String(row.offering_id), offeringRevisionId: String(row.offering_revision_id), name: String(row.name), description: String(row.description), priceLabel: row.pricing_kind === 'fixed' && row.currency !== null && row.amount_minor !== null ? `${String(row.currency)} ${String(row.amount_minor)}` : 'Price available on request' }));
      }, existingTx);
    },
  };
}
