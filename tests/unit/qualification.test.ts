import { describe, expect, it } from 'vitest';
import { evaluateBaselineDecision, qualificationQuestionSchema } from '@kablet/domain';
import { emptyVisitorState, observationSchema, reduceVisitorStateFromEvidence } from '@kablet/domain';

const question = qualificationQuestionSchema.parse({ key: 'context_timeline', prompt: 'What timeframe are you considering?', options: [{ value: 'immediate', label: 'Soon' }, { value: 'exploring', label: 'Exploring' }] });
const ids = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003'];
function answer(id: string, value: 'immediate' | 'exploring', key: string) { return observationSchema.parse({ id, organizationId: ids[0], businessId: ids[1], visitorIdentityId: ids[2], sessionId: ids[2], kind: 'qualification.answered', value: { type: 'qualification', questionKey: 'context_timeline', answer: value }, idempotencyKey: key, observedAt: new Date('2026-01-01T00:00:00Z'), sourceType: 'visitor', sourceReference: 'test', correctionOfObservationId: null }); }

describe('qualification foundation', () => {
  it('requests the first missing configured qualification question', () => {
    const state = reduceVisitorStateFromEvidence([observationSchema.parse({ id: ids[0], organizationId: ids[0], businessId: ids[1], visitorIdentityId: ids[2], sessionId: ids[2], kind: 'intent.expressed', value: { type: 'intent', value: 'request_information' }, idempotencyKey: 'intent', observedAt: new Date(), sourceType: 'visitor', sourceReference: 'test', correctionOfObservationId: null })]);
    expect(evaluateBaselineDecision({ state, eligibleOfferingRefs: [{ offeringId: ids[0], offeringRevisionId: ids[1] }], qualificationRequirements: [question] }).type).toBe('request_qualification');
  });

  it('does not request qualification without authoritative eligible Business Truth', () => {
    const state = reduceVisitorStateFromEvidence([observationSchema.parse({ id: ids[0], organizationId: ids[0], businessId: ids[1], visitorIdentityId: ids[2], sessionId: ids[2], kind: 'intent.expressed', value: { type: 'intent', value: 'request_information' }, idempotencyKey: 'intent-no-truth', observedAt: new Date(), sourceType: 'visitor', sourceReference: 'test', correctionOfObservationId: null })]);
    expect(evaluateBaselineDecision({ state, eligibleOfferingRefs: [], qualificationRequirements: [question] }).type).toBe('no_safe_decision');
  });

  it('replaces an answer only through a new observation while preserving history', () => {
    const first = answer(ids[0], 'immediate', 'a');
    const second = answer(ids[1], 'exploring', 'b');
    const state = reduceVisitorStateFromEvidence([first, second]);
    expect(state.qualification).toEqual([{ questionKey: 'context_timeline', answer: 'exploring', sourceObservationId: ids[1] }]);
    expect(first.value).toEqual({ type: 'qualification', questionKey: 'context_timeline', answer: 'immediate' });
    expect(emptyVisitorState.qualification).toEqual([]);
  });

  it('keeps contact separate from consent and removes readiness on withdrawal', () => {
    const contact = observationSchema.parse({ id: ids[0], organizationId: ids[0], businessId: ids[1], visitorIdentityId: ids[2], sessionId: ids[2], kind: 'contact.submitted', value: { type: 'contact', contactRecordId: ids[1], channels: ['email'] }, idempotencyKey: 'contact', observedAt: new Date(), sourceType: 'visitor', sourceReference: 'test', correctionOfObservationId: null });
    const grant = observationSchema.parse({ id: ids[1], organizationId: ids[0], businessId: ids[1], visitorIdentityId: ids[2], sessionId: ids[2], kind: 'consent.granted', value: { type: 'consent', purpose: 'follow_up', version: '1' }, idempotencyKey: 'grant', observedAt: new Date(), sourceType: 'visitor', sourceReference: 'test', correctionOfObservationId: null });
    const withdrawal = observationSchema.parse({ id: ids[0].replace(/1$/, '4'), organizationId: ids[0], businessId: ids[1], visitorIdentityId: ids[2], sessionId: ids[2], kind: 'consent.withdrawn', value: { type: 'consent', purpose: 'follow_up', version: '1' }, idempotencyKey: 'withdraw', observedAt: new Date(), sourceType: 'visitor', sourceReference: 'test', correctionOfObservationId: null });
    const ready = reduceVisitorStateFromEvidence([contact, grant]);
    const withdrawn = reduceVisitorStateFromEvidence([contact, grant, withdrawal]);
    expect(ready.contact?.sourceContactRecordId).toBe(ids[1]);
    expect(ready.consent?.status).toBe('granted');
    expect(withdrawn.contact?.sourceContactRecordId).toBe(ids[1]);
    expect(withdrawn.consent?.status).toBe('withdrawn');
  });

  it('rejects unbounded or malformed qualification values', () => {
    expect(() => qualificationQuestionSchema.parse({ key: 'not valid', prompt: 'x', options: [{ value: 'a', label: 'A' }] })).toThrow();
    expect(() => answer(ids[2], 'immediate', 'ok')).not.toThrow();
  });
});
