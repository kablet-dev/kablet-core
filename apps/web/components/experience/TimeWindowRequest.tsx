import type { ExperienceComponent } from '@kablet/domain';
export function TimeWindowRequest({ component }: { component: ExperienceComponent }) { if (component.type !== 'time-window-request') return null; return <section className="experience-card"><span className="eyebrow">Your timing</span><h2>{component.heading}</h2><p>{component.body}</p></section>; }
