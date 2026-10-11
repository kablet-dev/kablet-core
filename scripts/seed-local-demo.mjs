import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const ids = {
  organization: '6d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a1001',
  business: '6d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a1002',
  offering: '6d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a1003',
  offeringRevision: '6d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a1004',
  policyRevision: '6d8d8d4a-4e4a-4b8b-9a4e-2f9f4d1a1005',
};

function requireDevelopmentDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('refusing to seed with NODE_ENV=production');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  const target = `${url.hostname}/${url.pathname}`.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || /(prod|production|stage|staging|shared)/.test(target)) throw new Error('refusing to seed a non-local or shared database');
}

function updateEnv() {
  const path = '.env';
  let text = readFileSync(path, 'utf8');
  for (const [name, value] of [['KABLET_INTERACTION_ORGANIZATION_ID', ids.organization], ['KABLET_INTERACTION_BUSINESS_ID', ids.business]]) {
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`;
  }
  writeFileSync(path, text);
}

async function main() {
  requireDevelopmentDatabase();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('kablet.organization_id',$1,true),set_config('kablet.business_id',$2,true)", [ids.organization, ids.business]);
    await client.query("insert into organizations(id,name) values($1,'Northstar Studio') on conflict(id) do update set name=excluded.name", [ids.organization]);
    await client.query("insert into businesses(id,organization_id,name) values($1,$2,'Northstar Studio') on conflict(id) do update set name=excluded.name,active=true", [ids.business, ids.organization]);
    await client.query("insert into business_offerings(id,business_id,name) values($1,$2,'Clarity consultation') on conflict(id) do update set name=excluded.name,active=true", [ids.offering, ids.business]);
    await client.query("insert into business_offering_revisions(id,offering_id,revision_number,name,description,pricing_kind,currency,amount_minor,visibility,approval_status,provenance_source_type,provenance_source_reference,provenance_captured_at,provenance_captured_by) values($1,$2,1,'Clarity consultation','A focused conversation to understand the situation and identify a practical next step.','unknown',null,null,'public','approved','owner_input','local-demo',now(),'local-demo-seed') on conflict(id) do nothing", [ids.offeringRevision, ids.offering]);
    await client.query("insert into offering_publications(offering_id,revision_id) values($1,$2) on conflict(offering_id) do update set revision_id=excluded.revision_id,published_at=now()", [ids.offering, ids.offeringRevision]);
    await client.query("insert into business_intent_policy_revisions(id,organization_id,business_id,policy_key,revision_number) values($1,$2,$3,'baseline',1) on conflict(id) do nothing", [ids.policyRevision, ids.organization, ids.business]);
    await client.query("insert into business_intent_policy_requirements(organization_id,business_id,policy_revision_id,requirement_key,prompt,options) values($1,$2,$3,'context_timeline','What kind of timeframe are you considering.',$4::jsonb) on conflict(organization_id,business_id,policy_revision_id,requirement_key) do nothing", [ids.organization, ids.business, ids.policyRevision, JSON.stringify([{ value: 'immediate', label: 'As soon as possible' }, { value: 'this_week', label: 'This week' }, { value: 'exploring', label: 'I am still exploring' }])]);
    for (const intent of ['explore_offerings', 'request_information', 'select_offering']) {
      await client.query("insert into business_intent_policy_rules(organization_id,business_id,policy_revision_id,intent) values($1,$2,$3,$4) on conflict(organization_id,business_id,policy_revision_id,intent) do nothing", [ids.organization, ids.business, ids.policyRevision, intent]);
    }
    await client.query("insert into business_intent_policy_rule_requirements(organization_id,business_id,policy_revision_id,intent,requirement_key) values($1,$2,$3,'request_information','context_timeline') on conflict do nothing", [ids.organization, ids.business, ids.policyRevision]);
    await client.query("insert into business_intent_policy_publications(organization_id,business_id,policy_key,revision_id) values($1,$2,'baseline',$3) on conflict(organization_id,business_id,policy_key) do update set revision_id=excluded.revision_id,published_at=now()", [ids.organization, ids.business, ids.policyRevision]);
    await client.query('commit');
    updateEnv();
    console.log('Local Northstar Studio demo seeded. Tenant configuration updated in .env.');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally { await client.end(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'local demo seed failed'); process.exitCode = 1; });
