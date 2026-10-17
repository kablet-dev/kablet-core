import { z } from 'zod';

export const exposureKindSchema = z.literal('server_response');
export const experienceExposureSchema = z.object({
  contractVersion: z.literal('experience-exposure.v1'),
  id: z.string().uuid(), organizationId: z.string().uuid(), businessId: z.string().uuid(),
  visitorIdentityId: z.string().uuid(), visitorSessionId: z.string().uuid(), interactionSessionId: z.string().uuid(),
  decisionId: z.string().uuid(), exposureKind: exposureKindSchema, compositionId: z.string().trim().min(1).max(80).default('legacy'), compositionVersion: z.string().trim().min(1).max(40).default('experience.v1'), exposureIdempotencyKey: z.string().trim().min(1).max(200).optional(), exposedAt: z.coerce.date(),
}).strict();
export type ExperienceExposure = Omit<z.infer<typeof experienceExposureSchema>, 'compositionId' | 'compositionVersion'> & { compositionId?: string; compositionVersion?: string };
