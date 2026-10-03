import { describe, expect, it } from 'vitest';
import { emptyVisitorState, evaluateBaselineDecision } from '@kablet/domain';

const refs = [{ offeringId: '11111111-1111-4111-8111-111111111111', offeringRevisionId: '22222222-2222-4222-8222-222222222222' }];
const intent = { value: 'explore_offerings' as const, status: 'stated' as const, sourceObservationId: '33333333-3333-4333-8333-333333333333' };

describe('baseline Decision policy', () => {
  it('distinguishes missing intent from missing authoritative Business Truth', () => {
    expect(evaluateBaselineDecision({ state: emptyVisitorState, eligibleOfferingRefs: refs })).toMatchObject({ type: 'clarify_intent' });
    expect(evaluateBaselineDecision({ state: emptyVisitorState, eligibleOfferingRefs: [] })).toMatchObject({ type: 'no_safe_decision' });
  });
  it('presents eligible offerings and requests missing time context', () => {
    expect(evaluateBaselineDecision({ state: { ...emptyVisitorState, intent }, eligibleOfferingRefs: refs })).toMatchObject({ type: 'present_offering' });
    expect(evaluateBaselineDecision({ state: { ...emptyVisitorState, intent, selectedOffering: { offeringId: refs[0].offeringId, publishedRevisionId: refs[0].offeringRevisionId, status: 'selected', sourceObservationId: intent.sourceObservationId } }, eligibleOfferingRefs: refs })).toMatchObject({ type: 'request_time_window' });
  });
  it('returns no_safe_decision when the selected revision is no longer eligible', () => {
    expect(evaluateBaselineDecision({ state: { ...emptyVisitorState, intent, selectedOffering: { offeringId: refs[0].offeringId, publishedRevisionId: refs[0].offeringRevisionId, status: 'selected', sourceObservationId: intent.sourceObservationId } }, eligibleOfferingRefs: [] })).toMatchObject({ type: 'no_safe_decision' });
  });
});
