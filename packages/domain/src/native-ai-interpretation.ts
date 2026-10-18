import { z } from 'zod';
import { intentInterpretationOutputSchema, type IntentInterpretationOutput } from './intent-interpretation';

export const nativeAiInterpretationSourceSchema = z.enum(['deterministic', 'provider', 'disabled', 'fallback']);
export type NativeAiInterpretationSource = z.infer<typeof nativeAiInterpretationSourceSchema>;

export const nativeAiInterpretationSchema = z.object({
  source: nativeAiInterpretationSourceSchema,
  output: intentInterpretationOutputSchema.nullable(),
  fallbackReason: z.enum(['disabled', 'unavailable', 'timeout', 'invalid_output', 'budget_exhausted', 'unclear']).nullable(),
  providerDiagnostic: z.object({ category: z.enum(['timeout', 'http_error', 'invalid_output', 'unavailable']), stage: z.enum(['http', 'response_envelope', 'content', 'json', 'schema']).optional(), reason: z.enum(['response_envelope', 'malformed_json', 'schema_validation', 'provider_refusal', 'truncated_output']).optional(), status: z.number().int().min(400).max(599).optional() }).nullable().optional(),
  routingDiagnostic: z.object({
    stage: z.enum(['configuration', 'eligibility', 'settlement']),
    reason: z.enum(['provider_not_configured', 'session_invalid', 'idempotency_conflict', 'accounting_period_missing', 'budget_exhausted', 'settlement_failed', 'missing_interpretation']),
  }).nullable().optional(),
}).strict();
export type NativeAiInterpretation = z.infer<typeof nativeAiInterpretationSchema>;

export type NativeAiRouting = {
  signal: 'discovery' | 'comparison' | null;
  guidance: { mode: 'discovery' | 'comparison' | 'reassurance'; preference: 'available' | 'physical' | 'digital' | 'lower_price' | null; productId: null } | undefined;
};

export function routeNativeInterpretation(output: IntentInterpretationOutput | null): NativeAiRouting {
  if (!output || output.normalizedIntent === 'unclear') return { signal: null, guidance: { mode: 'discovery', preference: null, productId: null } };
  if (output.normalizedIntent === 'select_offering') return { signal: 'comparison', guidance: { mode: 'comparison', preference: null, productId: null } };
  if (output.normalizedIntent === 'request_information') return { signal: null, guidance: { mode: 'reassurance', preference: null, productId: null } };
  return { signal: 'discovery', guidance: { mode: 'discovery', preference: null, productId: null } };
}

export function deterministicNativeInterpretation(text: string): IntentInterpretationOutput | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  if (/\b(compare|comparison|versus|vs\.?|difference|differ)\b/.test(value)) return {
    contractVersion: 'intent-interpretation.v1', normalizedIntent: 'select_offering', reasonCode: 'intent_extracted', confidence: 1, interpreterVersion: 'native-deterministic.v1',
  };
  if (/\b(ship|shipping|tax|return|returns|policy|policies|delivery)\b/.test(value)) return {
    contractVersion: 'intent-interpretation.v1', normalizedIntent: 'request_information', reasonCode: 'intent_extracted', confidence: 1, interpreterVersion: 'native-deterministic.v1',
  };
  if (/\b(explore|browse|products?|collection|options?|available|stock|physical|digital|cheapest|cheap|lower price|want|specific|know what)\b/.test(value)) return {
    contractVersion: 'intent-interpretation.v1', normalizedIntent: 'explore_offerings', reasonCode: 'intent_extracted', confidence: 1, interpreterVersion: 'native-deterministic.v1',
  };
  return null;
}
