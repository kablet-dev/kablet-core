import { describe, expect, it, vi } from 'vitest';
import { createSupabaseAuthAdapter } from '../../apps/web/lib/supabase-auth';

describe('Supabase server auth adapter', () => {
  it('accepts only a provider-verified identity and never exposes service credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'supabase-user-1' }), { status: 200 }));
    const adapter = createSupabaseAuthAdapter({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-anon-key' }, fetcher);
    await expect(adapter.verifySession('provider-token')).resolves.toEqual({ provider: 'supabase', subject: 'supabase-user-1' });
    expect(fetcher).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/user', expect.objectContaining({ headers: { apikey: 'public-anon-key', authorization: 'Bearer provider-token' } }));
  });

  it('fails closed on missing, oversized, rejected, and malformed sessions', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 401 }));
    const adapter = createSupabaseAuthAdapter({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-anon-key' }, fetcher);
    await expect(adapter.verifySession('')).resolves.toBeNull();
    await expect(adapter.verifySession('x'.repeat(4097))).resolves.toBeNull();
    await expect(adapter.verifySession('bad')).resolves.toBeNull();
    fetcher.mockResolvedValue(new Response(JSON.stringify({ email: 'not-an-id' }), { status: 200 }));
    await expect(adapter.verifySession('malformed')).resolves.toBeNull();
  });
});
