import { sql } from 'drizzle-orm';
import { nativeStorefrontSchema, type NativeStorefront } from '@kablet/domain';
import type { Database } from './index.js';

export function createNativeStoreRepository(db: Database['db']) {
  return {
    async getPublishedStorefront(publicSlug: string): Promise<NativeStorefront | null> {
      const result = await db.transaction(async tx => {
        const store = await tx.execute(sql`
          select id, organization_id, business_id, public_slug, name, brand_mark, primary_currency, status
          from kablet_native_stores
          where public_slug = ${publicSlug} and status = 'published'
          limit 1
        `);
        if (store.rows.length === 0) return null;
        const row = store.rows[0] as Record<string, unknown>;
        await tx.execute(sql`select set_config('kablet.organization_id', ${String(row.organization_id)}, true), set_config('kablet.business_id', ${String(row.business_id)}, true)`);
        const products = await tx.execute(sql`
          select id, store_id, public_slug, title, description, image_url, amount_minor::text, currency, status, availability
          from kablet_native_products
          where store_id = ${String(row.id)}::uuid and status = 'published'
          order by title asc, id asc
        `);
        return {
          id: String(row.id), organizationId: String(row.organization_id), businessId: String(row.business_id),
          publicSlug: String(row.public_slug), name: String(row.name), brandMark: row.brand_mark === null ? null : String(row.brand_mark),
          primaryCurrency: String(row.primary_currency), status: String(row.status),
          products: products.rows.map(product => { const value = product as Record<string, unknown>; return {
            id: String(value.id), storeId: String(value.store_id), slug: String(value.public_slug), title: String(value.title), description: String(value.description),
            imageUrl: value.image_url === null ? null : String(value.image_url), amountMinor: String(value.amount_minor), currency: String(value.currency), status: String(value.status), availability: String(value.availability),
          }; }),
        };
      });
      return result === null ? null : nativeStorefrontSchema.parse(result);
    },
  };
}
