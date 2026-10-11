import { describe, expect, it } from 'vitest';
import { createConfiguredIntentInterpreter } from '../../apps/web/lib/server-interaction';

describe('interaction runtime interpreter configuration', () => {
  it('enables the demo interpreter only with explicit local development opt-in', async () => {
    const interpreter = createConfiguredIntentInterpreter({ NODE_ENV: 'development', KABLET_INTERACTION_ENABLE_DEMO_INTERPRETER: 'true' });
    await expect(interpreter?.interpret({ text: 'My employer just fired me. I need help.', context: { contractVersion: 'intent-interpretation-context.v1', allowedIntents: ['explore_offerings', 'request_information', 'select_offering', 'unclear'], policyRevisionId: null } })).resolves.toMatchObject({ normalizedIntent: 'request_information' });
  });

  it('rejects demo interpreter opt-in outside development', () => {
    expect(() => createConfiguredIntentInterpreter({ NODE_ENV: 'production', KABLET_INTERACTION_ENABLE_DEMO_INTERPRETER: 'true' })).toThrow('only available in development');
  });

  it('fails closed without explicit opt-in', () => {
    expect(createConfiguredIntentInterpreter({ NODE_ENV: 'development' })).toBeUndefined();
    expect(createConfiguredIntentInterpreter({ NODE_ENV: 'production' })).toBeUndefined();
  });
});
