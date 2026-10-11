import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadServerConfig } from '@kablet/config';
import { createDb } from './index.js';
import pg from 'pg';

const config = loadServerConfig();
if (process.env.NODE_ENV === 'production') throw new Error('refusing local migration workflow in production');
const target = new URL(config.DATABASE_URL);
if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || /(prod|production|stage|staging|shared)/.test(`${target.hostname}/${target.pathname}`.toLowerCase())) throw new Error('migration workflow requires a local development database');
const { db, pool } = createDb(config.DATABASE_URL);
const roleAdminUrl = process.env.TEST_ROLE_ADMIN_URL;
if (!roleAdminUrl) throw new Error('TEST_ROLE_ADMIN_URL is required for temporary migration role membership');
const roleAdminTarget = new URL(roleAdminUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(roleAdminTarget.hostname)) throw new Error('role administrator must be local');
const roleAdminConnection = new URL(roleAdminUrl);
roleAdminConnection.pathname = target.pathname;
const roleAdmin = new pg.Client({ connectionString: roleAdminConnection.toString() });
let migrationRole = '';
let temporaryTriggerGrant = false;
try {
  await roleAdmin.connect();
  const identity = await pool.query('select current_user, current_database()');
  migrationRole = String(identity.rows[0].current_user);
  if (migrationRole !== 'kablet_dev' || String(identity.rows[0].current_database) !== target.pathname.slice(1)) throw new Error('migration workflow requires kablet_dev on the local development database');
  await roleAdmin.query('grant kablet_privacy_owner to kablet_dev with set true, inherit false');
  // Migration 0009 creates triggers as the table owner after resetting the
  // privacy-owner role. The trigger owner must temporarily be able to execute
  // the privacy-owned trigger function; revoke this migration-only grant below.
  await roleAdmin.query("do $$ begin if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='kablet_visitor_immutable' and p.pronargs=0) then execute 'grant execute on function public.kablet_visitor_immutable() to kablet_dev'; end if; end $$");
  temporaryTriggerGrant = true;
  await migrate(db, { migrationsFolder: './drizzle' });
} finally {
  if (temporaryTriggerGrant) await roleAdmin.query('revoke execute on function public.kablet_visitor_immutable() from kablet_dev').catch(() => undefined);
  if (migrationRole === 'kablet_dev') await roleAdmin.query('revoke kablet_privacy_owner from kablet_dev').catch(() => undefined);
  await roleAdmin.end().catch(() => undefined);
  await pool.end().catch(() => undefined);
}
