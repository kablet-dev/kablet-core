import { z } from 'zod';

export const acquisitionContextSchema = z.object({
  contractVersion: z.literal('acquisition-context.v1'),
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  businessId: z.string().uuid(),
  visitorIdentityId: z.string().uuid(),
  visitorSessionId: z.string().uuid(),
  interactionSessionId: z.string().uuid(),
  capturedAt: z.coerce.date(),
  landingPath: z.string().trim().min(1).max(2048),
  referrer: z.string().trim().max(2048).nullable(),
  utmSource: z.string().trim().max(200).nullable(),
  utmMedium: z.string().trim().max(200).nullable(),
  utmCampaign: z.string().trim().max(200).nullable(),
  utmContent: z.string().trim().max(200).nullable(),
  utmTerm: z.string().trim().max(200).nullable(),
}).strict();

export type AcquisitionContext = z.infer<typeof acquisitionContextSchema>;
