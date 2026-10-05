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
  it('returns offer_next_step only after the required contact and consent are satisfied', () => {
    const state = { ...emptyVisitorState, intent, qualification: [{ questionKey: 'context_timeline', answer: 'immediate', sourceObservationId: intent.sourceObservationId }], contact: { status: 'provided' as const, channels: ['email' as const], sourceContactRecordId: refs[0].offeringId, sourceObservationId: intent.sourceObservationId }, consent: { status: 'granted' as const, purpose: 'follow_up', version: '1', sourceObservationId: intent.sourceObservationId } };
    expect(evaluateBaselineDecision({ state, eligibleOfferingRefs: refs, contactRequirement: { fields: ['name'], channels: ['email'], consentPurpose: 'follow_up', consentVersion: '1' } })).toMatchObject({ type: 'offer_next_step' });
  });
  it('keeps contact readiness gated by matching consent purpose and version', () => {
    const contact = { status: 'provided' as const, channels: ['email' as const], sourceContactRecordId: refs[0].offeringId, sourceObservationId: intent.sourceObservationId };
    const requirement = { fields: ['name'], channels: ['email'], consentPurpose: 'follow_up', consentVersion: '1' } as const;
    const base = { ...emptyVisitorState, intent, qualification: [{ questionKey: 'context_timeline', answer: 'immediate', sourceObservationId: intent.sourceObservationId }], contact };
    expect(evaluateBaselineDecision({ state: base, eligibleOfferingRefs: refs, contactRequirement: requirement }).type).toBe('request_contact');
    expect(evaluateBaselineDecision({ state: { ...base, consent: { status: 'granted' as const, purpose: 'marketing', version: '1', sourceObservationId: intent.sourceObservationId } }, eligibleOfferingRefs: refs, contactRequirement: requirement }).type).toBe('request_contact');
    expect(evaluateBaselineDecision({ state: { ...base, consent: { status: 'granted' as const, purpose: 'follow_up', version: '2', sourceObservationId: intent.sourceObservationId } }, eligibleOfferingRefs: refs, contactRequirement: requirement }).type).toBe('request_contact');
    expect(evaluateBaselineDecision({ state: { ...base, consent: { status: 'withdrawn' as const, purpose: 'follow_up', version: '1', sourceObservationId: intent.sourceObservationId } }, eligibleOfferingRefs: refs, contactRequirement: requirement }).type).toBe('request_contact');
  });
  it('preserves no_safe_decision precedence over complete contact readiness', () => {
    const state = { ...emptyVisitorState, intent, qualification: [{ questionKey: 'context_timeline', answer: 'immediate', sourceObservationId: intent.sourceObservationId }], contact: { status: 'provided' as const, channels: ['email' as const], sourceContactRecordId: refs[0].offeringId, sourceObservationId: intent.sourceObservationId }, consent: { status: 'granted' as const, purpose: 'follow_up', version: '1', sourceObservationId: intent.sourceObservationId } };
    expect(evaluateBaselineDecision({ state, eligibleOfferingRefs: [], qualificationRequirements: [{ key: 'context_timeline', prompt: 'Timeframe?', options: [{ value: 'immediate', label: 'Soon' }] }], contactRequirement: { fields: ['name'], channels: ['email'], consentPurpose: 'follow_up', consentVersion: '1' } })).toMatchObject({ type: 'no_safe_decision' });
  });
});
