import type { AuthProviderAdapter } from '@kablet/domain';
import { loadSupabaseAuthConfig } from '@kablet/config';

export function createSupabaseAuthAdapter(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): AuthProviderAdapter {
  const config = loadSupabaseAuthConfig(env);
  const base = config.SUPABASE_URL.replace(/\/$/, '');
  return {
    async verifySession(token: string) {
      if (!token || token.length > 4096) return null;
      const response = await fetcher(`${base}/auth/v1/user`, { headers: { apikey: config.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) return null;
      const body = await response.json() as { id?: unknown };
      return typeof body.id === 'string' && body.id.length > 0 ? { provider: 'supabase', subject: body.id } : null;
    },
  };
}
