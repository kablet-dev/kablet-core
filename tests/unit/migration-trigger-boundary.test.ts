import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('visitor immutability migration boundary', () => {
  it('creates visitor immutable triggers under the function owner boundary', () => {
    for (const migration of ['0009_contact_consent.sql', '0011_acquisition_context.sql', '0012_experience_exposure_interaction_facts.sql']) {
      const source = readFileSync(resolve(process.cwd(), 'packages/db/drizzle', migration), 'utf8');
      expect(source).toContain('GRANT TRIGGER');
      expect(source).toMatch(/SET LOCAL ROLE kablet_privacy_owner[\s\S]*CREATE TRIGGER[\s\S]*RESET ROLE/);
      expect(source).toContain('REVOKE TRIGGER');
    }
  });
});
