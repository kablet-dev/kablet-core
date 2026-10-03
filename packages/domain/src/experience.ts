import { z } from 'zod';
import { decisionTypeSchema, experienceInputSchema, type ExperienceInput } from './decision';

export const renderableOfferingSchema = z.object({
  offeringId: z.string().uuid(),
  offeringRevisionId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2_000),
  priceLabel: z.string().trim().min(1).max(200),
});
export type RenderableOffering = z.infer<typeof renderableOfferingSchema>;

const intentClarificationSchema = z.object({
  type: z.literal('intent-clarification'),
  heading: z.string().min(1),
  body: z.string().min(1),
});
const offeringListSchema = z.object({
  type: z.literal('offering-list'),
  heading: z.string().min(1),
  body: z.string().min(1),
  offerings: z.array(renderableOfferingSchema),
});
const timeWindowRequestSchema = z.object({
  type: z.literal('time-window-request'),
  heading: z.string().min(1),
  body: z.string().min(1),
});
const nextStepInformationSchema = z.object({
  type: z.literal('next-step-information'),
  heading: z.string().min(1),
  body: z.string().min(1),
});
const safeFallbackSchema = z.object({
  type: z.literal('safe-fallback'),
  heading: z.string().min(1),
  body: z.string().min(1),
});

export const experienceComponentSchema = z.discriminatedUnion('type', [
  intentClarificationSchema,
  offeringListSchema,
  timeWindowRequestSchema,
  nextStepInformationSchema,
  safeFallbackSchema,
]);
export type ExperienceComponent = z.infer<typeof experienceComponentSchema>;

export const experienceModelSchema = z.object({
  contractVersion: z.literal('experience.v1'),
  decisionId: z.string().uuid(),
  businessId: z.string().uuid(),
  decisionType: decisionTypeSchema,
  components: z.array(experienceComponentSchema).min(1),
});
export type ExperienceModel = z.infer<typeof experienceModelSchema>;

export function decisionToExperience(input: unknown, offerings: unknown[] = []): ExperienceModel {
  const decision = experienceInputSchema.parse(input);
  const renderableOfferings = z.array(renderableOfferingSchema).parse(offerings);
  const components: ExperienceComponent[] = (() => {
    switch (decision.decisionType) {
      case 'clarify_intent':
        return [{ type: 'intent-clarification', heading: 'What would you like to explore?', body: 'Tell us what matters most so we can guide you with the information this business has verified.' }];
      case 'present_offering':
        return renderableOfferings.length > 0
          ? [{ type: 'offering-list', heading: 'Options to explore', body: 'These options have been prepared for this experience.', offerings: renderableOfferings }]
          : [{ type: 'safe-fallback', heading: 'Let’s clarify what you need', body: 'There is not enough current business information to present an option safely yet.' }];
      case 'request_time_window':
        return [{ type: 'time-window-request', heading: 'When would suit you?', body: 'Share a preferred time window so the next step can be considered safely.' }];
      case 'offer_next_step':
        return [{ type: 'next-step-information', heading: 'Here is the next step', body: 'Review the information above and continue when you are ready. No action has been taken.' }];
      case 'no_safe_decision':
        return [{ type: 'safe-fallback', heading: 'Let’s take this one step at a time', body: 'We do not have enough authoritative information to recommend a next step yet.' }];
    }
  })();
  return experienceModelSchema.parse({ contractVersion: 'experience.v1', decisionId: decision.decisionId, businessId: decision.businessId, decisionType: decision.decisionType, components });
}

export type { ExperienceInput };
