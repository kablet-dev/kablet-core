import type { ExperienceComponent } from '@kablet/domain';
export function SafeFallback({ component }: { component: ExperienceComponent }) { if (component.type !== 'safe-fallback') return null; return <section className="experience-card"><span className="eyebrow">A careful pause</span><h2>{component.heading}</h2><p>{component.body}</p></section>; }
