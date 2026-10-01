import { sql } from 'drizzle-orm';
import { loadServerConfig } from '@kablet/config'; import { createDb } from './index.js';
const {db,pool}=createDb(loadServerConfig().DATABASE_URL); await db.execute(sql`select 1`); console.log('database ready'); await pool.end();
