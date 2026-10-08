import type { ExperienceComponent, ExperienceModel } from '@kablet/domain';
import { IntentClarification } from './IntentClarification';
import { NextStepInformation } from './NextStepInformation';
import { OfferingList } from './OfferingList';
import { SafeFallback } from './SafeFallback';
import { TimeWindowRequest } from './TimeWindowRequest';
import { QualificationQuestion } from './QualificationQuestion';
import { ContactRequest } from './ContactRequest';
import { ActionConfirmation, type ActionPresentationStatus } from './ActionConfirmation';
import { experienceRendererKinds } from './experience-renderer-map';

type RendererProps = { component: ExperienceComponent; selectedQualification?: string | null; onQualificationSelect?: (value: string) => void; onOfferingSelect?: (offeringId: string, offeringRevisionId: string) => void };
type ActionProps = { actionStatus?: ActionPresentationStatus; onConfirmAction?: () => void };
type Renderer = (props: RendererProps & ActionProps) => React.ReactNode;
const registry: Record<keyof typeof experienceRendererKinds, Renderer> = {
  'intent-clarification': IntentClarification,
  'offering-list': ({ component, onOfferingSelect }: RendererProps) => <OfferingList component={component} onOfferingSelect={onOfferingSelect} />,
  'time-window-request': TimeWindowRequest,
  'next-step-information': NextStepInformation,
  'safe-fallback': SafeFallback,
  'qualification-question': ({ component, selectedQualification, onQualificationSelect }: RendererProps) => <QualificationQuestion component={component} selected={selectedQualification ?? null} onSelect={onQualificationSelect ?? (() => undefined)} />,
  'contact-request': ({ component }: RendererProps) => <ContactRequest component={component} />,
  'action-confirmation': ({ component, actionStatus, onConfirmAction }: RendererProps & ActionProps) => <ActionConfirmation component={component} status={actionStatus} onConfirm={onConfirmAction} />,
};


export function ExperienceRenderer({ experience, selectedQualification, onQualificationSelect, onOfferingSelect, actionStatus, onConfirmAction }: { experience: ExperienceModel; selectedQualification?: string | null; onQualificationSelect?: (value: string) => void; onOfferingSelect?: (offeringId: string, offeringRevisionId: string) => void; actionStatus?: ActionPresentationStatus; onConfirmAction?: () => void }) {
  return <div className="experience-content">{experience.components.map((component, index) => {
    const Component = registry[component.type];
    return <Component key={`${component.type}-${index}`} component={component} selectedQualification={selectedQualification} onQualificationSelect={onQualificationSelect} onOfferingSelect={onOfferingSelect} actionStatus={actionStatus} onConfirmAction={onConfirmAction} />;
  })}</div>;
}
