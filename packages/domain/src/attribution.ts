import { z } from 'zod';

export const attributionSchema = z.object({
  contractVersion: z.literal('attribution.v1'),
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  businessId: z.string().uuid(),
  outcomeId: z.string().uuid(),
  acquisitionContextId: z.string().uuid(),
  interactionSessionId: z.string().uuid(),
  rule: z.literal('same_interaction_acquisition.v1'),
  attributedAt: z.coerce.date(),
}).strict();

export type Attribution = z.infer<typeof attributionSchema>;
