import { intentInterpretationInputSchema, intentInterpretationOutputSchema, type IntentInterpretationInput, type IntentInterpretationOutput } from './intent-interpretation';

export type IntentExecutionClaim =
  | { outcome: 'created'; invocationId: string }
  | { outcome: 'replay'; invocationId: string; status: 'claimed' | 'succeeded' | 'failed' | 'unknown' }
  | { outcome: 'idempotency_conflict'; invocationId: string }
  | { outcome: 'budget_exhausted'; period: 'daily' | 'monthly' }
  | { outcome: 'accounting_period_missing'; period: 'daily' | 'monthly' }
  | { outcome: 'session_invalid' };

export type IntentExecutionReplay = {
  invocationId: string;
  status: 'claimed' | 'succeeded' | 'failed' | 'unknown';
  interpretation?: IntentInterpretationOutput;
};

export type IntentExecutionSettlement =
  | { outcome: 'settled'; status: 'succeeded' | 'failed' | 'unknown' }
  | { outcome: 'already_settled'; status: 'succeeded' | 'failed' | 'unknown' }
  | { outcome: 'settlement_conflict'; status: string }
  | { outcome: 'not_found' };

export type IntentProviderResult =
  | { outcome: 'success'; output: unknown; providerKey?: string; providerReference?: string }
  | { outcome: 'failure'; category: 'timeout' | 'unavailable' | 'ambiguous'; providerKey?: string; providerReference?: string };

export interface IntentProvider {
  interpret(input: IntentInterpretationInput): Promise<IntentProviderResult>;
}

export interface IntentExecutionDependencies {
  claim(input: IntentInterpretationInput): Promise<IntentExecutionClaim>;
  readReplay(invocationId: string): Promise<IntentExecutionReplay | null>;
  settleSucceeded(input: { invocationId: string; interpretation: IntentInterpretationOutput; providerKey?: string; providerReference?: string }): Promise<IntentExecutionSettlement>;
  settleDefinitiveFailure(input: { invocationId: string; providerKey?: string; providerReference?: string }): Promise<IntentExecutionSettlement>;
  settleUnknown(input: { invocationId: string; providerKey?: string; providerReference?: string }): Promise<IntentExecutionSettlement>;
  provider: IntentProvider;
  /** Runtime evidence verifier; a provider result alone cannot authorize release. */
  verifyDefinitiveNonConsumption(result: Extract<IntentProviderResult, { outcome: 'failure' }>): Promise<boolean>;
}

export type IntentExecutionResult =
  | { outcome: 'succeeded'; invocationId: string; interpretation: IntentInterpretationOutput; providerKey?: string; providerReference?: string }
  | { outcome: 'replayed'; invocationId: string; status: IntentExecutionReplay['status']; interpretation?: IntentInterpretationOutput }
  | { outcome: 'unknown'; invocationId: string; providerKey?: string; providerReference?: string }
  | { outcome: 'definitive_failure'; invocationId: string; providerKey?: string; providerReference?: string }
  | { outcome: 'claim_rejected'; reason: Exclude<IntentExecutionClaim, { outcome: 'created' | 'replay' }>['outcome'] }
  | { outcome: 'settlement_failed'; invocationId: string; settlement: IntentExecutionSettlement };

export async function executeIntentInterpretation(input: IntentInterpretationInput, dependencies: IntentExecutionDependencies): Promise<IntentExecutionResult> {
  const validatedInput = intentInterpretationInputSchema.parse(input);
  const claim = await dependencies.claim(validatedInput);
  if (claim.outcome !== 'created') {
    if (claim.outcome === 'replay') {
      const replay = await dependencies.readReplay(claim.invocationId);
      if (!replay) return { outcome: 'settlement_failed', invocationId: claim.invocationId, settlement: { outcome: 'not_found' } };
      return { outcome: 'replayed', invocationId: replay.invocationId, status: replay.status, interpretation: replay.interpretation };
    }
    return { outcome: 'claim_rejected', reason: claim.outcome };
  }

  let providerResult: IntentProviderResult;
  try {
    providerResult = await dependencies.provider.interpret(validatedInput);
  } catch {
    providerResult = { outcome: 'failure', category: 'ambiguous' };
  }

  if (providerResult.outcome === 'success') {
    const interpretation = intentInterpretationOutputSchema.parse(providerResult.output);
    const settlement = await dependencies.settleSucceeded({ invocationId: claim.invocationId, interpretation, providerKey: providerResult.providerKey, providerReference: providerResult.providerReference });
    if (settlement.outcome !== 'settled' && settlement.outcome !== 'already_settled') return { outcome: 'settlement_failed', invocationId: claim.invocationId, settlement };
    return { outcome: 'succeeded', invocationId: claim.invocationId, interpretation, providerKey: providerResult.providerKey, providerReference: providerResult.providerReference };
  }

  if (await dependencies.verifyDefinitiveNonConsumption(providerResult)) {
    const settlement = await dependencies.settleDefinitiveFailure({ invocationId: claim.invocationId, providerKey: providerResult.providerKey, providerReference: providerResult.providerReference });
    if (settlement.outcome !== 'settled' && settlement.outcome !== 'already_settled') return { outcome: 'settlement_failed', invocationId: claim.invocationId, settlement };
    return { outcome: 'definitive_failure', invocationId: claim.invocationId, providerKey: providerResult.providerKey, providerReference: providerResult.providerReference };
  }

  const settlement = await dependencies.settleUnknown({ invocationId: claim.invocationId, providerKey: providerResult.providerKey, providerReference: providerResult.providerReference });
  if (settlement.outcome !== 'settled' && settlement.outcome !== 'already_settled') return { outcome: 'settlement_failed', invocationId: claim.invocationId, settlement };
  return { outcome: 'unknown', invocationId: claim.invocationId, providerKey: providerResult.providerKey, providerReference: providerResult.providerReference };
}
