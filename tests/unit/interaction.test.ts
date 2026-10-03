import { describe, expect, it } from 'vitest';
import { expressIntentRequestSchema, safeInteractionErrorSchema, startInteractionRequestSchema } from '@kablet/domain';

describe('interaction contracts', () => {
  it('accepts only the bounded intent vocabulary', () => { expect(expressIntentRequestSchema.parse({ intent: 'request_information', idempotencyKey: 'intent-1' }).intent).toBe('request_information'); expect(() => expressIntentRequestSchema.parse({ intent: 'free text', idempotencyKey: 'intent-1' })).toThrow(); });
  it('rejects browser tenant authorization fields', () => { expect(() => startInteractionRequestSchema.parse({ organizationId: 'untrusted' })).toThrow(); });
  it('validates safe public errors', () => { expect(safeInteractionErrorSchema.parse({ contractVersion: 'interaction-error.v1', code: 'interaction_expired', message: 'Interaction expired.' }).code).toBe('interaction_expired'); });
});
