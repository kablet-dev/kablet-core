import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
export function createDb(url: string) { const pool = new pg.Pool({connectionString:url, max:5}); return { db: drizzle(pool), pool }; }
export type Database = ReturnType<typeof createDb>;
export * from './business-truth.js';
export * from './visitor-state.js';
