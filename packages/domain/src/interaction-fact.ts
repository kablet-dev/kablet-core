import { z } from 'zod';

export const interactionKindSchema = z.enum(['intent_expressed','qualification_answered','contact_submitted','consent_granted','action_confirmed']);
export const interactionFactSchema = z.object({
  contractVersion: z.literal('interaction-fact.v1'),
  id: z.string().uuid(), organizationId: z.string().uuid(), businessId: z.string().uuid(),
  visitorIdentityId: z.string().uuid(), visitorSessionId: z.string().uuid(), interactionSessionId: z.string().uuid(),
  decisionId: z.string().uuid(), exposureId: z.string().uuid().nullable(), interactionKind: interactionKindSchema,
  occurredAt: z.coerce.date(), idempotencyKey: z.string().trim().min(1).max(200), actionRequestId: z.string().uuid().nullable(),
}).strict();
export type InteractionFact = z.infer<typeof interactionFactSchema>;
