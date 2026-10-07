import type { ExperienceComponent } from '@kablet/domain';

export const experienceRendererKinds: Record<ExperienceComponent['type'], string> = {
  'intent-clarification': 'IntentClarification',
  'offering-list': 'OfferingList',
  'time-window-request': 'TimeWindowRequest',
  'qualification-question': 'QualificationQuestion',
  'contact-request': 'ContactRequest',
  'next-step-information': 'NextStepInformation',
  'action-confirmation': 'ActionConfirmation',
  'safe-fallback': 'SafeFallback',
};
