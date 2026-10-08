import { describe, expect, it } from 'vitest';
import { intentInterpretationInputSchema, intentInterpretationOutputSchema, IntentInterpreterFailure } from '@kablet/domain';
import { createDeterministicIntentInterpreter } from '../support/deterministic-intent-interpreter';

const ids = { policyRevisionId: '92000000-0000-4000-8000-000000000001' };
const context = { contractVersion: 'intent-interpretation-context.v1' as const, allowedIntents: ['explore_offerings', 'request_information', 'select_offering', 'unclear'] as const, policyRevisionId: ids.policyRevisionId };
const output = (normalizedIntent: 'explore_offerings' | 'request_information' | 'select_offering' | 'unclear') => ({ contractVersion: 'intent-interpretation.v1' as const, normalizedIntent, reasonCode: normalizedIntent === 'unclear' ? 'ambiguous' as const : 'intent_extracted' as const, confidence: 0.75, interpreterVersion: 'deterministic-test.v1' });

describe('intent interpretation contract', () => {
  it.each(['explore_offerings', 'request_information', 'select_offering', 'unclear'] as const)('accepts %s', intent => { expect(intentInterpretationOutputSchema.parse(output(intent)).normalizedIntent).toBe(intent); });
  it('rejects unsupported intents and unknown fields', () => { expect(() => intentInterpretationOutputSchema.parse({ ...output('unclear'), normalizedIntent: 'buy_now' })).toThrow(); expect(() => intentInterpretationOutputSchema.parse({ ...output('unclear'), extra: 'not allowed' })).toThrow(); });
  it('rejects invalid reason codes and confidence', () => { expect(() => intentInterpretationOutputSchema.parse({ ...output('unclear'), reasonCode: 'free_form' })).toThrow(); expect(() => intentInterpretationOutputSchema.parse({ ...output('unclear'), confidence: 1.1 })).toThrow(); });
  it('bounds visitor text and rejects unauthorized output fields', () => { expect(() => intentInterpretationInputSchema.parse({ text: 'x'.repeat(4001), context })).toThrow(); expect(() => intentInterpretationOutputSchema.parse({ ...output('request_information'), offeringId: '92000000-0000-4000-8000-000000000002' })).toThrow(); });
  it('produces deterministic validated outputs and explicit failures', async () => {
    const interpreter = createDeterministicIntentInterpreter({ hello: output('request_information'), unclear: output('unclear') }, { fail: 'timeout' });
    await expect(interpreter.interpret({ text: 'hello', context })).resolves.toMatchObject({ normalizedIntent: 'request_information' });
    await expect(interpreter.interpret({ text: 'hello', context })).resolves.toEqual(output('request_information'));
    await expect(interpreter.interpret({ text: 'fail', context })).rejects.toMatchObject({ category: 'timeout' });
    await expect(interpreter.interpret({ text: 'missing', context })).rejects.toBeInstanceOf(IntentInterpreterFailure);
  });
});
