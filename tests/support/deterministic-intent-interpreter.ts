import { intentInterpretationInputSchema, intentInterpretationOutputSchema, type IntentInterpreter, type IntentInterpretationInput, type IntentInterpretationOutput, IntentInterpreterFailure } from '@kablet/domain';

export function createDeterministicIntentInterpreter(outputs: Record<string, IntentInterpretationOutput>, failures: Record<string, IntentInterpreterFailure['category']> = {}): IntentInterpreter {
  return {
    async interpret(input: IntentInterpretationInput) {
      const parsed = intentInterpretationInputSchema.parse(input);
      const failure = failures[parsed.text];
      if (failure) throw new IntentInterpreterFailure(failure);
      const output = outputs[parsed.text];
      if (!output) throw new IntentInterpreterFailure('unavailable', 'deterministic output not configured');
      return intentInterpretationOutputSchema.parse(output);
    },
  };
}
