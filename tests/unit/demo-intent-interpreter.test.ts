import { describe, expect, it } from 'vitest';
import { createDemoIntentInterpreter } from '../../apps/web/lib/demo-intent-interpreter';

const context = {
  contractVersion: 'intent-interpretation-context.v1' as const,
  allowedIntents: ['explore_offerings', 'request_information', 'select_offering', 'unclear'] as const,
  policyRevisionId: null,
};

describe('demo adaptive intent boundary', () => {
  it('maps the supported demonstration need to a validated structured intent', async () => {
    await expect(createDemoIntentInterpreter().interpret({ text: 'My employer just fired me. I need help.', context })).resolves.toMatchObject({
      contractVersion: 'intent-interpretation.v1',
      normalizedIntent: 'request_information',
      reasonCode: 'intent_extracted',
      interpreterVersion: 'demo-deterministic.v1',
    });
  });

  it('returns unclear for unsupported text without inventing a business intent', async () => {
    await expect(createDemoIntentInterpreter().interpret({ text: 'Tell me something surprising.', context })).resolves.toMatchObject({
      normalizedIntent: 'unclear',
      reasonCode: 'ambiguous',
    });
  });
});
