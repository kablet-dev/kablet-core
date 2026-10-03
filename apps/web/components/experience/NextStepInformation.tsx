import type { ExperienceComponent } from '@kablet/domain';
export function NextStepInformation({ component }: { component: ExperienceComponent }) { if (component.type !== 'next-step-information') return null; return <section className="experience-card"><span className="eyebrow">Next step</span><h2>{component.heading}</h2><p>{component.body}</p></section>; }
