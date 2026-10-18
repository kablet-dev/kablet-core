import { z } from 'zod';

export const nativeRuleStatusSchema = z.enum(['draft', 'validated', 'approved', 'active', 'disabled', 'rolled_back']);
export type NativeRuleStatus = z.infer<typeof nativeRuleStatusSchema>;

export const nativeRuleIntentSchema = z.enum(['baseline', 'discovery', 'comparison', 'product', 'reassurance', 'purchase_readiness']);
export type NativeRuleIntent = z.infer<typeof nativeRuleIntentSchema>;

export const nativeRulePreferenceSchema = z.enum(['available', 'physical', 'digital', 'lower_price']).nullable();
export type NativeRulePreference = z.infer<typeof nativeRulePreferenceSchema>;

export const nativeRuleCompositionSchema = z.enum(['entry', 'discovery', 'comparison']);
export type NativeRuleComposition = z.infer<typeof nativeRuleCompositionSchema>;

export const nativeRuleReasonCodeSchema = z.enum(['baseline_safe_default', 'explicit_intent', 'merchant_truth_match', 'missing_authoritative_truth', 'unavailable_composition']);
export type NativeRuleReasonCode = z.infer<typeof nativeRuleReasonCodeSchema>;

export const nativeRuleConditionsSchema = z.object({
  intent: nativeRuleIntentSchema,
  preference: nativeRulePreferenceSchema.default(null),
  requiresAvailableInventory: z.boolean().default(false),
}).strict();
export type NativeRuleConditions = z.infer<typeof nativeRuleConditionsSchema>;

export const nativeRuleSchema = z.object({
  contractVersion: z.literal('native-rule.v1'),
  ruleId: z.string().uuid(),
  ruleKey: z.string().regex(/^[a-z0-9._-]{1,80}$/),
  version: z.number().int().positive(),
  organizationId: z.string().uuid(),
  businessId: z.string().uuid(),
  storeId: z.string().uuid(),
  status: nativeRuleStatusSchema,
  priority: z.number().int().min(0).max(100000),
  conditions: nativeRuleConditionsSchema,
  composition: nativeRuleCompositionSchema,
  reasonCode: nativeRuleReasonCodeSchema,
  reason: z.string().trim().min(1).max(240),
}).strict();
export type NativeRule = z.infer<typeof nativeRuleSchema>;

export const nativeRuleSelectionSchema = nativeRuleSchema.pick({ ruleId: true, ruleKey: true, version: true, composition: true, reasonCode: true, reason: true });
export type NativeRuleSelection = z.infer<typeof nativeRuleSelectionSchema>;

export function nativeRuleIntentFor(input: { signal: 'discovery' | 'comparison' | null; guidanceMode?: 'discovery' | 'comparison' | 'product' | 'reassurance' | 'purchase_readiness'; }): NativeRuleIntent {
  if (input.guidanceMode === 'product') return 'product';
  if (input.guidanceMode === 'reassurance') return 'reassurance';
  if (input.guidanceMode === 'purchase_readiness') return 'purchase_readiness';
  if (input.guidanceMode === 'comparison' || input.signal === 'comparison') return 'comparison';
  if (input.guidanceMode === 'discovery' || input.signal === 'discovery') return 'discovery';
  return 'baseline';
}
