import { z } from 'zod';

const uuid = z.string().uuid();
const key = z.string().trim().min(1).max(100).regex(/^[a-z0-9._-]+$/);
const version = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/);
export const conversionDefinitionSchema = z.object({ contractVersion: z.literal('conversion-definition.v1'), id: uuid, organizationId: uuid, businessId: uuid, definitionKey: key, definitionVersion: version, revisionNumber: z.number().int().positive(), capabilityId: uuid, capabilityVersion: version, outcomeType: key, active: z.boolean(), createdAt: z.coerce.date() }).strict();
export type ConversionDefinition = z.infer<typeof conversionDefinitionSchema>;
export const conversionFactSchema = z.object({ contractVersion: z.literal('conversion-fact.v1'), id: uuid, organizationId: uuid, businessId: uuid, outcomeId: uuid, conversionDefinitionId: uuid, occurredAt: z.coerce.date(), classifiedAt: z.coerce.date() }).strict();
export type ConversionFact = z.infer<typeof conversionFactSchema>;
