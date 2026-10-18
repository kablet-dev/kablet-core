import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ids = {
  organization: '8d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a3001',
  business: '8d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a3002',
  store: '8d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a3006',
  products: [
    '8d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a3007',
    '8d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a3008',
    '8d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a3009',
    '8d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a3010',
    '8d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a3011',
  ],
};

const assetRoot = resolve(process.cwd(), 'apps/web/public/demo/solenne');
const publicOrigin = process.env.SOLENNE_PUBLIC_ORIGIN ?? 'http://127.0.0.1:3000';
const requiredAssets = [
  'products/daily-hydration-serum.png',
  'products/barrier-comfort-cream.png',
  'products/gentle-cleansing-gel.png',
  'products/vitamin-c-radiance-serum.png',
  'products/overnight-nourishing-mask.png',
];

function requireDevelopmentDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('refusing to seed SOLENNE with NODE_ENV=production');
  if (process.env.SOLENNE_DEMO_SEED_ENABLED !== 'true') throw new Error('set SOLENNE_DEMO_SEED_ENABLED=true to opt into the SOLENNE development fixture seed');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  const target = `${url.hostname}/${url.pathname}`.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || /(prod|production|stage|staging|shared)/.test(target)) throw new Error('refusing to seed a non-local or shared database');
}

function requireLocalAssets() {
  const missing = requiredAssets.filter(asset => !existsSync(resolve(assetRoot, asset)));
  if (missing.length > 0) throw new Error(`SOLENNE assets are missing under ${assetRoot}:\n${missing.map(asset => `- ${asset}`).join('\n')}`);
}

async function main() {
  requireDevelopmentDatabase();
  requireLocalAssets();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('kablet.organization_id',$1,true),set_config('kablet.business_id',$2,true)", [ids.organization, ids.business]);
    await client.query("insert into organizations(id,name) values($1,'SOLENNE Development Fixture') on conflict(id) do update set name=excluded.name", [ids.organization]);
    await client.query("insert into businesses(id,organization_id,name) values($1,$2,'SOLENNE Development Fixture') on conflict(id) do update set name=excluded.name,active=true", [ids.business, ids.organization]);
    if (process.env.KABLET_AI_LIVE_SMOKE === 'true') {
      await client.query("insert into ai_intent_accounting_periods(id,organization_id,business_id,period_kind,period_start,period_end,max_units) values(gen_random_uuid(),$1,$2,'daily',current_date,current_date+1,10),(gen_random_uuid(),$1,$2,'monthly',date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month')::date,10) on conflict (organization_id,business_id,period_kind,period_start) do nothing", [ids.organization, ids.business]);
    }
    await client.query("insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,brand_mark,primary_currency,status) values($1,$2,$3,'solenne-demo','SOLENNE','S','USD','published') on conflict(id) do update set name=excluded.name,brand_mark=excluded.brand_mark,primary_currency=excluded.primary_currency,status=excluded.status,updated_at=now()", [ids.store, ids.organization, ids.business]);
    const products = [
      [ids.products[0], 'daily-hydration-serum', 'SOLENNE-SERUM-001', 'Daily Hydration Serum', '30 mL. A hydration-focused serum with hyaluronic acid and glycerin, described for a simple daily skincare routine.', '3800', 18, 'available', 'products/daily-hydration-serum.png'],
      [ids.products[1], 'barrier-comfort-cream', 'SOLENNE-CREAM-001', 'Barrier Comfort Cream', '50 mL. A moisturizing cream with ceramides and squalane, positioned for everyday barrier-care routines.', '4600', 12, 'available', 'products/barrier-comfort-cream.png'],
      [ids.products[2], 'gentle-cleansing-gel', 'SOLENNE-CLEANSER-001', 'Gentle Cleansing Gel', '150 mL. A mild daily cleanser with a light gel texture for a straightforward cleansing step.', '2800', 24, 'available', 'products/gentle-cleansing-gel.png'],
      [ids.products[3], 'vitamin-c-radiance-serum', 'SOLENNE-SERUM-002', 'Vitamin C Radiance Serum', '30 mL. A vitamin C skincare serum with appearance-focused positioning for a considered morning routine.', '5200', 0, 'unavailable', 'products/vitamin-c-radiance-serum.png'],
      [ids.products[4], 'overnight-nourishing-mask', 'SOLENNE-MASK-001', 'Overnight Nourishing Mask', '75 mL. A rich overnight moisturizer designed as the final step in an evening skincare routine.', '4400', null, 'unknown', 'products/overnight-nourishing-mask.png'],
    ];
    for (const [id, slug, sku, title, description, amount, inventoryQuantity, availability, asset] of products) {
      const imageUrl = new URL(`/demo/solenne/${asset}`, publicOrigin).toString();
      await client.query("insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,sku,title,description,image_url,amount_minor,currency,inventory_quantity,price_revision,status,availability) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'USD',$11,1,'published',$12) on conflict(id) do update set sku=excluded.sku,title=excluded.title,description=excluded.description,image_url=excluded.image_url,amount_minor=excluded.amount_minor,currency=excluded.currency,inventory_quantity=excluded.inventory_quantity,price_revision=excluded.price_revision,status=excluded.status,availability=excluded.availability,updated_at=now()", [id, ids.store, ids.organization, ids.business, slug, sku, title, description, imageUrl, amount, inventoryQuantity, availability]);
    }
    await client.query('commit');
    console.log('SOLENNE development fixture seeded at /store/solenne-demo');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'SOLENNE demo seed failed'); process.exitCode = 1; });
