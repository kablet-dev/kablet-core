import { sql } from 'drizzle-orm';
import { nativeAttributionSchema, type NativeAttribution } from '@kablet/domain';
import type { Database } from './index.js';

export function createNativeAttributionRepository(db: Database['db']) {
  return {
    async getByOrder(input: { organizationId: string; businessId: string; storeId: string; orderId: string }): Promise<NativeAttribution | null> {
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
        const result = await tx.execute(sql`select * from kablet_native_order_attributions where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and store_id=${input.storeId}::uuid and order_id=${input.orderId}::uuid`);
        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        return nativeAttributionSchema.parse({
          contractVersion: 'native-attribution.v1', attributionId: row.id, organizationId: row.organization_id, businessId: row.business_id, storeId: row.store_id,
          orderId: row.order_id, checkoutId: row.checkout_id, visitorIdentityId: row.visitor_identity_id, visitorSessionId: row.visitor_session_id,
          interactionSessionId: row.interaction_session_id, decisionId: row.decision_id, exposureId: row.exposure_id,
          compositionId: row.composition_id, compositionVersion: row.composition_version, rule: row.rule, status: row.status,
          currency: row.currency, revenueAmountMinor: String(row.revenue_amount_minor), purchaseAt: row.purchase_at,
        });
      });
    },
  };
}
