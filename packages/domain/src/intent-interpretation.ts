import { z } from 'zod';
import { interactionIntentSchema } from './interaction';

export const intentInterpretationContractVersion = 'intent-interpretation.v1' as const;

export const intentInterpretationReasonCodeSchema = z.enum([
  'intent_extracted',
  'ambiguous',
  'unsupported_request',
  'safety_filtered',
]);

export const intentInterpretationOutputSchema = z.object({
  contractVersion: z.literal(intentInterpretationContractVersion),
  normalizedIntent: interactionIntentSchema.or(z.literal('unclear')),
  reasonCode: intentInterpretationReasonCodeSchema,
  confidence: z.number().finite().min(0).max(1).optional(),
  interpreterVersion: z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/),
}).strict();

export type IntentInterpretationOutput = z.infer<typeof intentInterpretationOutputSchema>;

export const intentInterpretationContextSchema = z.object({
  contractVersion: z.literal('intent-interpretation-context.v1'),
  allowedIntents: z.array(z.union([interactionIntentSchema, z.literal('unclear')])).min(1).max(4),
  policyRevisionId: z.string().uuid().nullable(),
}).strict();

export type IntentInterpretationContext = z.infer<typeof intentInterpretationContextSchema>;

export const intentInterpretationInputSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  context: intentInterpretationContextSchema,
}).strict();

export type IntentInterpretationInput = z.infer<typeof intentInterpretationInputSchema>;

export interface IntentInterpreter {
  interpret(input: IntentInterpretationInput): Promise<IntentInterpretationOutput>;
}

export class IntentInterpreterFailure extends Error {
  readonly category: 'timeout' | 'unavailable' | 'invalid_output' | 'budget_exhausted';

  constructor(category: IntentInterpreterFailure['category'], message = 'intent interpretation failed') {
    super(message);
    this.name = 'IntentInterpreterFailure';
    this.category = category;
  }
}
