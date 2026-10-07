import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
export function createDb(url: string) { const pool = new pg.Pool({connectionString:url, max:5}); return { db: drizzle(pool), pool }; }
export type Database = ReturnType<typeof createDb>;
export type DatabaseTransaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
export * from './business-truth.js';
export * from './visitor-state.js';
export * from './decision.js';
export * from './interaction.js';
export * from './action-outcome.js';
export * from './acquisition.js';
export * from './measurement.js';
export * from './attribution.js';
export * from './conversion.js';
export * from './measurement-query.js';
export * from './intent-policy.js';
