import { createCredentialVault } from '@kablet/db';

export function loadControlCredentialVault(env: NodeJS.ProcessEnv = process.env) {
  const encodedKey = env.KABLET_CREDENTIAL_KEY;
  const keyVersion = env.KABLET_CREDENTIAL_KEY_VERSION;
  if (!encodedKey || !keyVersion) throw new Error('credential vault is not configured');
  const key = Buffer.from(encodedKey, 'base64');
  return createCredentialVault(key, keyVersion);
}
