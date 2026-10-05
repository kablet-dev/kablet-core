import { z } from 'zod';
import { qualificationQuestionSchema, visitorStateSchema, type VisitorState } from './visitor-state';

export const decisionTypeSchema = z.enum(['clarify_intent', 'present_offering', 'request_qualification', 'request_time_window', 'offer_next_step', 'no_safe_decision']);
export type DecisionType = z.infer<typeof decisionTypeSchema>;
export const decisionRationaleSchema = z.object({ code: z.enum(['intent_missing', 'intent_known', 'offering_selected', 'selected_offering_unpublished', 'qualification_missing', 'time_window_missing', 'eligible_offering_available', 'no_eligible_business_truth', 'insufficient_authoritative_truth']), source: z.enum(['visitor_state', 'business_truth', 'policy']) });
export type DecisionRationale = z.infer<typeof decisionRationaleSchema>;
export const decisionPolicyInputSchema = z.object({ state: z.lazy(() => visitorStateSchema), eligibleOfferingRefs: z.array(z.object({ offeringId: z.string().uuid(), offeringRevisionId: z.string().uuid() })), qualificationRequirements: z.array(qualificationQuestionSchema).max(20).default([]), permittedNextStep: z.literal(false).default(false) });
export type DecisionPolicyInput = { state: VisitorState; eligibleOfferingRefs: Array<{ offeringId: string; offeringRevisionId: string }>; qualificationRequirements?: Array<z.infer<typeof qualificationQuestionSchema>>; permittedNextStep?: false };
export const decisionPolicyOutputSchema = z.object({ type: decisionTypeSchema, rationale: z.array(decisionRationaleSchema), qualificationQuestion: qualificationQuestionSchema.nullable().default(null) });
export type DecisionPolicyOutput = z.infer<typeof decisionPolicyOutputSchema>;
export const experienceInputContractVersion = 'experience-input.v1' as const;
export const experienceInputSchema = z.object({ contractVersion: z.literal(experienceInputContractVersion), decisionId: z.string().uuid(), decisionContractVersion: z.literal('decision.v1'), organizationId: z.string().uuid(), businessId: z.string().uuid(), visitorIdentityId: z.string().uuid(), sessionId: z.string().uuid(), decisionType: decisionTypeSchema, visitorStateRevisionId: z.string().uuid(), businessTruthRefs: z.array(z.object({ offeringId: z.string().uuid().optional(), offeringRevisionId: z.string().uuid().optional() })), qualificationQuestion: qualificationQuestionSchema.nullable().default(null), rationale: z.array(decisionRationaleSchema) });
export type ExperienceInput = z.infer<typeof experienceInputSchema>;

export function evaluateBaselineDecision(input: DecisionPolicyInput): DecisionPolicyOutput {
  const state = input.state;
  if (!input.eligibleOfferingRefs.length) return { type: 'no_safe_decision', qualificationQuestion: null, rationale: [{ code: 'no_eligible_business_truth', source: 'business_truth' }] };
  if (!state.intent || state.intent.status === 'withdrawn' || state.intent.status === 'invalidated') return { type: 'clarify_intent', qualificationQuestion: null, rationale: [{ code: 'intent_missing', source: 'visitor_state' }] };
  const missingQualification = (input.qualificationRequirements ?? []).find(question => !state.qualification.some(answer => answer.questionKey === question.key));
  if (missingQualification) return { type: 'request_qualification', qualificationQuestion: missingQualification, rationale: [{ code: 'qualification_missing', source: 'visitor_state' }] };
  if (state.selectedOffering?.status === 'selected' && !input.eligibleOfferingRefs.some(ref => ref.offeringId === state.selectedOffering?.offeringId && ref.offeringRevisionId === state.selectedOffering?.publishedRevisionId)) {
    return input.eligibleOfferingRefs.length ? { type: 'present_offering', qualificationQuestion: null, rationale: [{ code: 'selected_offering_unpublished', source: 'visitor_state' }, { code: 'eligible_offering_available', source: 'business_truth' }] } : { type: 'no_safe_decision', qualificationQuestion: null, rationale: [{ code: 'selected_offering_unpublished', source: 'visitor_state' }, { code: 'no_eligible_business_truth', source: 'business_truth' }] };
  }
  if (!state.selectedOffering || state.selectedOffering.status !== 'selected') return { type: 'present_offering', qualificationQuestion: null, rationale: [{ code: 'intent_known', source: 'visitor_state' }, { code: 'eligible_offering_available', source: 'business_truth' }] };
  if (!state.timeWindow || ['withdrawn', 'invalidated'].includes(state.timeWindow.status)) return { type: 'request_time_window', qualificationQuestion: null, rationale: [{ code: 'offering_selected', source: 'visitor_state' }, { code: 'time_window_missing', source: 'visitor_state' }] };
  return { type: 'no_safe_decision', qualificationQuestion: null, rationale: [{ code: 'insufficient_authoritative_truth', source: 'policy' }] };
}
