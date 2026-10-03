import type { ExperienceComponent } from '@kablet/domain';
export function IntentClarification({ component }: { component: ExperienceComponent }) { if (component.type !== 'intent-clarification') return null; return <section className="experience-card"><span className="eyebrow">A considered start</span><h2>{component.heading}</h2><p>{component.body}</p></section>; }
