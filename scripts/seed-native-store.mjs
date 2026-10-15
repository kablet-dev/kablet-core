import pg from 'pg';

const ids = {
  organization: '6d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a1001',
  business: '6d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a1002',
  store: '6d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a1006',
  products: ['6d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a1007', '6d8d8d4a-4e4a-4b8b-9a4e-4f9f4d1a1008'],
};

function requireDevelopmentDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('refusing to seed with NODE_ENV=production');
  if (process.env.NATIVE_STORE_SEED_ENABLED !== 'true') throw new Error('set NATIVE_STORE_SEED_ENABLED=true to opt into the native store seed');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  const target = `${url.hostname}/${url.pathname}`.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || /(prod|production|stage|staging|shared)/.test(target)) throw new Error('refusing to seed a non-local or shared database');
}

async function main() {
  requireDevelopmentDatabase();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('kablet.organization_id',$1,true),set_config('kablet.business_id',$2,true)", [ids.organization, ids.business]);
    await client.query("insert into organizations(id,name) values($1,'Northstar Native Store') on conflict(id) do update set name=excluded.name", [ids.organization]);
    await client.query("insert into businesses(id,organization_id,name) values($1,$2,'Northstar Native Store') on conflict(id) do update set name=excluded.name,active=true", [ids.business, ids.organization]);
    await client.query("insert into kablet_native_stores(id,organization_id,business_id,public_slug,name,brand_mark,primary_currency,status) values($1,$2,$3,'northstar-native','Northstar Goods','N','USD','published') on conflict(id) do update set name=excluded.name,brand_mark=excluded.brand_mark,primary_currency=excluded.primary_currency,status=excluded.status,updated_at=now()", [ids.store, ids.organization, ids.business]);
    const products = [
      [ids.products[0], 'field-notes', 'Field Notes', 'A quiet, useful notebook for ideas worth keeping.', '1800', 'available'],
      [ids.products[1], 'daily-carry', 'Daily Carry', 'A small set of considered essentials for the day ahead.', '4200', 'stale'],
    ];
    for (const [id, slug, title, description, amount, availability] of products) await client.query("insert into kablet_native_products(id,store_id,organization_id,business_id,public_slug,title,description,amount_minor,currency,status,availability) values($1,$2,$3,$4,$5,$6,$7,$8,'USD','published',$9) on conflict(id) do update set title=excluded.title,description=excluded.description,amount_minor=excluded.amount_minor,currency=excluded.currency,status=excluded.status,availability=excluded.availability,updated_at=now()", [id, ids.store, ids.organization, ids.business, slug, title, description, amount, availability]);
    await client.query('commit');
    console.log('Native Northstar store seeded at /store/northstar-native');
  } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { await client.end(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'native store seed failed'); process.exitCode = 1; });
