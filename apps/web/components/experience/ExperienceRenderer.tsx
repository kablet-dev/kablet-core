import type { ExperienceComponent, ExperienceModel } from '@kablet/domain';
import { IntentClarification } from './IntentClarification';
import { NextStepInformation } from './NextStepInformation';
import { OfferingList } from './OfferingList';
import { SafeFallback } from './SafeFallback';
import { TimeWindowRequest } from './TimeWindowRequest';
import { QualificationQuestion } from './QualificationQuestion';
import { ContactRequest } from './ContactRequest';

type RendererProps = { component: ExperienceComponent };
type Renderer = (props: RendererProps) => React.ReactNode;
const registry: Record<Exclude<ExperienceComponent['type'], 'qualification-question' | 'contact-request' | 'action-confirmation'>, Renderer> = {
  'intent-clarification': IntentClarification,
  'offering-list': OfferingList,
  'time-window-request': TimeWindowRequest,
  'next-step-information': NextStepInformation,
  'safe-fallback': SafeFallback,
};

export function ExperienceRenderer({ experience, selectedQualification, onQualificationSelect }: { experience: ExperienceModel; selectedQualification?: string | null; onQualificationSelect?: (value: string) => void }) {
  return <div className="experience-content">{experience.components.map((component, index) => {
    if (component.type === 'qualification-question') return <QualificationQuestion key={`${component.type}-${index}`} component={component} selected={selectedQualification ?? null} onSelect={onQualificationSelect ?? (() => undefined)} />;
    if (component.type === 'contact-request') return <ContactRequest key={`${component.type}-${index}`} component={component} />;
    if (component.type === 'action-confirmation') return <NextStepInformation key={`${component.type}-${index}`} component={{ type: 'next-step-information', heading: component.heading, body: component.body }} />;
    const Component = registry[component.type];
    return <Component key={`${component.type}-${index}`} component={component} />;
  })}</div>;
}
