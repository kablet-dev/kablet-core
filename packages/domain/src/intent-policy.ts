import { z } from 'zod';
import { interactionIntentSchema } from './interaction';
import { qualificationKeySchema, qualificationQuestionSchema } from './visitor-state';

export const intentPolicyContractVersion = 'business-intent-policy.v1' as const;
const policyKeySchema = z.string().trim().regex(/^[a-z][a-z0-9_.-]{1,63}$/);

export const intentPolicyRuleSchema = z.object({
  intent: interactionIntentSchema,
  qualificationRequirementKeys: z.array(qualificationKeySchema).max(20),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.qualificationRequirementKeys).size !== value.qualificationRequirementKeys.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate qualification requirement reference' });
});

export const businessIntentPolicyRevisionSchema = z.object({
  contractVersion: z.literal(intentPolicyContractVersion),
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  businessId: z.string().uuid(),
  policyKey: policyKeySchema,
  revisionNumber: z.number().int().positive(),
  createdAt: z.coerce.date(),
  qualificationRequirements: z.array(qualificationQuestionSchema).max(20),
  intentRules: z.array(intentPolicyRuleSchema).max(3),
}).strict().superRefine((value, ctx) => {
  const keys = new Set(value.qualificationRequirements.map(item => item.key));
  if (keys.size !== value.qualificationRequirements.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate qualification key' });
  const intents = new Set(value.intentRules.map(item => item.intent));
  if (intents.size !== value.intentRules.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate intent rule' });
  value.intentRules.forEach(rule => rule.qualificationRequirementKeys.forEach(key => {
    if (!keys.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown qualification requirement: ${key}` });
  }));
});

export type BusinessIntentPolicyRevision = z.infer<typeof businessIntentPolicyRevisionSchema>;

export function qualificationRequirementsForIntent(policy: BusinessIntentPolicyRevision, intent: z.infer<typeof interactionIntentSchema> | null) {
  if (!intent) return [];
  const rule = policy.intentRules.find(item => item.intent === intent);
  if (!rule) return [];
  return rule.qualificationRequirementKeys.map(key => policy.qualificationRequirements.find(item => item.key === key)!).filter(Boolean);
}
