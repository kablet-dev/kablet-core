import { z } from 'zod';

export const commerceContractVersion = 'commerce.v1' as const;
export const commerceProviderSchema = z.enum(['shopify']);
export type CommerceProvider = z.infer<typeof commerceProviderSchema>;
export const commerceConnectionStatusSchema = z.enum(['pending', 'active', 'reauthorization_required', 'revoked', 'disconnected']);
export type CommerceConnectionStatus = z.infer<typeof commerceConnectionStatusSchema>;
export const catalogAvailabilitySchema = z.enum(['unknown', 'available', 'unavailable', 'stale']);
export type CatalogAvailability = z.infer<typeof catalogAvailabilitySchema>;
export const commerceEvidenceStateSchema = z.enum(['authoritative', 'unknown', 'stale', 'unverified']);
export type CommerceEvidenceState = z.infer<typeof commerceEvidenceStateSchema>;

export const moneySchema = z.object({ amountMinor: z.string().regex(/^-?\d+$/), currency: z.string().regex(/^[A-Z]{3}$/) }).strict();
export type Money = z.infer<typeof moneySchema>;

export const commerceProductSchema = z.object({
  contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema,
  externalId: z.string().min(1).max(300), title: z.string().min(1), description: z.string(),
  status: z.enum(['active', 'draft', 'archived', 'unknown']), availability: catalogAvailabilitySchema,
  sourceUpdatedAt: z.coerce.date().nullable(), observedAt: z.coerce.date(), ingestionRevision: z.number().int().positive(),
  sourceEvidence: z.object({ providerRevision: z.string().max(300).nullable(), state: commerceEvidenceStateSchema }).strict(),
  imageUrls: z.array(z.string().url()).max(100),
}).strict();
export type CommerceProduct = z.infer<typeof commerceProductSchema>;

export const commerceVariantSchema = z.object({
  contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema,
  externalId: z.string().min(1).max(300), productExternalId: z.string().min(1).max(300), title: z.string().min(1),
  price: moneySchema.nullable(), availableQuantity: z.number().int().nonnegative().nullable(), availability: catalogAvailabilitySchema,
  sourceUpdatedAt: z.coerce.date().nullable(), observedAt: z.coerce.date(), ingestionRevision: z.number().int().positive(),
  sourceEvidence: z.object({ providerRevision: z.string().max(300).nullable(), state: commerceEvidenceStateSchema }).strict(),
}).strict();
export type CommerceVariant = z.infer<typeof commerceVariantSchema>;

export const commerceCartLineSchema = z.object({ productExternalId: z.string().min(1).max(300), variantExternalId: z.string().min(1).max(300), quantity: z.number().int().positive() }).strict();
export const commerceCartSchema = z.object({ contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema, cartId: z.string().min(1).max(300), lines: z.array(commerceCartLineSchema), state: z.enum(['unknown', 'active', 'expired', 'unavailable']), sourceEvidence: commerceEvidenceStateSchema }).strict();
export type CommerceCart = z.infer<typeof commerceCartSchema>;

export const commerceCheckoutSchema = z.object({ contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema, checkoutId: z.string().min(1).max(300).nullable(), handoffUrl: z.string().url().nullable(), state: z.enum(['pending', 'ready', 'redirected', 'unknown', 'failed']), receipt: z.string().max(300).nullable(), sourceEvidence: commerceEvidenceStateSchema }).strict();
export type CommerceCheckout = z.infer<typeof commerceCheckoutSchema>;

export const commerceOrderSchema = z.object({ contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema, orderId: z.string().min(1).max(300), lifecycle: z.enum(['unknown', 'pending', 'authorized', 'paid', 'fulfilled', 'cancelled', 'refunded']), total: moneySchema.nullable(), sourceEvidence: commerceEvidenceStateSchema }).strict();
export type CommerceOrder = z.infer<typeof commerceOrderSchema>;

export const commerceRefundSchema = z.object({ contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema, refundId: z.string().min(1).max(300), orderId: z.string().min(1).max(300), amount: moneySchema.nullable(), state: z.enum(['unknown', 'pending', 'completed', 'failed']), sourceEvidence: commerceEvidenceStateSchema }).strict();
export type CommerceRefund = z.infer<typeof commerceRefundSchema>;

export const commerceCancellationSchema = z.object({ contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema, orderId: z.string().min(1).max(300), state: z.enum(['unknown', 'requested', 'completed', 'rejected']), sourceEvidence: commerceEvidenceStateSchema }).strict();
export type CommerceCancellation = z.infer<typeof commerceCancellationSchema>;

export const providerReceiptSchema = z.object({ contractVersion: z.literal(commerceContractVersion), provider: commerceProviderSchema, receiptId: z.string().min(1).max(300), operation: z.enum(['cart', 'checkout', 'order', 'refund', 'cancellation']), state: z.enum(['unverified', 'verified', 'failed']), observedAt: z.coerce.date(), evidenceReference: z.string().max(500).nullable() }).strict();
export type ProviderReceipt = z.infer<typeof providerReceiptSchema>;

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
