import { z } from 'zod';

export const exposureKindSchema = z.literal('server_response');
export const experienceExposureSchema = z.object({
  contractVersion: z.literal('experience-exposure.v1'),
  id: z.string().uuid(), organizationId: z.string().uuid(), businessId: z.string().uuid(),
  visitorIdentityId: z.string().uuid(), visitorSessionId: z.string().uuid(), interactionSessionId: z.string().uuid(),
  decisionId: z.string().uuid(), exposureKind: exposureKindSchema, exposedAt: z.coerce.date(),
}).strict();
export type ExperienceExposure = z.infer<typeof experienceExposureSchema>;
