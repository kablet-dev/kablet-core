import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ids = {
  organization: '7d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a2001',
  business: '7d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a2002',
  store: '7d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a2006',
  products: [
    '7d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a2007',
    '7d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a2008',
    '7d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a2009',
    '7d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a2010',
  ],
};

const assetRoot = resolve(process.cwd(), 'apps/web/public/demo/velora');
const requiredAssets = [
  'editorial/velora-botanical-campaign.jpg',
  'products/botanical-veil-cleanser.jpg',
  'products/canopy-dew-serum.jpg',
  'products/mosslight-barrier-cream.jpg',
  'products/sunlit-herb-balm.jpg',
];

function requireDevelopmentDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('refusing to seed VELORA with NODE_ENV=production');
  if (process.env.VELORA_DEMO_SEED_ENABLED !== 'true') throw new Error('set VELORA_DEMO_SEED_ENABLED=true to opt into the VELORA development fixture seed');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  const target = `${url.hostname}/${url.pathname}`.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || /(prod|production|stage|staging|shared)/.test(target)) throw new Error('refusing to seed a non-local or shared database');
}

function requireLocalAssets() {
  const missing = requiredAssets.filter(asset => !existsSync(resolve(assetRoot, asset)));
  if (missing.length > 0) throw new Error(`VELORA assets are missing under ${assetRoot}:\n${missing.map(asset => `- ${asset}`).join('\n')}\nSee docs/demo/VELORA_ASSET_MANIFEST.md before retrying.`);
}

async function main() {
  requireDevelopmentDatabase();
  requireLocalAssets();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('kablet.organization_id',$1,true),set_config('kablet.business_id',$2,true)", [ids.organization, ids.business]);
    await client.query("insert into organizations(id,name) values($1,'VELORA Development Fixture') on conflict(id) do update set name=excluded.name", [ids.organization]);
    await client.query("insert into businesses(id,organization_id,name) values($1,$2,'VELORA Development Fixture') on conflict(id) do update set name=excluded.name,active=true", [ids.business, ids.organization]);
    await client.query("insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,brand_mark,primary_currency,status) values($1,$2,$3,'velora-demo','VELORA','V','USD','published') on conflict(id) do update set name=excluded.name,brand_mark=excluded.brand_mark,primary_currency=excluded.primary_currency,status=excluded.status,updated_at=now()", [ids.store, ids.organization, ids.business]);
    const products = [
      [ids.products[0], 'botanical-veil-cleanser', 'Botanical Veil Cleanser', 'A 150 ml cleanser in the VELORA botanical collection.', '2400', 'products/botanical-veil-cleanser.jpg'],
      [ids.products[1], 'canopy-dew-serum', 'Canopy Dew Serum', 'A 30 ml serum in the VELORA botanical collection.', '3600', 'products/canopy-dew-serum.jpg'],
      [ids.products[2], 'mosslight-barrier-cream', 'Mosslight Barrier Cream', 'A 50 ml cream in the VELORA botanical collection.', '4200', 'products/mosslight-barrier-cream.jpg'],
      [ids.products[3], 'sunlit-herb-balm', 'Sunlit Herb Balm', 'A 30 ml balm in the VELORA botanical collection.', '2800', 'products/sunlit-herb-balm.jpg'],
    ];
    for (const [id, slug, title, description, amount, asset] of products) {
      const imageUrl = `http://127.0.0.1:3000/demo/velora/${asset}`;
      await client.query("insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,title,description,image_url,amount_minor,currency,status,availability) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'USD','published','available') on conflict(id) do update set title=excluded.title,description=excluded.description,image_url=excluded.image_url,amount_minor=excluded.amount_minor,currency=excluded.currency,status=excluded.status,availability=excluded.availability,updated_at=now()", [id, ids.store, ids.organization, ids.business, slug, title, description, imageUrl, amount]);
    }
    await client.query('commit');
    console.log('VELORA development fixture seeded at /store/velora-demo');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'VELORA demo seed failed'); process.exitCode = 1; });
