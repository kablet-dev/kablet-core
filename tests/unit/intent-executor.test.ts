import { describe, expect, it } from 'vitest';
import { executeIntentInterpretation, type IntentExecutionDependencies, type IntentInterpretationInput, type IntentProviderResult } from '@kablet/domain';

const input: IntentInterpretationInput = { text: 'I need information', context: { contractVersion: 'intent-interpretation-context.v1', allowedIntents: ['request_information'], policyRevisionId: null } };
const output = { contractVersion: 'intent-interpretation.v1' as const, normalizedIntent: 'request_information' as const, reasonCode: 'intent_extracted' as const, interpreterVersion: 'fake-1' };

function dependencies(providerResult: IntentProviderResult, overrides: Partial<IntentExecutionDependencies> = {}): IntentExecutionDependencies {
  const calls: string[] = [];
  return {
    claim: async _value => { calls.push('claim'); return { outcome: 'created', invocationId: '00000000-0000-4000-8000-000000000001' }; },
    readReplay: async invocationId => ({ invocationId, status: 'unknown' }),
    settleSucceeded: async () => { calls.push('success'); return { outcome: 'settled', status: 'succeeded' }; },
    settleDefinitiveFailure: async () => { calls.push('failed'); return { outcome: 'settled', status: 'failed' }; },
    settleUnknown: async () => { calls.push('unknown'); return { outcome: 'settled', status: 'unknown' }; },
    provider: { interpret: async () => { calls.push('provider'); return providerResult; } },
    verifyDefinitiveNonConsumption: async () => false,
    ...overrides,
    __calls: calls,
  } as IntentExecutionDependencies & { __calls: string[] };
}

describe('intent execution core', () => {
  it('claims before invoking and settles validated success', async () => {
    const deps = dependencies({ outcome: 'success', output });
    const result = await executeIntentInterpretation(input, deps);
    expect(result.outcome).toBe('succeeded');
    expect((deps as IntentExecutionDependencies & { __calls: string[] }).__calls).toEqual(['claim', 'provider', 'success']);
  });
  it('does not invoke the provider when claim is rejected', async () => {
    let providerCalls = 0;
    const deps = dependencies({ outcome: 'success', output }, { claim: async () => ({ outcome: 'budget_exhausted', period: 'daily' }), provider: { interpret: async () => { providerCalls++; return { outcome: 'success', output }; } } });
    await expect(executeIntentInterpretation(input, deps)).resolves.toMatchObject({ outcome: 'claim_rejected', reason: 'budget_exhausted' });
    expect(providerCalls).toBe(0);
  });
  it('classifies unverifiable failures as unknown', async () => {
    const deps = dependencies({ outcome: 'failure', category: 'timeout' });
    await expect(executeIntentInterpretation(input, deps)).resolves.toMatchObject({ outcome: 'unknown' });
  });
  it('uses definitive failure only when the injected verifier authorizes it', async () => {
    const deps = dependencies({ outcome: 'failure', category: 'unavailable' }, { verifyDefinitiveNonConsumption: async () => true });
    await expect(executeIntentInterpretation(input, deps)).resolves.toMatchObject({ outcome: 'definitive_failure' });
  });
  it('never invokes the provider for replayed or unknown claims', async () => {
    let providerCalls = 0;
    const deps = dependencies({ outcome: 'success', output }, { claim: async () => ({ outcome: 'replay', invocationId: '00000000-0000-4000-8000-000000000001', status: 'unknown' }), provider: { interpret: async () => { providerCalls++; return { outcome: 'success', output }; } } });
    await expect(executeIntentInterpretation(input, deps)).resolves.toMatchObject({ outcome: 'replayed', status: 'unknown' });
    expect(providerCalls).toBe(0);
  });
  it('does not retry the provider after settlement failure', async () => {
    let providerCalls = 0;
    const deps = dependencies({ outcome: 'success', output }, { provider: { interpret: async () => { providerCalls++; return { outcome: 'success', output }; } }, settleSucceeded: async () => ({ outcome: 'settlement_conflict', invocationId: '00000000-0000-4000-8000-000000000001', status: 'succeeded' }) });
    await expect(executeIntentInterpretation(input, deps)).resolves.toMatchObject({ outcome: 'settlement_failed' });
    expect(providerCalls).toBe(1);
  });
});
