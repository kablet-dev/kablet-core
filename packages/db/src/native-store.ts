import { sql } from 'drizzle-orm';
import { nativeInventoryStateSchema, nativeStorefrontSchema, type NativeInventoryAvailability, type NativeInventoryState, type NativeStorefront } from '@kablet/domain';
import type { Database } from './index.js';

async function tenant<T>(db: Database['db'], organizationId: string, businessId: string, work: (tx: Parameters<Parameters<Database['db']['transaction']>[0]>[0]) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.execute(sql`select set_config('kablet.organization_id', ${organizationId}, true), set_config('kablet.business_id', ${businessId}, true)`);
    return work(tx);
  });
}

function inventoryState(row: Record<string, unknown>): NativeInventoryState {
  return nativeInventoryStateSchema.parse({
    productId: String(row.id),
    sku: String(row.sku),
    inventoryQuantity: Number(row.inventory_quantity),
    availability: String(row.availability),
  });
}

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
          select id, store_id, public_slug, sku, title, description, image_url, amount_minor::text, currency, inventory_quantity, price_revision, status, availability, fulfillment_type
          from kablet_native_products
          where store_id = ${String(row.id)}::uuid and status = 'published'
          order by title asc, id asc
        `);
        return {
          id: String(row.id), organizationId: String(row.organization_id), businessId: String(row.business_id),
          publicSlug: String(row.public_slug), name: String(row.name), brandMark: row.brand_mark === null ? null : String(row.brand_mark),
          primaryCurrency: String(row.primary_currency), status: String(row.status),
          products: products.rows.map(product => { const value = product as Record<string, unknown>; return {
            id: String(value.id), storeId: String(value.store_id), slug: String(value.public_slug), sku: String(value.sku), title: String(value.title), description: String(value.description),
            imageUrl: value.image_url === null ? null : String(value.image_url), amountMinor: String(value.amount_minor), currency: String(value.currency), inventoryQuantity: value.inventory_quantity === null ? null : Number(value.inventory_quantity), priceRevision: Number(value.price_revision), status: String(value.status), availability: String(value.availability), fulfillmentType: String(value.fulfillment_type ?? 'physical'),
          }; }),
        };
      });
      return result === null ? null : nativeStorefrontSchema.parse(result);
    },
    async setInventory(input: { organizationId: string; businessId: string; productId: string; quantity: number; availability: NativeInventoryAvailability }): Promise<NativeInventoryState | null> {
      if (!Number.isInteger(input.quantity) || input.quantity < 0) throw new Error('inventory_quantity_invalid');
      return tenant(db, input.organizationId, input.businessId, async tx => {
        const result = await tx.execute(sql`
          update kablet_native_products
          set inventory_quantity = ${input.quantity}, availability = ${input.availability}, inventory_updated_at = now(), updated_at = now()
          where id = ${input.productId}::uuid and organization_id = ${input.organizationId}::uuid and business_id = ${input.businessId}::uuid
          returning id, sku, inventory_quantity, availability
        `);
        return result.rows[0] ? inventoryState(result.rows[0] as Record<string, unknown>) : null;
      });
    },
    async decrementInventory(input: { organizationId: string; businessId: string; productId: string; quantity: number }): Promise<NativeInventoryState | null> {
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('inventory_quantity_invalid');
      return tenant(db, input.organizationId, input.businessId, async tx => {
        const result = await tx.execute(sql`
          update kablet_native_products
          set inventory_quantity = inventory_quantity - ${input.quantity},
              availability = case when inventory_quantity = ${input.quantity} then 'unavailable' else availability end,
              inventory_updated_at = now(), updated_at = now()
          where id = ${input.productId}::uuid and organization_id = ${input.organizationId}::uuid and business_id = ${input.businessId}::uuid
            and status = 'published' and availability = 'available' and inventory_quantity is not null and inventory_quantity >= ${input.quantity}
          returning id, sku, inventory_quantity, availability
        `);
        return result.rows[0] ? inventoryState(result.rows[0] as Record<string, unknown>) : null;
      });
    },
  };
}
