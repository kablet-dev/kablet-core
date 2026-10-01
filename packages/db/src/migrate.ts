import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadServerConfig } from '@kablet/config';
import { createDb } from './index.js';
const {db,pool}=createDb(loadServerConfig().DATABASE_URL); await migrate(db,{migrationsFolder:'./drizzle'}); await pool.end();
