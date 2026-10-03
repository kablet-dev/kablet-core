import type { ExperienceComponent, ExperienceModel } from '@kablet/domain';
import { IntentClarification } from './IntentClarification';
import { NextStepInformation } from './NextStepInformation';
import { OfferingList } from './OfferingList';
import { SafeFallback } from './SafeFallback';
import { TimeWindowRequest } from './TimeWindowRequest';

type RendererProps = { component: ExperienceComponent };
type Renderer = (props: RendererProps) => React.ReactNode;
const registry: Record<ExperienceComponent['type'], Renderer> = {
  'intent-clarification': IntentClarification,
  'offering-list': OfferingList,
  'time-window-request': TimeWindowRequest,
  'next-step-information': NextStepInformation,
  'safe-fallback': SafeFallback,
};

export function ExperienceRenderer({ experience }: { experience: ExperienceModel }) {
  return <div className="experience-content">{experience.components.map((component, index) => {
    const Component = registry[component.type];
    return <Component key={`${component.type}-${index}`} component={component} />;
  })}</div>;
}
