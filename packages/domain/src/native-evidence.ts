import { z } from 'zod';

export const nativeEvidenceEventKindSchema = z.enum([
  'session_started', 'session_returned', 'intent_submitted', 'preference_changed',
  'product_impression', 'product_viewed', 'comparison_selected', 'clarification_selected',
  'cart_added', 'cart_removed', 'checkout_started', 'checkout_failed',
  'decision_exposed', 'ai_interpretation', 'verified_purchase',
]);
export type NativeEvidenceEventKind = z.infer<typeof nativeEvidenceEventKindSchema>;

const boundedValueSchema = z.union([z.string().trim().max(240), z.number().finite(), z.boolean(), z.null()]);
export const nativeEvidenceMetadataSchema = z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/), boundedValueSchema).refine(value => JSON.stringify(value).length <= 2000, 'evidence metadata is too large');

export const nativeEvidenceEventSchema = z.object({
  contractVersion: z.literal('native-evidence-event.v1'),
  id: z.string().uuid(), organizationId: z.string().uuid(), businessId: z.string().uuid(), storeId: z.string().uuid(),
  visitorIdentityId: z.string().uuid(), visitorSessionId: z.string().uuid(), interactionSessionId: z.string().uuid(),
  visitorStateRevisionId: z.string().uuid().nullable(), decisionId: z.string().uuid().nullable(), exposureId: z.string().uuid().nullable(),
  ruleKey: z.string().trim().max(160).nullable(), ruleVersion: z.number().int().positive().nullable(), decisionReason: z.string().trim().max(1000).nullable(),
  eventKind: nativeEvidenceEventKindSchema, occurredAt: z.coerce.date(), idempotencyKey: z.string().trim().min(1).max(200), metadata: nativeEvidenceMetadataSchema,
}).strict();
export type NativeEvidenceEvent = z.infer<typeof nativeEvidenceEventSchema>;

export const nativeEvidenceInputSchema = z.object({
  eventKind: nativeEvidenceEventKindSchema,
  idempotencyKey: z.string().trim().min(1).max(200),
  metadata: nativeEvidenceMetadataSchema.default({}),
}).strict();
export type NativeEvidenceInput = z.infer<typeof nativeEvidenceInputSchema>;
