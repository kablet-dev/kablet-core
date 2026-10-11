import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const algorithm = 'aes-256-gcm';

export type EncryptedCredential = { ciphertext: Buffer; keyVersion: string; };

export type CredentialKeyring = Record<string, Buffer>;

export function createCredentialVault(key: Buffer, keyVersion: string) {
  if (key.length !== 32) throw new Error('credential encryption key must be 32 bytes');
  return createRotatingCredentialVault({ [keyVersion]: key }, keyVersion);
}

export function createRotatingCredentialVault(keys: CredentialKeyring, activeKeyVersion: string) {
  const activeKey = keys[activeKeyVersion];
  if (!activeKey || activeKey.length !== 32) throw new Error('active credential encryption key must be 32 bytes');
  for (const key of Object.values(keys)) if (key.length !== 32) throw new Error('credential encryption keys must be 32 bytes');
  return {
    encrypt(secret: string): EncryptedCredential {
      const iv = randomBytes(12);
      const cipher = createCipheriv(algorithm, activeKey, iv);
      const ciphertext = Buffer.concat([iv, cipher.update(secret, 'utf8'), cipher.final(), cipher.getAuthTag()]);
      return { ciphertext, keyVersion: activeKeyVersion };
    },
    decrypt(input: EncryptedCredential): string {
      const key = keys[input.keyVersion];
      if (!key || input.ciphertext.length < 28) throw new Error('credential key version is unavailable');
      const iv = input.ciphertext.subarray(0, 12);
      const tag = input.ciphertext.subarray(input.ciphertext.length - 16);
      const decipher = createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(input.ciphertext.subarray(12, -16)), decipher.final()]).toString('utf8');
    },
  };
}
