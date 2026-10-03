export const KABLET_NAME = 'Kablet — The AI Frontend for Business';
export type TenantContext = { organizationId: string; businessId: string };
import { z } from 'zod';
export const pricingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), currency: z.string().regex(/^[A-Z]{3}$/), amountMinor: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('unknown') }),
]);
export type Pricing = z.infer<typeof pricingSchema>;
export const provenanceSchema = z.object({ sourceType: z.enum(['owner_input', 'imported_record', 'verified_external_source']), sourceReference: z.string().trim().min(1), capturedAt: z.coerce.date(), capturedBy: z.string().trim().min(1) });
export type Provenance = z.infer<typeof provenanceSchema>;
export const offeringRevisionSchema = z.object({ offeringId: z.string().uuid(), revisionNumber: z.number().int().positive(), name: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(5000), pricing: pricingSchema, visibility: z.enum(['public', 'private']), approvalStatus: z.enum(['draft', 'approved', 'rejected']), provenance: provenanceSchema });
export type OfferingRevision = z.infer<typeof offeringRevisionSchema>;
export * from './visitor-state';
export * from './decision';
export * from './experience';
