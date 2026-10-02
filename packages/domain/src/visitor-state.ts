import { z } from 'zod';

export const observationKindSchema = z.enum(['intent.expressed','intent.confirmed','intent.withdrawn','offering.selected','offering.deselected','time_window.stated','time_window.corrected','time_window.withdrawn','observation.invalidated']);
export const observationValueSchema = z.union([
  z.object({ type: z.literal('intent'), value: z.enum(['explore_offerings','request_information','select_offering']) }),
  z.object({ type: z.literal('offering'), offeringId: z.string().uuid(), publishedRevisionId: z.string().uuid() }),
  z.object({ type: z.literal('time_window'), start: z.coerce.date(), end: z.coerce.date() }).refine(v => v.end > v.start, 'time window must end after it starts'),
  z.object({ type: z.literal('none') }),
]);
export const observationSchema = z.object({ id: z.string().uuid(), organizationId: z.string().uuid(), businessId: z.string().uuid(), visitorIdentityId: z.string().uuid(), sessionId: z.string().uuid(), expectedVersion: z.number().int().nonnegative().optional(), kind: observationKindSchema, value: observationValueSchema, idempotencyKey: z.string().trim().min(1).max(200), observedAt: z.coerce.date(), sourceType: z.enum(['visitor','trusted_system']), sourceReference: z.string().trim().min(1).max(500), correctionOfObservationId: z.string().uuid().nullable().default(null) });
export type Observation = z.infer<typeof observationSchema>;
export const visitorStateSchema = z.object({ schemaVersion: z.literal(1), intent: z.object({ value: z.string(), status: z.enum(['stated','confirmed','withdrawn','invalidated']), sourceObservationId: z.string().uuid() }).nullable(), selectedOffering: z.object({ offeringId: z.string().uuid(), publishedRevisionId: z.string().uuid(), status: z.enum(['selected','withdrawn','invalidated']), sourceObservationId: z.string().uuid() }).nullable(), timeWindow: z.object({ start: z.coerce.date(), end: z.coerce.date(), status: z.enum(['stated','corrected','withdrawn','invalidated']), sourceObservationId: z.string().uuid() }).nullable() });
export type VisitorState = z.infer<typeof visitorStateSchema>;
export const emptyVisitorState: VisitorState = { schemaVersion: 1, intent: null, selectedOffering: null, timeWindow: null };

export function reduceVisitorStateFromEvidence(observations: Observation[]): VisitorState {
  const ordered = [...observations].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime() || a.id.localeCompare(b.id));
  const invalidated = new Set<string>();
  for (const observation of ordered) if (observation.kind === 'observation.invalidated' && observation.correctionOfObservationId) invalidated.add(observation.correctionOfObservationId);
  let state = emptyVisitorState;
  for (const observation of ordered) {
    if (observation.kind === 'observation.invalidated') continue;
    if (!invalidated.has(observation.id)) state = reduceVisitorState(state, observation);
  }
  return state;
}

export function reduceVisitorState(previous: VisitorState, observation: Observation): VisitorState {
  const state = visitorStateSchema.parse(previous);
  if (observation.kind === 'intent.expressed' && observation.value.type === 'intent') { if (state.intent?.status === 'confirmed' && state.intent.value !== observation.value.value && !observation.correctionOfObservationId) throw new Error('confirmed intent requires explicit correction'); return { ...state, intent: { value: observation.value.value, status: 'stated', sourceObservationId: observation.id } }; }
  if (observation.kind === 'intent.confirmed' && observation.value.type === 'intent') return { ...state, intent: { value: observation.value.value, status: 'confirmed', sourceObservationId: observation.id } };
  if (observation.kind === 'intent.withdrawn') return { ...state, intent: state.intent ? { ...state.intent, status: 'withdrawn', sourceObservationId: observation.id } : null };
  if (observation.kind === 'offering.selected' && observation.value.type === 'offering') return { ...state, selectedOffering: { offeringId: observation.value.offeringId, publishedRevisionId: observation.value.publishedRevisionId, status: 'selected', sourceObservationId: observation.id } };
  if (observation.kind === 'offering.deselected') return { ...state, selectedOffering: state.selectedOffering ? { ...state.selectedOffering, status: 'withdrawn', sourceObservationId: observation.id } : null };
  if ((observation.kind === 'time_window.stated' || observation.kind === 'time_window.corrected') && observation.value.type === 'time_window') return { ...state, timeWindow: { ...observation.value, status: observation.kind === 'time_window.corrected' ? 'corrected' : 'stated', sourceObservationId: observation.id } };
  if (observation.kind === 'time_window.withdrawn') return { ...state, timeWindow: state.timeWindow ? { ...state.timeWindow, status: 'withdrawn', sourceObservationId: observation.id } : null };
  if (observation.kind === 'observation.invalidated') {
    const target = observation.correctionOfObservationId;
    if (!target) throw new Error('invalidation requires a target observation');
    return {
      ...state,
      intent: state.intent?.sourceObservationId === target ? { ...state.intent, status: 'invalidated', sourceObservationId: observation.id } : state.intent,
      selectedOffering: state.selectedOffering?.sourceObservationId === target ? { ...state.selectedOffering, status: 'invalidated', sourceObservationId: observation.id } : state.selectedOffering,
      timeWindow: state.timeWindow?.sourceObservationId === target ? { ...state.timeWindow, status: 'invalidated', sourceObservationId: observation.id } : state.timeWindow,
    };
  }
  throw new Error('unsupported observation/value combination');
}
