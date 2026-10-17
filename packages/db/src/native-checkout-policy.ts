import { sql } from 'drizzle-orm';
import { nativeShippingAddressSchema, type NativeShippingAddress } from '@kablet/domain';
import type { Database } from './index.js';
import type { NativeCheckoutPolicyResult } from './native-checkout.js';

export type NativeCheckoutPolicyContext = { organizationId: string; businessId: string; storeId: string };

export function createNativeCheckoutPolicyRepository(db: Database['db']) {
  return {
    async calculate(input: NativeCheckoutPolicyContext & { currency: string; shippingAddress: NativeShippingAddress | null; subtotalMinor: bigint; requiresShipping: boolean }): Promise<NativeCheckoutPolicyResult & { policyId: string; policyRevision: number }> {
      const address = input.shippingAddress ? nativeShippingAddressSchema.parse(input.shippingAddress) : null;
      return db.transaction(async tx => {
        await tx.execute(sql`select set_config('kablet.organization_id', ${input.organizationId}, true), set_config('kablet.business_id', ${input.businessId}, true)`);
        const result = await tx.execute(sql`select id, revision, eligible_countries, shipping_amount_minor::text, tax_rate_bps from kablet_native_checkout_policies where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and store_id=${input.storeId}::uuid and status='active' and currency=${input.currency} order by revision desc limit 2`);
        if (result.rows.length !== 1) throw new Error('checkout_policy_unavailable');
        const row = result.rows[0] as Record<string, unknown>;
        const countries = (row.eligible_countries as unknown[]).map(String);
        if (input.requiresShipping && (!address || !countries.includes(address.countryCode))) throw new Error('shipping_country_ineligible');
        const shipping = BigInt(String(row.shipping_amount_minor));
        const effectiveShipping = input.requiresShipping ? shipping : 0n;
        const tax = ((input.subtotalMinor + effectiveShipping) * BigInt(Number(row.tax_rate_bps))) / 10000n;
        const total = input.subtotalMinor + effectiveShipping + tax;
        return {
          shippingEligibility: input.requiresShipping ? 'eligible' : 'not_required',
          shippingCharge: input.requiresShipping ? { state: 'calculated', amountMinor: shipping.toString(), currency: input.currency } : { state: 'not_calculated', amountMinor: null, currency: null },
          tax: { state: 'calculated', amountMinor: tax.toString(), currency: input.currency },
          serverTotal: { state: 'calculated', amountMinor: total.toString(), currency: input.currency },
          policyId: String(row.id), policyRevision: Number(row.revision),
        };
      });
    },
  };
}
