import { z } from 'zod';

const base = z.object({ NODE_ENV: z.enum(['development','test','production']).default('development'), DATABASE_URL: z.string().url().optional(), TEST_DATABASE_URL: z.string().url().optional(), PORT: z.coerce.number().int().positive().default(3000), NEXT_PUBLIC_APP_NAME: z.string().default('Kablet') });
export type ServerConfig = z.infer<typeof base> & { DATABASE_URL: string };
export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig { const parsed = base.parse(env); const url = parsed.NODE_ENV === 'test' ? parsed.TEST_DATABASE_URL : parsed.DATABASE_URL; if (!url) throw new Error('DATABASE_URL is required for database access'); return {...parsed, DATABASE_URL: url}; }
export function loadBrowserConfig(env: NodeJS.ProcessEnv = process.env) { return z.object({NEXT_PUBLIC_APP_NAME:z.string().default('Kablet')}).parse(env); }

const testManagerSchema = z.object({ TEST_MANAGER_HOST: z.string().min(1).default('localhost'), TEST_MANAGER_PORT: z.coerce.number().int().positive().default(5432), TEST_MANAGER_USER: z.literal('kablet_test_manager'), TEST_MANAGER_PASSWORD: z.string().min(1), TEST_MANAGER_DATABASE: z.literal('postgres') });
export type TestManagerConfig = z.infer<typeof testManagerSchema>;
export function loadTestManagerConfig(env: NodeJS.ProcessEnv = process.env): TestManagerConfig { const config = testManagerSchema.parse(env); if (!['localhost','127.0.0.1','::1'].includes(config.TEST_MANAGER_HOST)) throw new Error('Test manager must use a local PostgreSQL host'); return config; }
