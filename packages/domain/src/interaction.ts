import { z } from 'zod';
import { experienceModelSchema } from './experience';

export const interactionIntentSchema = z.enum(['explore_offerings', 'request_information', 'select_offering']);
export type InteractionIntent = z.infer<typeof interactionIntentSchema>;
export const startInteractionRequestSchema = z.object({}).strict();
export const expressIntentRequestSchema = z.object({
  intent: interactionIntentSchema,
  idempotencyKey: z.string().trim().min(1).max(200),
}).strict();
export const expressQualificationRequestSchema = z.object({ questionKey: z.string().trim().regex(/^[a-z][a-z0-9_.-]{1,63}$/), answer: z.string().trim().regex(/^[a-z0-9][a-z0-9_.-]{0,63}$/), idempotencyKey: z.string().trim().min(1).max(200) }).strict();
export const expressContactRequestSchema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().email().max(320), consent: z.literal(true), idempotencyKey: z.string().trim().min(1).max(200) }).strict();
export const interactionExperienceResponseSchema = z.object({
  contractVersion: z.literal('interaction-response.v1'),
  experience: experienceModelSchema,
}).strict();
export const safeInteractionErrorSchema = z.object({
  contractVersion: z.literal('interaction-error.v1'),
  code: z.enum(['invalid_request', 'interaction_expired', 'interaction_revoked', 'unavailable']),
  message: z.string().min(1).max(200),
}).strict();
export type ExpressIntentRequest = z.infer<typeof expressIntentRequestSchema>;
export type ExpressQualificationRequest = z.infer<typeof expressQualificationRequestSchema>;
export type ExpressContactRequest = z.infer<typeof expressContactRequestSchema>;
