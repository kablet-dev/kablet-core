import { intentInterpretationOutputSchema, type IntentInterpreter, type IntentInterpretationInput } from '@kablet/domain';

/** Deterministic, test/demo-only interpreter. It is deliberately exact-match, not a production classifier. */
export function createDemoIntentInterpreter(): IntentInterpreter {
  return {
    async interpret(input: IntentInterpretationInput) {
      const text = input.text.trim().toLowerCase();
      const normalizedIntent = text === 'my employer just fired me. i need help.'
        ? 'request_information'
        : 'unclear';
      return intentInterpretationOutputSchema.parse({
        contractVersion: 'intent-interpretation.v1',
        normalizedIntent,
        reasonCode: normalizedIntent === 'unclear' ? 'ambiguous' : 'intent_extracted',
        interpreterVersion: 'demo-deterministic.v1',
      });
    },
  };
}
