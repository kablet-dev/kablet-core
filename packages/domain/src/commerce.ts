import { z } from 'zod';

export const commerceContractVersion = 'commerce.v1' as const;
export const commerceProviderSchema = z.enum(['shopify']);
export type CommerceProvider = z.infer<typeof commerceProviderSchema>;
export const commerceConnectionStatusSchema = z.enum(['pending', 'active', 'reauthorization_required', 'revoked', 'disconnected']);
export type CommerceConnectionStatus = z.infer<typeof commerceConnectionStatusSchema>;
export const catalogAvailabilitySchema = z.enum(['unknown', 'available', 'unavailable', 'stale']);
export type CatalogAvailability = z.infer<typeof catalogAvailabilitySchema>;

export const moneySchema = z.object({ amountMinor: z.string().regex(/^-?\d+$/), currency: z.string().regex(/^[A-Z]{3}$/) }).strict();
export type Money = z.infer<typeof moneySchema>;

export const commerceProductSchema = z.object({
  contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema,
  externalId: z.string().min(1).max(300), title: z.string().min(1), description: z.string(),
  status: z.enum(['active', 'draft', 'archived', 'unknown']), availability: catalogAvailabilitySchema,
  sourceUpdatedAt: z.coerce.date().nullable(), observedAt: z.coerce.date(), revision: z.number().int().positive(),
  imageUrls: z.array(z.string().url()).max(100),
}).strict();
export type CommerceProduct = z.infer<typeof commerceProductSchema>;

export const commerceVariantSchema = z.object({
  contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema,
  externalId: z.string().min(1).max(300), productExternalId: z.string().min(1).max(300), title: z.string().min(1),
  price: moneySchema.nullable(), availableQuantity: z.number().int().nonnegative().nullable(), availability: catalogAvailabilitySchema,
  sourceUpdatedAt: z.coerce.date().nullable(), observedAt: z.coerce.date(), revision: z.number().int().positive(),
}).strict();
export type CommerceVariant = z.infer<typeof commerceVariantSchema>;

export const providerEventSchema = z.object({
  contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema,
  eventId: z.string().min(1).max(300), eventType: z.string().min(1).max(200), occurredAt: z.coerce.date().nullable(),
  sourceVersion: z.string().max(100).nullable(), payload: z.record(z.string(), z.unknown()),
}).strict();
export type ProviderEvent = z.infer<typeof providerEventSchema>;

export const providerErrorSchema = z.object({
  kind: z.enum(['authentication', 'authorization', 'rate_limited', 'transient', 'invalid_request', 'not_found', 'unknown']),
  retryable: z.boolean(), providerCode: z.string().max(200).nullable(), message: z.string().max(500),
}).strict();
export type ProviderError = z.infer<typeof providerErrorSchema>;

export const catalogSyncStatusSchema = z.enum(['running', 'completed', 'partial', 'failed', 'stale']);
export type CatalogSyncStatus = z.infer<typeof catalogSyncStatusSchema>;
export const webhookProcessingStatusSchema = z.enum(['accepted', 'processing', 'processed', 'retryable', 'dead_letter']);
export type WebhookProcessingStatus = z.infer<typeof webhookProcessingStatusSchema>;
export type CommerceCapability = 'catalog.read' | 'inventory.read' | 'cart.write' | 'checkout.create' | 'order.read';
