import { sql } from 'drizzle-orm';
import { acquisitionContextSchema, type AcquisitionContext } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';

export function createAcquisitionRepository(db: Database['db'], existingTx?: DatabaseTransaction) {
  return {
    async insert(input: AcquisitionContext): Promise<void> {
      const run = async (tx: DatabaseTransaction) => {
        await tx.execute(sql`insert into acquisition_contexts (id, organization_id, business_id, visitor_identity_id, visitor_session_id, interaction_session_id, captured_at, landing_path, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term) values (${input.id}::uuid, ${input.organizationId}::uuid, ${input.businessId}::uuid, ${input.visitorIdentityId}::uuid, ${input.visitorSessionId}::uuid, ${input.interactionSessionId}::uuid, ${input.capturedAt}, ${input.landingPath}, ${input.referrer}, ${input.utmSource}, ${input.utmMedium}, ${input.utmCampaign}, ${input.utmContent}, ${input.utmTerm})`);
      };
      if (existingTx) await run(existingTx); else await db.transaction(run);
    },
    async getByInteractionSession(organizationId: string, businessId: string, interactionSessionId: string): Promise<AcquisitionContext | null> {
      const run = async (tx: DatabaseTransaction) => {
        const result = await tx.execute(sql`select id, organization_id, business_id, visitor_identity_id, visitor_session_id, interaction_session_id, captured_at, landing_path, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term from acquisition_contexts where organization_id=${organizationId}::uuid and business_id=${businessId}::uuid and interaction_session_id=${interactionSessionId}::uuid`);
        const row = result.rows[0];
        return row ? acquisitionContextSchema.parse({ contractVersion: 'acquisition-context.v1', id: row.id, organizationId: row.organization_id, businessId: row.business_id, visitorIdentityId: row.visitor_identity_id, visitorSessionId: row.visitor_session_id, interactionSessionId: row.interaction_session_id, capturedAt: row.captured_at, landingPath: row.landing_path, referrer: row.referrer, utmSource: row.utm_source, utmMedium: row.utm_medium, utmCampaign: row.utm_campaign, utmContent: row.utm_content, utmTerm: row.utm_term }) : null;
      };
      return existingTx ? run(existingTx) : db.transaction(run);
    },
  };
}
