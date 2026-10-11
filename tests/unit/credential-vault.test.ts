import { describe, expect, it } from 'vitest';
import { createCredentialVault } from '@kablet/db';

describe('provider credential boundary', () => {
  it('encrypts and decrypts only with the active key version', () => {
    const vault = createCredentialVault(Buffer.alloc(32, 7), 'key-1');
    const encrypted = vault.encrypt('shopify-access-token');
    expect(encrypted.ciphertext.toString('utf8')).not.toContain('shopify-access-token');
    expect(vault.decrypt(encrypted)).toBe('shopify-access-token');
    expect(() => createCredentialVault(Buffer.alloc(32, 8), 'key-2').decrypt(encrypted)).toThrow('key version');
  });

  it('rejects invalid key material', () => {
    expect(() => createCredentialVault(Buffer.alloc(16), 'key-1')).toThrow('32 bytes');
  });
});
