import { describe, expect, it } from 'vitest';
import { experienceRendererKinds } from '../../apps/web/components/experience/experience-renderer-map';

describe('ExperienceRenderer semantic coverage', () => {
  it('covers every current component in declared order', () => {
    const orderedTypes = [
      'intent-clarification', 'offering-list', 'time-window-request', 'qualification-question',
      'contact-request', 'next-step-information', 'action-confirmation', 'safe-fallback',
    ];
    expect(Object.keys(experienceRendererKinds)).toEqual(orderedTypes);
  });

  it('uses a dedicated action-confirmation renderer', () => {
    expect(experienceRendererKinds['action-confirmation']).toBe('ActionConfirmation');
    expect(experienceRendererKinds['action-confirmation']).not.toBe(experienceRendererKinds['next-step-information']);
  });
});
