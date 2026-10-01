import { pgTable, serial, timestamp } from 'drizzle-orm/pg-core';
export const infrastructureLedger = pgTable('infrastructure_ledger', { id: serial('id').primaryKey(), createdAt: timestamp('created_at', {withTimezone:true}).notNull().defaultNow() });
